import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 8010);

const providers = {
  kimi: {
    endpoint: 'https://api.kimi.com/coding/v1/chat/completions',
    defaultModel: 'kimi-k2.6',
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
  },
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'moonshot-ai/kimi-k2.6',
    headers: {
      'HTTP-Referer': `http://localhost:${port}`,
      'X-Title': 'Yiyin Analysis',
    },
  },
};

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    ...headers,
  });
  res.end(body);
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 2_000_000) throw new Error('Request body too large');
  }
  return JSON.parse(body || '{}');
}

async function proxyLlm(req, res) {
  const providerId = req.headers['x-llm-provider'] || 'openrouter';
  const provider = providers[providerId];
  let apiKey = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (!provider) {
    send(res, 400, `Unknown provider: ${providerId}`);
    return;
  }
  // Fallback to env key for local development
  if (!apiKey || apiKey === 'local') {
    apiKey = process.env.OPENAI_API_KEY || '';
  }
  if (!apiKey) {
    send(res, 401, 'Missing API key');
    return;
  }

  try {
    const body = await readBody(req);
    const upstream = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(provider.headers || {}),
      },
      body: JSON.stringify({
        ...body,
        model: body.model || provider.defaultModel,
      }),
    });

    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    if (!upstream.body) {
      res.end(await upstream.text());
      return;
    }

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    const message = error.message || 'Proxy request failed';
    if (res.headersSent) {
      res.end(`\ndata: ${JSON.stringify({ choices: [{ delta: { content: `\n\n[代理错误] ${message}` } }] })}\n\n`);
      return;
    }
    send(res, 502, message);
  }
}

function serveStatic(req, res) {
  const rawPath = decodeURIComponent(new URL(req.url, `http://localhost:${port}`).pathname);
  const requestPath = rawPath === '/' ? '/index.html' : rawPath;
  const filePath = normalize(join(root, requestPath));

  if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  const ext = extname(filePath);
  res.writeHead(200, {
    'Content-Type': contentTypes[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-LLM-Provider',
    });
    res.end();
    return;
  }

  if (req.url.startsWith('/api/llm/chat')) {
    if (req.method !== 'POST') {
      send(res, 405, 'Method not allowed');
      return;
    }
    await proxyLlm(req, res);
    return;
  }

  if (req.url === '/health') {
    send(res, 200, 'ok', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  serveStatic(req, res);
}).listen(port, '127.0.0.1', () => {
  console.log(`World analysis tool running at http://localhost:${port}/`);
});
