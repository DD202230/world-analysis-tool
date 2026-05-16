// ════════════════════════════════════════
// INDEXEDDB LAYER
// ════════════════════════════════════════
const DB_NAME = 'yiyin_db';
const DB_VERSION = 1;

// Memory fallback for Safari private mode
let memoryStore = { history: [], settings: {} };
let idbAvailable = true;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => {
            idbAvailable = false;
            reject(req.error);
        };
        req.onsuccess = () => resolve(req.result);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('history')) {
                const hStore = db.createObjectStore('history', { keyPath: 'id' });
                hStore.createIndex('timestamp', 'timestamp', { unique: false });
                hStore.createIndex('favorited', 'favorited', { unique: false });
            }
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
        };
    });
}

// Memory fallback wrappers
async function memGetAll(storeName) {
    return memoryStore[storeName] || [];
}

async function memPut(storeName, data) {
    if (storeName === 'history') {
        const existing = memoryStore.history.findIndex(h => h.id === data.id);
        if (existing >= 0) memoryStore.history[existing] = data;
        else memoryStore.history.push(data);
    } else if (storeName === 'settings') {
        memoryStore.settings[data.key] = data;
    }
}

async function memDelete(storeName, key) {
    if (storeName === 'history') {
        memoryStore.history = memoryStore.history.filter(h => h.id !== key);
    } else if (storeName === 'settings') {
        delete memoryStore.settings[key];
    }
}

async function memClear(storeName) {
    memoryStore[storeName] = storeName === 'history' ? [] : {};
}

async function memGet(storeName, key) {
    if (storeName === 'history') {
        return memoryStore.history.find(h => h.id === key);
    } else if (storeName === 'settings') {
        return memoryStore.settings[key];
    }
}

async function dbGetAll(storeName) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        return memGetAll(storeName);
    }
}

async function dbPut(storeName, data) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(data);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        return memPut(storeName, data);
    }
}

async function dbDelete(storeName, key) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        return memDelete(storeName, key);
    }
}

async function dbClear(storeName) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        return memClear(storeName);
    }
}

async function dbGet(storeName, key) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        return memGet(storeName, key);
    }
}

// ════════════════════════════════════════
// LLM CONFIGURATION & STREAMING
// ════════════════════════════════════════
const LLM_CONFIG = {
    providers: {
        kimi: {
            name: 'Kimi',
            endpoint: 'https://api.kimi.com/coding/v1/chat/completions',
            models: ['kimi-k2.6'],
            defaultModel: 'kimi-k2.6',
            cors: false
        },
        deepseek: {
            name: 'DeepSeek',
            endpoint: 'https://api.deepseek.com/v1/chat/completions',
            models: ['deepseek-v4-pro'],
            defaultModel: 'deepseek-v4-pro',
            cors: false
        },
        openrouter: {
            name: 'OpenRouter',
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            models: ['moonshot-ai/kimi-k2.6', 'deepseek/deepseek-v4-pro'],
            defaultModel: 'moonshot-ai/kimi-k2.6',
            cors: true,
            headers: {
                'HTTP-Referer': window.location.href,
                'X-Title': '易因分析'
            }
        }
    }
};

function buildSystemPrompt(gua, pratitya, scenario, movingYao, changedGua) {
    const phenomenology = state.currentResult?.phenomenology;
    const praxis = state.currentResult?.praxis;
    const contradiction = state.currentResult?.contradiction;
    const stoic = state.currentResult?.stoic;
    
    let prompt = `你是一位融合东西方哲学传统的深度分析师。请基于以下三类哲学分工框架，为用户提供深度解读：\n\n`;
    prompt += `【框架说明】\n`;
    prompt += `- 分析层（现象学）：分析当前情境「是什么」——剥离预设，回到事物本身\n`;
    prompt += `- 推演层（易经+十二因缘）：推演变化规律——时空定位与人性驱动\n`;
    prompt += `- 指导层（马克思主义+斯多葛）：指导如何行动——实践方法论与可控行动\n\n`;
    
    prompt += `## 用户情境\n${scenario}\n\n`;
    
    if (phenomenology) {
        prompt += `## 分析层：现象学 — 当前情境是什么\n`;
        prompt += `- 主要维度：${phenomenology.primary.name}\n`;
        prompt += `  - 含义：${phenomenology.primary.meaning}\n`;
        prompt += `  - 表现：${phenomenology.primary.manifestation}\n`;
        prompt += `  - 突破点：${phenomenology.primary.breakPoint}\n`;
        if (phenomenology.secondary) {
            prompt += `- 次要维度：${phenomenology.secondary.name}\n`;
            prompt += `  - 突破点：${phenomenology.secondary.breakPoint}\n`;
        }
        prompt += `\n`;
    }
    
    prompt += `## 推演层：易经卦象（时空定位）\n`;
    prompt += `- 卦象：${gua.fullname}（${gua.symbol}）\n`;
    prompt += `- 卦义：${gua.meaning}\n`;
    prompt += `- 当前位置：${gua.position}\n`;
    prompt += `- 危险警示：${gua.danger}\n`;
    prompt += `- 转化方向：${gua.transform}\n`;
    if (movingYao) {
        prompt += `- 动爻：第${movingYao}爻\n`;
        if (changedGua) {
            prompt += `- 变卦：${changedGua.fullname}，事物向「${changedGua.phase}」方向演化\n`;
        }
    }
    prompt += `\n`;
    
    prompt += `## 第二层：十二因缘（人性驱动）\n`;
    prompt += `- 主要卡点：${pratitya.primary.name}\n`;
    prompt += `  - 含义：${pratitya.primary.meaning}\n`;
    prompt += `  - 表现：${pratitya.primary.manifestation}\n`;
    prompt += `  - 突破点：${pratitya.primary.breakPoint}\n`;
    if (pratitya.secondary) {
        prompt += `- 次要卡点：${pratitya.secondary.name}\n`;
        prompt += `  - 突破点：${pratitya.secondary.breakPoint}\n`;
    }
    prompt += `\n`;
    
    if (praxis) {
        prompt += `## 指导层：马克思主义实践论（认识方法论）\n`;
        prompt += `- 当前阶段：${praxis.primary.name}\n`;
        prompt += `  - 含义：${praxis.primary.meaning}\n`;
        prompt += `  - 表现：${praxis.primary.manifestation}\n`;
        prompt += `  - 突破点：${praxis.primary.breakPoint}\n`;
        if (praxis.secondary) {
            prompt += `- 次要阶段：${praxis.secondary.name}\n`;
            prompt += `  - 突破点：${praxis.secondary.breakPoint}\n`;
        }
        prompt += `\n`;
    }
    
    if (contradiction) {
        prompt += `## 指导层：马克思主义矛盾论（结构动力学）\n`;
        prompt += `- 主要矛盾：${contradiction.primary.name}\n`;
        prompt += `  - 含义：${contradiction.primary.meaning}\n`;
        prompt += `  - 表现：${contradiction.primary.manifestation}\n`;
        prompt += `  - 突破点：${contradiction.primary.breakPoint}\n`;
        prompt += `  - 辩证法：${contradiction.primary.dialectic}\n`;
        if (contradiction.secondary) {
            prompt += `- 次要维度：${contradiction.secondary.name}\n`;
            prompt += `  - 突破点：${contradiction.secondary.breakPoint}\n`;
        }
        prompt += `\n`;
    }
    
    if (stoic) {
        prompt += `## 指导层：斯多葛学派 — 如何行动\n`;
        prompt += `- 核心原则：${stoic.primary.name}\n`;
        prompt += `  - 含义：${stoic.primary.meaning}\n`;
        prompt += `  - 表现：${stoic.primary.manifestation}\n`;
        prompt += `  - 突破点：${stoic.primary.breakPoint}\n`;
        prompt += `  - 日常练习：${stoic.primary.practice}\n`;
        if (stoic.secondary) {
            prompt += `- 辅助原则：${stoic.secondary.name}\n`;
            prompt += `  - 突破点：${stoic.secondary.breakPoint}\n`;
        }
        prompt += `\n`;
    }
    
    prompt += `## 分析要求\n`;
    prompt += `请用中文撰写深度解读，要求：\n`;
    prompt += `1. **分析层**：从现象学角度，帮助用户剥离预设、回到事物本身\n`;
    prompt += `2. **推演层**：从易经+十二因缘角度，推演系统的能量状态和变化趋势\n`;
    prompt += `3. **指导层**：从马克思主义+斯多葛角度，给出具体可操作的行动建议\n`;
    prompt += `4. **整合**：将三类哲学视角整合为一个有机的整体解读\n`;
    prompt += `5. **行动**：给出3-5条具体可操作的干预建议\n`;
    prompt += `6. 用Markdown格式输出，层次分明\n`;
    prompt += `7. 语言要有洞察力，避免泛泛而谈\n`;
    
    return prompt;
}

function buildUserPrompt(scenario, dim, type) {
    const dimNames = {
        all: '全面分析（现象学 + 易经推演 + 实践指导）',
        phenomenology: '现象学分析 — 当前情境「是什么」',
        yijing: '易经推演 — 变化规律与时空定位',
        buddhism: '十二因缘分析 — 因果链条',
        marxism: '马克思主义分析 — 实践论与矛盾论',
        stoic: '斯多葛哲学 — 行动指导'
    };
    const typeNames = {
        personal: '个人决策',
        relationship: '人际关系',
        business: '商业战略',
        social: '社会现象',
        creative: '创作瓶颈',
        political: '政治博弈'
    };

    let prompt = `你是一位融合东西方哲学传统的深度分析师。请基于以下信息，为用户提供深度解读：\n\n`;
    prompt += `【框架说明】\n`;
    prompt += `- 分析层（现象学）：分析当前情境「是什么」——剥离预设，回到事物本身\n`;
    prompt += `- 推演层（易经+十二因缘）：推演变化规律——时空定位与人性驱动\n`;
    prompt += `- 指导层（马克思主义+斯多葛）：指导如何行动——实践方法论与可控行动\n\n`;
    prompt += `## 用户描述的现象\n${scenario}\n\n`;
    prompt += `## 分析维度\n${dimNames[dim] || dimNames.all}\n\n`;
    if (type && typeNames[type]) {
        prompt += `## 现象类型\n${typeNames[type]}\n\n`;
    }
    prompt += `## 输出格式要求\n`;
    prompt += `请务必按以下两段式结构输出：\n\n`;
    prompt += `### 第一段：整体摘要（必读）\n`;
    prompt += `先用 3-5 句话给出精炼的核心结论，让用户一眼抓住重点：\n`;
    prompt += `- 当前情境的本质是什么\n`;
    prompt += `- 最关键的卡点/矛盾在哪里\n`;
    prompt += `- 最重要的 1-2 条行动建议\n`;
    prompt += `这一段要高度凝练，避免细节，降低阅读成本。\n\n`;
    prompt += `### 第二段：详细分析（按需阅读）\n`;
    prompt += `在摘要之后，再按以下维度展开详细解读：\n`;
    prompt += `1. **分析层（现象学）**：帮助用户剥离预设、回到事物本身\n`;
    prompt += `2. **推演层（易经+十二因缘）**：推演系统的能量状态和变化趋势\n`;
    prompt += `3. **指导层（马克思主义+斯多葛）**：给出具体可操作的行动建议\n`;
    prompt += `4. **整合**：将三类哲学视角整合为一个有机的整体解读\n`;
    prompt += `5. **行动**：给出 3-5 条具体可操作的干预建议\n`;
    prompt += `6. 用 Markdown 格式输出，层次分明\n`;
    prompt += `7. 语言要有洞察力，避免泛泛而谈\n`;

    return prompt;
}

function markdownToHtml(md) {
    return md
        .replace(/^#### (.*$)/gim, '<h4 style="color:var(--accent-400);font-size:14px;margin:14px 0 6px;font-weight:600;">$1</h4>')
        .replace(/^### (.*$)/gim, '<h3 style="color:var(--accent-400);font-size:15px;margin:16px 0 8px;font-weight:600;">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 style="color:var(--accent-300);font-size:17px;margin:20px 0 10px;font-weight:600;">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 style="color:var(--accent-300);font-size:20px;margin:24px 0 12px;font-weight:700;">$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text-primary);">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^- (.*$)/gim, '<li style="margin:4px 0;color:var(--text-secondary);">$1</li>')
        .replace(/^\d+\. (.*$)/gim, '<li style="margin:4px 0;color:var(--text-secondary);">$1</li>')
        .replace(/\n/g, '<br>');
}

// ════════════════════════════════════════
// HTML ESCAPE UTIL
// ════════════════════════════════════════
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Safe DOM accessor
function $(id) { return document.getElementById(id); }
function safeSetHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}
function safeAddClass(id, className) {
    const el = document.getElementById(id);
    if (el) el.classList.add(className);
}
function safeRemoveClass(id, className) {
    const el = document.getElementById(id);
    if (el) el.classList.remove(className);
}
function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
function safeSetValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}



// ════════════════════════════════════════
// STATE MANAGEMENT
// ════════════════════════════════════════
const state = {
    currentView: 'analyze',
    selectedDim: 'all',
    selectedType: null,
    isAnalyzing: false,
    history: [],
    favorites: [],
    currentResult: null,
    currentTags: [],
    draftId: null,
    analysisDepth: 'standard',
    settings: {
        autoSave: true,
        animations: true,
        soundEffects: false,
        compactMode: false,
        llmMode: true,
        llmProvider: 'kimi',
        llmModel: 'kimi-k2.6',
        llmApiKey: ''
    }
};

// ════════════════════════════════════════
// ANALYSIS DEPTH CONFIG
// ════════════════════════════════════════
const analysisDepthConfig = {
    brief: {
        detailLevel: 'brief',
        maxActions: 3,
        showLines: false,
        showChangedGua: false
    },
    standard: {
        detailLevel: 'standard',
        maxActions: 5,
        showLines: true,
        showChangedGua: true
    },
    full: {
        detailLevel: 'full',
        maxActions: 7,
        showLines: true,
        showChangedGua: true
    }
};

function getAnalysisDepth() {
    return state.analysisDepth || 'standard';
}

function cycleAnalysisDepth() {
    const depths = ['brief', 'standard', 'full'];
    const current = getAnalysisDepth();
    const next = depths[(depths.indexOf(current) + 1) % depths.length];
    state.analysisDepth = next;
    const labels = { brief: '简洁', standard: '标准', full: '深度' };
    showToast(`分析深度已切换为「${labels[next]}」`, 'success');
}
async function loadSettings() {
    const saved = await dbGet('settings', 'app_settings');
    if (saved) {
        state.settings = { ...state.settings, ...saved.value };
    }
    applySettings();
}

async function saveSettings() {
    await dbPut('settings', { key: 'app_settings', value: state.settings });
}

function applySettings() {
    document.body.classList.toggle('reduced-motion', !state.settings.animations);
    document.body.classList.toggle('compact-mode', state.settings.compactMode);
}

// ════════════════════════════════════════
// DRAFT AUTO-SAVE
// ════════════════════════════════════════
let draftSaveTimeout;

// ════════════════════════════════════════
// DEBOUNCE UTILITIES
// ════════════════════════════════════════
function debounce(fn, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

const debouncedRenderHistoryView = debounce(renderHistoryView, 200);
const debouncedRenderGuaView = debounce(renderGuaView, 200);
function onScenarioInput() {
    updateCharCount();
    const text = document.getElementById('scenario').value.trim();

    // Analyze button highlight
    const btn = document.getElementById('analyzeBtn');
    if (btn) {
        btn.classList.toggle('has-content', text.length > 0);
    }

    // Auto-save draft
    if (state.settings.autoSave) {
        clearTimeout(draftSaveTimeout);
        draftSaveTimeout = setTimeout(() => {
            saveDraft(text);
        }, 1000);
    }
}

async function saveDraft(text) {
    if (!text) {
        await dbDelete('settings', 'draft');
        return;
    }
    await dbPut('settings', {
        key: 'draft',
        value: {
            text,
            tags: state.currentTags,
            dim: state.selectedDim,
            type: state.selectedType,
            timestamp: Date.now()
        }
    });
}

async function loadDraft() {
    const draft = await dbGet('settings', 'draft');
    if (draft && draft.value) {
        const d = draft.value;
        const age = Date.now() - (d.timestamp || 0);
        // Only restore drafts less than 7 days old
        if (age < 7 * 24 * 60 * 60 * 1000) {
            document.getElementById('scenario').value = d.text || '';
            state.currentTags = d.tags || [];
            state.selectedDim = d.dim || 'all';
            state.selectedType = d.type || null;
            renderTags();
            updateCharCount();
            // Restore dimension selection
            document.querySelectorAll('[data-dim]').forEach(b => {
                b.classList.toggle('selected', b.dataset.dim === state.selectedDim);
            });
            // Restore type selection
            document.querySelectorAll('[data-type]').forEach(b => {
                b.classList.toggle('selected', b.dataset.type === state.selectedType);
            });
        }
    }
}

function clearInput() {
    document.getElementById('scenario').value = '';
    updateCharCount();
    const resultsEl = document.getElementById('results');
    if (resultsEl) resultsEl.classList.remove('active');
    state.currentResult = null;
    state.currentTags = [];
    renderTags();
    dbDelete('settings', 'draft');
}
// ════════════════════════════════════════
const commands = [
    { id: 'new', label: '新建分析', shortcut: '⌘N', icon: '⚡', action: () => { switchView('analyze'); closeCmdPalette(); } },
    { id: 'history', label: '查看历史', shortcut: '⌘H', icon: '📜', action: () => { switchView('history'); closeCmdPalette(); } },
    { id: 'favorites', label: '查看收藏', shortcut: '⌘⇧F', icon: '⭐', action: () => { switchView('favorites'); closeCmdPalette(); } },
    { id: 'gua', label: '六十四卦', shortcut: '⌘1', icon: '☰', action: () => { switchView('gua'); closeCmdPalette(); } },
    { id: 'pratitya', label: '十二因缘', shortcut: '⌘2', icon: '☸', action: () => { switchView('pratitya'); closeCmdPalette(); } },
    { id: 'praxis', label: '实践论', shortcut: '⌘3', icon: '实', action: () => { switchView('praxis'); closeCmdPalette(); } },
    { id: 'contradiction', label: '矛盾论', shortcut: '⌘4', icon: '矛', action: () => { switchView('contradiction'); closeCmdPalette(); } },
    { id: 'share', label: '复制分享链接', shortcut: '⌘⇧S', icon: '🔗', action: () => { shareResult(); closeCmdPalette(); } },
    { id: 'clear', label: '清空输入', shortcut: '⌘⇧X', icon: '🗑️', action: () => { clearInput(); closeCmdPalette(); } },
    { id: 'settings', label: '设置', shortcut: '⌘,', icon: '⚙️', action: () => { openSettings(); closeCmdPalette(); } },
    { id: 'depth', label: '切换分析深度', shortcut: '⌘D', icon: '🔬', action: () => { cycleAnalysisDepth(); closeCmdPalette(); } },
    { id: 'import', label: '导入数据', icon: '📥', action: () => { openImportModal(); closeCmdPalette(); } },
];

function openCmdPalette() {
    document.getElementById('cmdOverlay').classList.add('active');
    document.getElementById('cmdInput').value = '';
    document.getElementById('cmdInput').focus();
    cmdSelectedIndex = 0;
    renderCommands(commands);
}

function closeCmdPalette() {
    document.getElementById('cmdOverlay').classList.remove('active');
}

function filterCommands() {
    const query = document.getElementById('cmdInput').value.toLowerCase();
    const filtered = commands.filter(c => c.label.toLowerCase().includes(query));
    renderCommands(filtered);
}

function renderCommands(cmds) {
    cmdSelectedIndex = 0;
    if (cmds.length === 0) {
        document.getElementById('cmdResults').innerHTML = '<div style="padding:16px;color:var(--text-tertiary);text-align:center;font-size:14px;">无匹配命令</div>';
        return;
    }
    const html = `
        <div class="cmd-section">
            <div class="cmd-section-title">命令</div>
            ${cmds.map((cmd, i) => `
                <div class="cmd-item ${i === 0 ? 'selected' : ''}" data-cmd-index="${i}" onclick="commands.find(c => c.id === '${cmd.id}').action()">
                    <span class="cmd-item-icon">${cmd.icon}</span>
                    <span class="cmd-item-text">${cmd.label}</span>
                    <span class="cmd-item-kbd">${cmd.shortcut}</span>
                </div>
            `).join('')}
        </div>
    `;
    document.getElementById('cmdResults').innerHTML = html;
    // Attach mouseenter for keyboard nav sync
    setTimeout(() => {
        const items = document.querySelectorAll('.cmd-item');
        items.forEach((item, i) => {
            item.addEventListener('mouseenter', () => {
                cmdSelectedIndex = i;
                updateCmdSelection(items);
            });
        });
    }, 0);
}

document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openCmdPalette();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        switchView('analyze');
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault();
        switchView('history');
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        switchView('favorites');
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();
        shareResult();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        openSettings();
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'x') {
        e.preventDefault();
        clearInput();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        cycleAnalysisDepth();
    }
    if (e.key === 'Escape') {
        closeCmdPalette();
        closeSettings();
        closeAnalysisModal();
        const so = document.getElementById('shortcutsOverlay');
        if (so) so.remove();
    }
    if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        if (window.YIYIN_ANIMATIONS) window.YIYIN_ANIMATIONS.openShortcutsHelp();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        switchView('gua');
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault();
        switchView('pratitya');
    }
});

// ════════════════════════════════════════
// VIEW MANAGEMENT
// ════════════════════════════════════════
function switchView(view) {
    const previousView = state.currentView;
    state.currentView = view;

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.querySelector(`[data-nav="${view}"]`);
    if (navItem) navItem.classList.add('active');

    const titles = {
        analyze: '新建分析',
        history: '历史记录',
        favorites: '收藏',
        gua: '六十四卦',
        pratitya: '十二因缘',
        phenomenology: '现象学',
        praxis: '实践论',
        contradiction: '矛盾论',
        stoic: '斯多葛'
    };
    document.getElementById('pageTitle').textContent = titles[view] || '易因';

    const views = ['analyze', 'history', 'favorites', 'gua', 'pratitya', 'phenomenology', 'praxis', 'contradiction', 'stoic'];
    const currentEl = document.getElementById(previousView + 'View');
    
    views.forEach(v => {
        const el = document.getElementById(v + 'View');
        if (el) {
            if (v === view) {
                if (window.YIYIN_ANIMATIONS) {
                    window.YIYIN_ANIMATIONS.transitionView(currentEl && currentEl !== el ? currentEl : null, el);
                } else {
                    el.style.display = 'block';
                }
            } else {
                el.style.display = 'none';
            }
        }
    });

    if (view === 'analyze') showAnalyzeSetup();
    if (view === 'history') { renderHistoryView(); setTimeout(() => window.YIYIN_ANIMATIONS?.animateHistoryCards(), 100); }
    if (view === 'favorites') renderFavoritesView();
    // Knowledge views: trigger render if not yet rendered by IntersectionObserver
    if (view === 'gua' && knowledgeViewRenderers.gua && !knowledgeViewRenderers.gua.rendered) {
        knowledgeViewRenderers.gua.fn(); knowledgeViewRenderers.gua.rendered = true;
    }
    if (view === 'pratitya' && knowledgeViewRenderers.pratitya && !knowledgeViewRenderers.pratitya.rendered) {
        knowledgeViewRenderers.pratitya.fn(); knowledgeViewRenderers.pratitya.rendered = true;
    }
    if (view === 'phenomenology' && knowledgeViewRenderers.phenomenology && !knowledgeViewRenderers.phenomenology.rendered) {
        knowledgeViewRenderers.phenomenology.fn(); knowledgeViewRenderers.phenomenology.rendered = true;
    }
    if (view === 'praxis' && knowledgeViewRenderers.praxis && !knowledgeViewRenderers.praxis.rendered) {
        knowledgeViewRenderers.praxis.fn(); knowledgeViewRenderers.praxis.rendered = true;
    }
    if (view === 'contradiction' && knowledgeViewRenderers.contradiction && !knowledgeViewRenderers.contradiction.rendered) {
        knowledgeViewRenderers.contradiction.fn(); knowledgeViewRenderers.contradiction.rendered = true;
    }
    if (view === 'stoic' && knowledgeViewRenderers.stoic && !knowledgeViewRenderers.stoic.rendered) {
        knowledgeViewRenderers.stoic.fn(); knowledgeViewRenderers.stoic.rendered = true;
    }

    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('open');
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        }
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) {
        if (sidebar.classList.contains('open')) {
            if (window.YIYIN_ANIMATIONS) {
                const overlay = document.querySelector('.sidebar-overlay');
                window.YIYIN_ANIMATIONS.animateSidebarClose(sidebar, overlay);
            } else {
                sidebar.classList.remove('open');
            }
        } else {
            if (window.YIYIN_ANIMATIONS) {
                window.YIYIN_ANIMATIONS.animateSidebarOpen(sidebar);
            } else {
                sidebar.classList.add('open');
            }
        }
    }
}

// ════════════════════════════════════════
// INPUT MANAGEMENT
// ════════════════════════════════════════
function selectDim(el) {
    document.querySelectorAll('[data-dim]').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    state.selectedDim = el.dataset.dim;
    if (state.settings.autoSave) {
        saveDraft(document.getElementById('scenario').value);
    }
}

function selectType(el) {
    const wasSelected = el.classList.contains('selected');
    document.querySelectorAll('[data-type]').forEach(b => b.classList.remove('selected'));
    if (!wasSelected) {
        el.classList.add('selected');
        state.selectedType = el.dataset.type;
    } else {
        state.selectedType = null;
    }
    if (state.settings.autoSave) {
        saveDraft(document.getElementById('scenario').value);
    }
}

function updateCharCount() {
    const count = document.getElementById('scenario').value.length;
    document.getElementById('charCount').textContent = count + ' 字';
}

const examples = [
    "一个AI产品突然爆红，三个月后用户流失殆尽。产品功能很酷，但用户粘性差，团队急于扩张却忽视了核心体验的打磨。",
    "我和伴侣从热恋到冷淡，用了两年时间。开始时每天聊到深夜，后来连一起吃饭都各自刷手机。我不知道是哪里出了问题。",
    "公司新来的CEO大刀阔斧改革，老员工集体抵触，项目推进困难。CEO觉得员工保守，员工觉得CEO不懂业务。",
    "一个社交运动在网络上迅速发酵，万人参与，但两周后热度骤降，参与者散去，好像什么都没发生过。",
    "我在两个工作offer间纠结：一个是稳定的大厂，一个是 risky 的创业公司。大厂安稳但无聊，创业刺激但不确定。"
];

function randomExample() {
    const ex = examples[Math.floor(Math.random() * examples.length)];
    document.getElementById('scenario').value = ex;
    updateCharCount();
    onScenarioInput();
}

// ════════════════════════════════════════
// TAG SYSTEM
// ════════════════════════════════════════
function onTagInput(e) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = e.target.value.trim().replace(',', '');
        if (val && !state.currentTags.includes(val)) {
            state.currentTags.push(val);
            renderTags();
            // Save draft when tags change
            if (state.settings.autoSave) {
                saveDraft(document.getElementById('scenario').value);
            }
        }
        e.target.value = '';
    }
    if (e.key === 'Backspace' && !e.target.value && state.currentTags.length > 0) {
        state.currentTags.pop();
        renderTags();
        if (state.settings.autoSave) {
            saveDraft(document.getElementById('scenario').value);
        }
    }
}

function renderTags() {
    const wrapper = document.getElementById('tagWrapper');
    const tagsHtml = state.currentTags.map(tag => `
        <span class="tag-chip">
            ${escapeHtml(tag)}
            <span class="remove" onclick="removeTag('${escapeHtml(tag)}')">×</span>
        </span>
    `).join('');
    wrapper.innerHTML = tagsHtml + '<input type="text" class="tag-input" id="tagInput" placeholder="添加标签..." onkeydown="onTagInput(event)">';
}

function removeTag(tag) {
    state.currentTags = state.currentTags.filter(t => t !== tag);
    renderTags();
}


// ════════════════════════════════════════
// HISTORY (IndexedDB)
// ════════════════════════════════════════
async function saveToHistory(result) {
    const item = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        scenario: document.getElementById('scenario').value.slice(0, 100),
        gua: result.gua.name,
        guaFull: result.gua.fullname,
        pratitya: result.pratitya.primary.name,
        fullResult: result,
        favorited: false,
        tags: [...state.currentTags]
    };
    await dbPut('history', item);
    state.history.unshift(item);
    if (state.history.length > 200) {
        const toRemove = state.history.pop();
        await dbDelete('history', toRemove.id);
    }
    updateHistoryUI();
    updateFavoritesUI();
}

async function loadHistoryFromDB() {
    const items = await dbGetAll('history');
    items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    state.history = items;
    updateHistoryUI();
    updateFavoritesUI();
}

function updateHistoryUI() {
    document.getElementById('historyCount').textContent = state.history.length;

    const recent = state.history.slice(0, 5);
    const html = recent.map(h => `
        <div class="history-item" onclick="loadHistory(${h.id})">
            <div class="history-title">${escapeHtml(h.scenario) || '未命名分析'}</div>
            <div class="history-meta">
                <span>${h.gua} · ${h.pratitya}</span>
                <span>${new Date(h.timestamp).toLocaleDateString()}</span>
            </div>
        </div>
    `).join('');
    document.getElementById('recentHistory').innerHTML = html || '<div style="padding:8px 12px;color:var(--text-tertiary);font-size:12px;">暂无历史记录</div>';
}

function updateFavoritesUI() {
    const favCount = state.history.filter(h => h.favorited).length;
    document.getElementById('favoritesCount').textContent = favCount;
}

function loadHistory(id) {
    const item = state.history.find(h => h.id === id);
    if (item && item.fullResult) {
        state.currentResult = item.fullResult;
        // Switch to analyze view without calling switchView to avoid flicker
        state.currentView = 'analyze';
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const navItem = document.querySelector('[data-nav="analyze"]');
        if (navItem) navItem.classList.add('active');
        document.getElementById('pageTitle').textContent = '新建分析';
        const views = ['analyze', 'history', 'favorites', 'gua', 'pratitya', 'phenomenology', 'praxis', 'contradiction', 'stoic'];
        views.forEach(v => {
            const el = document.getElementById(v + 'View');
            if (el) el.style.display = v === 'analyze' ? 'block' : 'none';
        });
        showAnalyzeResult();
        renderSavedResult(item.fullResult);
    }
}

function renderSavedResult(result) {
    const streamingEl = document.getElementById('resultStreaming');
    if (!streamingEl) return;
    if (result.llmAnalysis) {
        streamingEl.innerHTML = markdownToHtml(result.llmAnalysis);
    } else {
        streamingEl.innerHTML = '<div class="streaming-placeholder">该记录暂无深度分析内容</div>';
    }
}

async function toggleFavorite(id, event) {
    if (event) event.stopPropagation();
    const item = state.history.find(h => h.id === id);
    if (item) {
        item.favorited = !item.favorited;
        await dbPut('history', item);
        updateFavoritesUI();
        if (state.currentView === 'history') renderHistoryView();
        if (state.currentView === 'favorites') renderFavoritesView();
        showToast(item.favorited ? '已收藏' : '已取消收藏');
    }
}

async function deleteHistory(id, event) {
    if (event) event.stopPropagation();
    state.history = state.history.filter(h => h.id !== id);
    await dbDelete('history', id);
    updateHistoryUI();
    updateFavoritesUI();
    if (state.currentView === 'history') renderHistoryView();
    if (state.currentView === 'favorites') renderFavoritesView();
    showToast('已删除');
}

async function clearAllHistory() {
    if (!confirm('确定要清空所有历史记录吗？')) return;
    state.history = [];
    await dbClear('history');
    updateHistoryUI();
    updateFavoritesUI();
    renderHistoryView();
    showToast('历史记录已清空');
}

function renderHistoryView() {
    const grid = document.getElementById('historyGrid');
    const search = document.getElementById('historySearch')?.value?.toLowerCase() || '';
    let filtered = state.history;

    if (search) {
        filtered = filtered.filter(h =>
            (h.scenario || '').toLowerCase().includes(search) ||
            (h.guaFull || '').toLowerCase().includes(search) ||
            (h.pratitya || '').toLowerCase().includes(search) ||
            (h.tags || []).some(t => t.toLowerCase().includes(search))
        );
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📜</div>
                <div class="empty-title">暂无历史记录</div>
                <div class="empty-desc">进行分析后，结果将自动保存到这里</div>
            </div>
        `;
        return;
    }

    const now = Date.now();
    const groups = [];
    const today = [];
    const yesterday = [];
    const thisWeek = [];
    const older = [];

    filtered.forEach(h => {
        const diff = now - h.timestamp;
        if (diff < 86_400_000) today.push(h);
        else if (diff < 172_800_000) yesterday.push(h);
        else if (diff < 604_800_000) thisWeek.push(h);
        else older.push(h);
    });

    const renderGroup = (title, items) => {
        if (!items.length) return '';
        return `
            <div class="history-group">
                <div class="history-group-title">${title} · ${items.length}项</div>
                <div class="history-group-items">
                    ${items.map(h => `
                        <div class="history-card" onclick="loadHistory(${h.id})">
                            <div class="history-card-header">
                                <div class="history-card-scenario">${escapeHtml(h.scenario) || '未命名分析'}</div>
                                <div class="history-card-actions">
                                    <button class="history-card-action ${h.favorited ? 'favorited' : ''}" onclick="toggleFavorite(${h.id}, event)">
                                        ${h.favorited ? '★' : '☆'}
                                    </button>
                                    <button class="history-card-action" onclick="deleteHistory(${h.id}, event)">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M3 6h18"></path>
                                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div class="history-card-meta">
                                <div class="history-card-tags">
                                    ${(h.tags || []).map(t => `<span class="tag tag-info">${t}</span>`).join('')}
                                </div>
                                <span class="history-card-date">${formatRelativeTime(h.timestamp)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    };

    grid.innerHTML = renderGroup('今天', today) + renderGroup('昨天', yesterday) + renderGroup('本周', thisWeek) + renderGroup('更早', older);
}

function formatRelativeTime(ts) {
    const time = typeof ts === 'string' ? new Date(ts).getTime() : ts;
    const now = Date.now();
    const diff = now - time;
    const d = new Date(time);
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
    if (diff < 172_800_000) return '昨天 ' + d.toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'});
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}天前`;
    return d.toLocaleString('zh-CN');
}

function renderFavoritesView() {
    const grid = document.getElementById('favoritesGrid');
    const favorites = state.history.filter(h => h.favorited);

    if (favorites.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⭐</div>
                <div class="empty-title">暂无收藏</div>
                <div class="empty-desc">在历史记录中点击星标收藏分析</div>
            </div>
        `;
        return;
    }

    grid.innerHTML = favorites.map(h => `
        <div class="history-card" onclick="loadHistory(${h.id})">
            <div class="history-card-header">
                <div class="history-card-scenario">${escapeHtml(h.scenario) || '未命名分析'}</div>
                <div class="history-card-actions">
                    <button class="history-card-action favorited" onclick="toggleFavorite(${h.id}, event)">★</button>
                    <button class="history-card-action" onclick="deleteHistory(${h.id}, event)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="history-card-meta">
                <div class="history-card-tags">
                    <span class="tag tag-yang">${h.guaFull}</span>
                    <span class="tag tag-phase">${h.pratitya}</span>
                    ${(h.tags || []).map(t => `<span class="tag tag-info">${t}</span>`).join('')}
                </div>
                <span class="history-card-date">${new Date(h.timestamp).toLocaleString('zh-CN')}</span>
            </div>
        </div>
    `).join('');
}

// ════════════════════════════════════════
// GUA VIEW
// ════════════════════════════════════════
function renderGuaView() {
    const grid = document.getElementById('guaGrid');
    const search = document.getElementById('guaSearch')?.value?.toLowerCase() || '';
    let guaList = Object.values(guaData);

    if (search) {
        guaList = guaList.filter(g =>
            g.name.includes(search) ||
            g.fullname.includes(search) ||
            g.phase.includes(search)
        );
    }

    grid.innerHTML = guaList.map(g => `
        <div class="gua-card" onclick="showGuaDetail('${g.name}')">
            <div class="gua-card-symbol">${g.symbol}</div>
            <div class="gua-card-name">${g.fullname}</div>
            <div class="gua-card-phase">${g.phase}</div>
        </div>
    `).join('');
}

function showGuaDetail(guaName) {
    const gua = Object.values(guaData).find(g => g.name === guaName);
    if (!gua) return;

    // Build modal content instead of switching view
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'guaDetailModal';
    overlay.innerHTML = `
        <div class="modal" style="max-width:640px;max-height:85vh;overflow:auto;">
            <div class="modal-header">
                <div class="gua-symbol" style="width:48px;height:48px;font-size:24px;">${gua.symbol}</div>
                <div>
                    <h3 style="margin:0">${gua.fullname}</h3>
                    <div style="font-size:13px;color:var(--text-secondary);margin-top:4px;">${gua.nature} · ${gua.phase}</div>
                </div>
                <button class="modal-close" onclick="document.getElementById('guaDetailModal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom:16px;">${gua.keywords.map(k=>`<span class="tag tag-yang">${k}</span>`).join('')}</div>
                <div class="content-block">
                    <h4>卦象释义</h4>
                    <p>${gua.meaning}</p>
                </div>
                <div class="content-block">
                    <h4>当前位置</h4>
                    <p>${gua.position}</p>
                </div>
                <div class="content-block">
                    <h4>危险警示</h4>
                    <p style="color:var(--danger)">${gua.danger}</p>
                </div>
                <div class="content-block">
                    <h4>转化方向</h4>
                    <p style="color:var(--success)">${gua.transform}</p>
                </div>
                <div class="content-block">
                    <h4>六爻启示</h4>
                    <div class="yao-lines">
                        ${gua.lines.map((line, i) => `
                            <div class="yao-line">
                                <span class="yao-label">第${i+1}爻</span>
                                <div class="yao-bar ${i % 2 === 0 ? 'yang' : 'yin'}"></div>
                                <span class="yao-text">${line}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <button class="header-btn" style="width:100%;margin-top:12px;" onclick="useGuaForAnalyze('${gua.name}')">以此卦象新建分析</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function useGuaForAnalyze(guaName) {
    const gua = Object.values(guaData).find(g => g.name === guaName);
    if (!gua) return;
    document.getElementById('guaDetailModal')?.remove();
    const result = {
        gua,
        pratitya: { primary: { name: '点击查看详细分析', key: 'avidya' }, secondary: null, chain: [] },
        cross: '点击「新建分析」输入场景进行完整分析',
        actions: [],
        scenario: gua.fullname,
        timestamp: Date.now()
    };
    state.currentResult = result;
    renderResult(result);
    switchView('analyze');
    showToast(`已选择 ${gua.fullname}`);
}

// ════════════════════════════════════════
// PRATITYA VIEW
// ════════════════════════════════════════
function renderPratityaView() {
    const chain = document.getElementById('pratityaChain');
    const nodes = Object.entries(pratityaData);

    chain.innerHTML = nodes.map(([key, node], i) => `
        <div class="pratitya-node-large visible">
            <div class="pratitya-node-num ${node.color}">${i + 1}</div>
            <div class="pratitya-node-info">
                <div class="pratitya-node-name">${node.name}</div>
                <div class="pratitya-node-meaning">${node.meaning}</div>
            </div>
        </div>
        ${i < nodes.length - 1 ? '<div class="pratitya-arrow-down">↓</div>' : ''}
    `).join('');
}

function shareResult() {
    if (!state.currentResult) {
        showToast('请先进行分析');
        return;
    }

    // Generate shareable URL with encoded result (三类分工完整数据)
    try {
        const r = state.currentResult;
        const shareData = {
            s: r.scenario.slice(0, 200),
            // 推演层
            g: r.gua.name,
            p: r.pratitya.primary.key,
            // 分析层
            ph: r.phenomenology.primary.key,
            // 指导层
            px: r.praxis.primary.key,
            c: r.contradiction.primary.key,
            st: r.stoic.primary.key,
            t: Date.now()
        };
        const encoded = btoa(encodeURIComponent(JSON.stringify(shareData)));
        const shareUrl = `${window.location.origin}${window.location.pathname}#share=${encoded}`;

        navigator.clipboard.writeText(shareUrl).then(() => {
            showToast('分享链接已复制到剪贴板');
        }).catch(() => {
            // Fallback: 文本摘要包含三类分工
            const text = `【易因分析】\n分析层：${r.phenomenology.primary.name}\n推演层：${r.gua.fullname} · ${r.pratitya.primary.name}\n指导层：${r.praxis.primary.name} · ${r.contradiction.primary.name} · ${r.stoic.primary.name}\n\n${r.cross}`;
            navigator.clipboard.writeText(text).then(() => {
                showToast('分析摘要已复制（链接生成失败）');
            });
        });
    } catch (e) {
        const r = state.currentResult;
        const text = `【易因分析】\n分析层：${r.phenomenology.primary.name}\n推演层：${r.gua.fullname} · ${r.pratitya.primary.name}\n指导层：${r.praxis.primary.name} · ${r.contradiction.primary.name} · ${r.stoic.primary.name}\n\n${r.cross}`;
        navigator.clipboard.writeText(text).then(() => {
            showToast('分析摘要已复制到剪贴板');
        });
    }
}

// ════════════════════════════════════════
// SETTINGS MODAL
// ════════════════════════════════════════
function openSettings() {
    document.getElementById('settingsOverlay').classList.add('active');
    // Sync checkbox states
    document.getElementById('settingAutoSave').checked = state.settings.autoSave;
    document.getElementById('settingAnimations').checked = state.settings.animations;
    document.getElementById('settingCompactMode').checked = state.settings.compactMode;

    // Sync LLM config
    const providerSelect = document.getElementById('llmProviderSelect');
    if (providerSelect) providerSelect.value = state.settings.llmProvider || 'kimi';
    const apiKeyInput = document.getElementById('llmApiKeyInput');
    if (apiKeyInput) apiKeyInput.value = state.settings.llmApiKey || '';
}

function changeLlmProvider(provider) {
    state.settings.llmProvider = provider;
    state.settings.llmModel = LLM_CONFIG.providers[provider].defaultModel;
    saveSettings();
    showToast(`已切换到 ${LLM_CONFIG.providers[provider].name}`);
}

function saveLlmApiKey(key) {
    state.settings.llmApiKey = key.trim();
    saveSettings();
}

// ════════════════════════════════════════
// LLM STREAMING WITH ABORTCONTROLLER
// ════════════════════════════════════════
let currentLlmAbortController = null;

async function streamLLM(prompt, onChunk, onDone, onError) {
    // Cancel any ongoing request
    if (currentLlmAbortController) {
        currentLlmAbortController.abort();
        currentLlmAbortController = null;
    }
    
    const abortController = new AbortController();
    currentLlmAbortController = abortController;
    
    const provider = state.settings.llmProvider || 'kimi';
    const apiKey = state.settings.llmApiKey;
    const config = LLM_CONFIG.providers[provider];

    if (!config) {
        onError('未知的 LLM 提供商: ' + provider);
        return;
    }

    if (!apiKey) {
        onError('请先输入 API Key');
        return;
    }

    try {
        const useLocalProxy = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const endpoint = useLocalProxy ? '/api/llm/chat' : config.endpoint;
        console.log('[LLM] endpoint:', endpoint, 'provider:', provider, 'useLocalProxy:', useLocalProxy);
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };
        if (useLocalProxy) {
            headers['X-LLM-Provider'] = provider;
        } else if (config.headers) {
            Object.assign(headers, config.headers);
        }
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            signal: abortController.signal,
            body: JSON.stringify({
                model: state.settings.llmModel || config.defaultModel,
                messages: [
                    { role: 'system', content: '你是一位融合东西方哲学传统的深度分析师。' },
                    { role: 'user', content: prompt }
                ],
                stream: true,
                max_tokens: 4000
            })
        });
        console.log('[LLM] response status:', response.status, 'ok:', response.ok);

        if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            console.error('[LLM] response error text:', errText);
            if (useLocalProxy && response.status === 404) {
                onError('本地 AI 代理没有启动。请用 node server.mjs 打开项目，而不是普通静态服务器。');
                return;
            }
            onError(`API 错误 (${response.status}): ${errText}`);
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let hasReceivedChunk = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete last line

            for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    console.log('[LLM] SSE data:', data.substring(0, 200));
                    if (data === '[DONE]') {
                        console.log('[LLM] [DONE] received, hasReceivedChunk:', hasReceivedChunk);
                        if (hasReceivedChunk) {
                            onDone();
                        } else {
                            onError('AI 返回了空响应，请检查 API Key 是否有效，或尝试切换模型提供商');
                        }
                        currentLlmAbortController = null;
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        const chunk = parsed.choices?.[0]?.delta?.content || '';
                        console.log('[LLM] chunk:', chunk);
                        if (chunk) {
                            hasReceivedChunk = true;
                            onChunk(chunk);
                        }
                    } catch (e) {
                        console.error('[LLM] parse error:', e, 'data:', data.substring(0, 200));
                    }
                }
            }
        }

        console.log('[LLM] stream ended, hasReceivedChunk:', hasReceivedChunk);
        if (hasReceivedChunk) {
            onDone();
        } else {
            onError('AI 返回了空响应，请检查 API Key 是否有效，或尝试切换模型提供商');
        }
        currentLlmAbortController = null;
    } catch (err) {
        currentLlmAbortController = null;
        if (err.name === 'AbortError') {
            // User cancelled or new request started — silent return
            return;
        }
        if (err.message?.includes('Load failed') || err.message?.includes('Failed to fetch')) {
            onError('网络连接失败。请确认本地 AI 代理已启动、网络可用，并检查 API Key。');
        } else {
            onError(err.message || '网络请求失败');
        }
    }
}

async function testLlmConnection() {
    const provider = state.settings.llmProvider || 'kimi';
    const apiKey = state.settings.llmApiKey;
    if (!apiKey) {
        showToast('请先输入 API Key', 'error');
        return;
    }
    showToast('正在测试连接...');
    try {
        const config = LLM_CONFIG.providers[provider];
        const useLocalProxy = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const endpoint = useLocalProxy ? '/api/llm/chat' : config.endpoint;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };
        if (useLocalProxy) {
            headers['X-LLM-Provider'] = provider;
        } else if (config.headers) {
            Object.assign(headers, config.headers);
        }
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: state.settings.llmModel || config.defaultModel,
                messages: [{ role: 'user', content: '你好' }],
                max_tokens: 5
            })
        });
        if (response.ok) {
            showToast('连接成功！', 'success');
        } else {
            const err = await response.text();
            showToast(`连接失败: ${response.status}`, 'error');
        }
    } catch (err) {
        if (err.message?.includes('Load failed') || err.message?.includes('Failed to fetch')) {
            showToast('连接失败: 请确认本地 AI 代理已启动，并检查网络和 API Key', 'error');
        } else {
            showToast(`连接失败: ${err.message}`, 'error');
        }
    }
}

function closeSettings() {
    document.getElementById('settingsOverlay').classList.remove('active');
}

function toggleSetting(key, value) {
    state.settings[key] = value;
    saveSettings();
    applySettings();
    
    showToast('设置已保存');
}

async function clearAllData() {
    if (!confirm('确定要清除所有数据吗？此操作不可恢复。')) return;
    await dbClear('history');
    await dbClear('settings');
    state.history = [];
    updateHistoryUI();
    updateFavoritesUI();
    showToast('所有数据已清除');
    closeSettings();
}

// ════════════════════════════════════════
// IMPORT DATA
// ════════════════════════════════════════
function openImportModal() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data.history || !Array.isArray(data.history)) {
                showToast('无效的数据文件', 'error');
                return;
            }
            let imported = 0;
            for (const item of data.history) {
                if (item.scenario && item.timestamp) {
                    await dbPut('history', item);
                    imported++;
                }
            }
            if (data.settings && Array.isArray(data.settings)) {
                for (const s of data.settings) {
                    await dbPut('settings', s);
                }
            }
            await loadHistoryFromDB();
            updateHistoryUI();
            updateFavoritesUI();
            showToast(`成功导入 ${imported} 条记录`);
        } catch (err) {
            showToast('导入失败：文件格式错误', 'error');
        }
    };
    input.click();
}

// ════════════════════════════════════════
// ANALYSIS DEPTH (deprecated — now defined at top of file)
// ════════════════════════════════════════
function handleShareUrl() {
    const hash = window.location.hash;
    if (hash.startsWith('#share=')) {
        try {
            const encoded = hash.slice(7);
            const shareData = JSON.parse(decodeURIComponent(atob(encoded)));
            if (shareData.s) {
                document.getElementById('scenario').value = shareData.s;
                updateCharCount();
                
                // 辅助函数：构建分析结果对象
                const buildResult = (guaName, pratityaKey, phenomKey, praxisKey, contraKey, stoicKey) => {
                    const gua = guaData[guaName] || guaData['qian'];
                    const pratitya = {
                        primary: { ...pratityaData[pratityaKey || 'avidya'], key: pratityaKey || 'avidya' },
                        secondary: null,
                        chain: Object.keys(pratityaData).map(key => ({
                            key, data: pratityaData[key],
                            isPrimary: key === (pratityaKey || 'avidya'),
                            isSecondary: false
                        }))
                    };
                    const phenomenology = {
                        primary: { ...phenomenologyData[phenomKey || 'epoché'], key: phenomKey || 'epoché' },
                        secondary: null,
                        chain: Object.keys(phenomenologyData).map(key => ({
                            key, data: phenomenologyData[key],
                            isPrimary: key === (phenomKey || 'epoché'),
                            isSecondary: false
                        }))
                    };
                    const praxis = {
                        primary: { ...praxisData[praxisKey || 'perceptual'], key: praxisKey || 'perceptual' },
                        secondary: null,
                        chain: Object.keys(praxisData).map(key => ({
                            key, data: praxisData[key],
                            isPrimary: key === (praxisKey || 'perceptual'),
                            isSecondary: false
                        }))
                    };
                    const contradiction = {
                        primary: { ...contradictionData[contraKey || 'universality'], key: contraKey || 'universality' },
                        secondary: null,
                        matrix: null
                    };
                    const stoic = {
                        primary: { ...stoicData[stoicKey || 'dichotomy'], key: stoicKey || 'dichotomy' },
                        secondary: null,
                        matrix: null
                    };
                    const cross = crossAnalysis4D(gua, pratitya, praxis, contradiction, phenomenology, stoic);
                    return {
                        phenomenology, gua, pratitya,
                        praxis, contradiction, stoic,
                        cross, actions: generateActions(gua, pratitya, null),
                        scenario: shareData.s,
                        timestamp: shareData.t || Date.now()
                    };
                };
                
                const result = buildResult(
                    shareData.g, shareData.p,
                    shareData.ph, shareData.px, shareData.c, shareData.st
                );
                state.currentResult = result;
                renderResult(result);
                showToast('已加载分享的分析');
                // Clear the hash
                history.replaceState(null, '', window.location.pathname + window.location.search);
            }
        } catch (e) {
            // Silent fail for invalid share URLs
            showToast('分享链接无效或已过期', 'error');
        }
    }
}

// ════════════════════════════════════════
function showToast(msg, type = 'info') {
    if (window.YIYIN_ANIMATIONS) {
        window.YIYIN_ANIMATIONS.enqueueToast(msg, type);
        return;
    }
    // Fallback — stack toasts vertically
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span>${escapeHtml(msg)}</span>
        <div class="toast-progress"></div>
    `;
    container.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(-50%) translateY(0)';
        toast.style.opacity = '1';
    });
    
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(10px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ════════════════════════════════════════
// DATA REFERENCES (loaded from data/*.js)
// ════════════════════════════════════════
// guaData, guaPatterns — data/guaData.js
// pratityaData, pratityaPatterns — data/pratityaData.js
// praxisData, praxisPatterns — data/praxisData.js
// contradictionData, contradictionPatterns, contradictionMatrix — data/contradictionData.js

// ════════════════════════════════════════
// MATCH FUNCTIONS (gua, pratitya)
// ════════════════════════════════════════

function matchGua(scenario, type) {
    const text = scenario.toLowerCase();
    let scores = {};
    for (let key in guaData) scores[key] = 0;
    for (let gua in guaPatterns) {
        guaPatterns[gua].forEach(kw => { if (text.includes(kw)) scores[gua] += 1; });
    }
    const typeBoost = {
        personal: ['qian', 'kun', 'tai', 'pi', 'fu'],
        relationship: ['xian', 'heng', 'jiaren', 'kui', 'tongren'],
        business: ['dayou', 'sheng', 'yi2', 'sun', 'bi_gua'],
        social: ['tongren', 'cui', 'bi_gua', 'song', 'shi'],
        creative: ['qian', 'bi2', 'ge', 'feng', 'daxu'],
        political: ['shi', 'song', 'guai', 'gou', 'mingyi']
    };
    if (type && typeBoost[type]) {
        typeBoost[type].forEach(k => { if (scores[k] !== undefined) scores[k] += 0.5; });
    }
    let sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    let primary = sorted[0][0];
    return guaData[primary];
}

function matchPratitya(scenario, type) {
    const text = scenario.toLowerCase();
    let scores = {};
    for (let key in pratityaData) scores[key] = 0;
    for (let node in pratityaPatterns) {
        pratityaPatterns[node].forEach(kw => { if (text.includes(kw)) scores[node] += 1; });
    }
    const typeBoost = {
        personal: ['avidya', 'samskara', 'bhava', 'jati'],
        relationship: ['trishna', 'upadana', 'sparsha', 'vedana'],
        business: ['vijnana', 'samskara', 'bhava', 'namarupa'],
        social: ['sadayatana', 'sparsha', 'vedana', 'trishna'],
        creative: ['samskara', 'vijnana', 'namarupa', 'vedana'],
        political: ['avidya', 'trishna', 'upadana', 'bhava']
    };
    if (type && typeBoost[type]) {
        typeBoost[type].forEach(k => { if (scores[k] !== undefined) scores[k] += 0.5; });
    }
    let sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    let primary = sorted[0][0];
    let secondary = sorted[1] && sorted[1][1] > 0 ? sorted[1][0] : null;
    return {
        primary: { ...pratityaData[primary], key: primary },
        secondary: secondary ? { ...pratityaData[secondary], key: secondary } : null,
        chain: Object.keys(pratityaData).map(key => ({
            key, data: pratityaData[key],
            isPrimary: key === primary,
            isSecondary: key === secondary
        }))
    };
}

// ════════════════════════════════════════
// MARXIST ANALYSIS ENGINE v4.2
// ════════════════════════════════════════

function matchPraxis(scenario, type) {
    const text = scenario.toLowerCase();
    let scores = {};
    for (let key in praxisData) scores[key] = 0;
    for (let stage in praxisPatterns) {
        praxisPatterns[stage].forEach(kw => { if (text.includes(kw)) scores[stage] += 1; });
    }
    const typeBoost = {
        personal: ['perceptual', 'reflection', 'new_practice'],
        relationship: ['perceptual', 'practice', 'reflection'],
        business: ['rational', 'practice', 'new_practice'],
        social: ['practice', 'reflection', 'new_practice'],
        creative: ['perceptual', 'rational', 'new_practice'],
        political: ['rational', 'practice', 'reflection']
    };
    if (type && typeBoost[type]) {
        typeBoost[type].forEach(k => { if (scores[k] !== undefined) scores[k] += 0.5; });
    }
    if (type && praxisMatrix[type]) {
        const matrix = praxisMatrix[type];
        if (scores[matrix.primary] !== undefined) scores[matrix.primary] += 1;
        if (scores[matrix.secondary] !== undefined) scores[matrix.secondary] += 0.5;
    }
    let sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    let primary = sorted[0][0];
    let secondary = sorted[1] && sorted[1][1] > 0 ? sorted[1][0] : null;
    return {
        primary: { ...praxisData[primary], key: primary },
        secondary: secondary ? { ...praxisData[secondary], key: secondary } : null,
        chain: Object.keys(praxisData).map(key => ({
            key, data: praxisData[key],
            isPrimary: key === primary,
            isSecondary: key === secondary
        }))
    };
}

function matchContradiction(scenario, type) {
    const text = scenario.toLowerCase();
    let scores = {};
    for (let key in contradictionData) scores[key] = 0;
    for (let dim in contradictionPatterns) {
        contradictionPatterns[dim].forEach(kw => { if (text.includes(kw)) scores[dim] += 1; });
    }
    if (type && contradictionMatrix[type]) {
        const matrix = contradictionMatrix[type];
        if (scores[matrix.primary] !== undefined) scores[matrix.primary] += 1;
        if (scores[matrix.secondary] !== undefined) scores[matrix.secondary] += 0.5;
    }
    let sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    let primary = sorted[0][0];
    let secondary = sorted[1] && sorted[1][1] > 0 ? sorted[1][0] : null;
    return {
        primary: { ...contradictionData[primary], key: primary },
        secondary: secondary ? { ...contradictionData[secondary], key: secondary } : null,
        matrix: type && contradictionMatrix[type] ? contradictionMatrix[type] : null
    };
}


function matchPhenomenology(scenario, type) {
    const text = scenario.toLowerCase();
    let scores = {};
    for (let key in phenomenologyData) scores[key] = 0;
    for (let dim in phenomenologyPatterns) {
        phenomenologyPatterns[dim].forEach(kw => { if (text.includes(kw)) scores[dim] += 1; });
    }
    const typeBoost = {
        personal: ['epoché', 'noesis', 'lifeworld'],
        relationship: ['noesis', 'noema', 'intersubjectivity'],
        business: ['epoché', 'lifeworld', 'intersubjectivity'],
        social: ['lifeworld', 'intersubjectivity', 'noema'],
        creative: ['noesis', 'noema', 'epoché'],
        political: ['lifeworld', 'intersubjectivity', 'epoché']
    };
    if (type && typeBoost[type]) {
        typeBoost[type].forEach(k => { if (scores[k] !== undefined) scores[k] += 0.5; });
    }
    if (type && phenomenologyMatrix[type]) {
        const matrix = phenomenologyMatrix[type];
        if (scores[matrix.primary] !== undefined) scores[matrix.primary] += 1;
        if (scores[matrix.secondary] !== undefined) scores[matrix.secondary] += 0.5;
    }
    let sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    let primary = sorted[0][0];
    let secondary = sorted[1] && sorted[1][1] > 0 ? sorted[1][0] : null;
    return {
        primary: { ...phenomenologyData[primary], key: primary },
        secondary: secondary ? { ...phenomenologyData[secondary], key: secondary } : null,
        chain: Object.keys(phenomenologyData).map(key => ({
            key, data: phenomenologyData[key],
            isPrimary: key === primary,
            isSecondary: key === secondary
        }))
    };
}

function matchStoic(scenario, type) {
    const text = scenario.toLowerCase();
    let scores = {};
    for (let key in stoicData) scores[key] = 0;
    for (let practice in stoicPatterns) {
        stoicPatterns[practice].forEach(kw => { if (text.includes(kw)) scores[practice] += 1; });
    }
    if (type && stoicMatrix[type]) {
        const matrix = stoicMatrix[type];
        if (scores[matrix.primary] !== undefined) scores[matrix.primary] += 1;
        if (scores[matrix.secondary] !== undefined) scores[matrix.secondary] += 0.5;
    }
    let sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    let primary = sorted[0][0];
    let secondary = sorted[1] && sorted[1][1] > 0 ? sorted[1][0] : null;
    return {
        primary: { ...stoicData[primary], key: primary },
        secondary: secondary ? { ...stoicData[secondary], key: secondary } : null,
        matrix: type && stoicMatrix[type] ? stoicMatrix[type] : null
    };
}

// ════════════════════════════════════════
// MOVING YAO & CHANGED GUA
// ════════════════════════════════════════
function determineMovingYao(scenario) {
    // Deterministic moving yao based on scenario text hash
    let hash = 0;
    for (let i = 0; i < scenario.length; i++) {
        hash = ((hash << 5) - hash) + scenario.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) % 6 + 1; // 1-6
}

function calculateChangedGua(gua, movingYao) {
    if (!gua || !gua.lines || !movingYao) return null;
    // Flip the moving yao line: yang (9) -> yin (6), yin (6) -> yang (9)
    const changedLines = gua.lines.map((line, idx) => {
        if (idx + 1 === movingYao) {
            return line === 9 ? 6 : 9;
        }
        return line;
    });
    // Find matching gua in guaData by lines
    for (let key in guaData) {
        const candidate = guaData[key];
        if (candidate.lines && candidate.lines.length === 6) {
            const match = candidate.lines.every((l, i) => l === changedLines[i]);
            if (match) return candidate;
        }
    }
    return null;
}

function crossAnalysis4D(gua, pratitya, praxis, contradiction, phenomenology, stoic) {
    const key = `${gua.name}-${pratitya.primary.key}-${praxis.primary.key}-${contradiction.primary.key}-${phenomenology ? phenomenology.primary.key : 'none'}-${stoic ? stoic.primary.key : 'none'}`;
    const templates = [
        `${gua.fullname}的${gua.phase}状态揭示：当前处于${praxis.primary.name}阶段，核心矛盾是${contradiction.primary.name}。${pratitya.primary.name}的卡点使${praxis.primary.breakPoint}受阻，而${contradiction.primary.dialectic}提示突破方向。${phenomenology ? '现象学视角：' + phenomenology.primary.name + '提醒我们' + phenomenology.primary.breakPoint + '。' : ''}${stoic ? '斯多葛行动：以' + stoic.primary.name + '为锚，' + stoic.primary.breakPoint + '。' : ''}`,
        `从${gua.nature}的能量态看，${praxis.primary.name}是主要认知特征；从人性层面看，${pratitya.primary.name}构成驱动惯性；从矛盾论看，${contradiction.primary.name}决定发展方向。${phenomenology ? '现象学层面：' + phenomenology.primary.manifestation + '。' : ''}${stoic ? '行动层面：' + stoic.primary.practice + '。' : ''}三者的共振点在于：${gua.transform}。`,
        `${gua.fullname}提示${gua.danger}，而${praxis.primary.name}阶段的${pratitya.primary.manifestation}加剧了${contradiction.primary.manifestation}。突破需同时满足：${pratitya.primary.breakPoint}、${praxis.primary.breakPoint}、${contradiction.primary.breakPoint}。${phenomenology && phenomenology.primary.questions ? '同时回到事物本身：' + phenomenology.primary.questions[0] : ''}${stoic && stoic.primary.practice ? '并以斯多葛原则自持：' + stoic.primary.practice : ''}`
    ];
    const hash = key.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return templates[hash % templates.length];
}

function generateStoicActions(stoic, config) {
    const actions = [];
    actions.push({
        title: "斯多葛行动原则",
        desc: config.detailLevel === 'brief'
            ? `核心原则：${stoic.primary.name}。${stoic.primary.breakPoint}。`
            : `斯多葛分析显示，${stoic.primary.name}是当前最适用的行动原则。${stoic.primary.meaning}具体表现为：${stoic.primary.manifestation}。突破点：${stoic.primary.breakPoint}。`
    });
    if (stoic.secondary && config.detailLevel !== 'brief') {
        actions.push({
            title: "辅助原则",
            desc: `次要原则「${stoic.secondary.name}」也需关注。${stoic.secondary.breakPoint}。`
        });
    }
    if (stoic.matrix && config.detailLevel === 'full') {
        actions.push({
            title: "场景指引",
            desc: stoic.matrix.desc
        });
    }
    return actions;
}

function generatePraxisActions(praxis, config) {
    const actions = [];
    actions.push({
        title: "认知定位",
        desc: config.detailLevel === 'brief'
            ? `当前处于「${praxis.primary.name}」阶段。${praxis.primary.breakPoint}。`
            : `实践论分析显示，当前处于${praxis.primary.name}阶段。${praxis.primary.meaning}具体表现为：${praxis.primary.manifestation}。突破点：${praxis.primary.breakPoint}。`
    });
    if (praxis.secondary && config.detailLevel !== 'brief') {
        actions.push({
            title: "认知辅助",
            desc: `次要阶段「${praxis.secondary.name}」也需关注。${praxis.secondary.breakPoint}。`
        });
    }
    return actions;
}

function generateContradictionActions(contradiction, config) {
    const actions = [];
    actions.push({
        title: "矛盾定位",
        desc: config.detailLevel === 'brief'
            ? `核心矛盾：${contradiction.primary.name}。${contradiction.primary.breakPoint}。`
            : `矛盾论分析显示，${contradiction.primary.name}是当前主要矛盾。${contradiction.primary.meaning}具体表现为：${contradiction.primary.manifestation}。突破点：${contradiction.primary.breakPoint}。`
    });
    if (contradiction.secondary && config.detailLevel !== 'brief') {
        actions.push({
            title: "矛盾辅助",
            desc: `次要维度「${contradiction.secondary.name}」也需关注。${contradiction.secondary.breakPoint}。`
        });
    }
    if (contradiction.matrix && config.detailLevel === 'full') {
        actions.push({
            title: "场景矩阵",
            desc: contradiction.matrix.desc
        });
    }
    return actions;
}

// ════════════════════════════════════════
// UPDATED ANALYZE — Four-Layer Analysis
// ════════════════════════════════════════


function crossAnalysis(gua, pratitya) {
    const key = `${gua.name}-${pratitya.primary.key}`;
    if (crossAnalysisDB[key]) {
        return crossAnalysisDB[key];
    }
    // Generate dynamic cross-analysis for uncovered combinations
    const templates = [
        `${gua.fullname}的${gua.phase}状态与「${pratitya.primary.name}」的卡点形成共振：${gua.danger}，而人性层面的${pratitya.primary.manifestation}加剧了这一困境。`,
        `从卦象看，${gua.fullname}提示${gua.transform}；从十二因缘看，${pratitya.primary.name}意味着${pratitya.primary.meaning}。两者的交集在于：${gua.nature}的能量态与${pratitya.primary.name}的惯性相互强化。`,
        `${gua.fullname}处于${gua.phase}阶段，此时最容易触发${pratitya.primary.name}的卡点。${pratitya.primary.inDecision}，而卦象的警示是：${gua.danger}。`,
        `这是一个${gua.nature}与${pratitya.primary.name}交织的局面。${gua.meaning}然而，${pratitya.primary.manifestation}使事情变得复杂。突破点在于：${pratitya.primary.breakPoint}，同时${gua.transform}。`
    ];
    // Deterministic selection based on hash of key
    const hash = key.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return templates[hash % templates.length];
}

function generateActions(gua, pratitya, changedGua) {
    const depth = getAnalysisDepth();
    const config = analysisDepthConfig[depth];
    const actions = [];

    actions.push({
        title: "状态调节",
        desc: config.detailLevel === 'brief'
            ? `当前处于「${gua.phase}」态，${gua.transform}。`
            : `当前卦象为${gua.fullname}，处于「${gua.phase}」阶段。${gua.meaning} ${gua.transform}。`
    });

    actions.push({
        title: "断点干预",
        desc: config.detailLevel === 'brief'
            ? `「${pratitya.primary.name}」是主要卡点。${pratitya.primary.breakPoint}。`
            : `十二因缘链中，「${pratitya.primary.name}」是主要卡点。${pratitya.primary.meaning}具体表现为：${pratitya.primary.manifestation}。突破点在于：${pratitya.primary.breakPoint}。`
    });

    if (pratitya.secondary && config.detailLevel !== 'brief') {
        actions.push({
            title: "辅助干预",
            desc: `次要卡点「${pratitya.secondary.name}」也需关注。${pratitya.secondary.breakPoint}。`
        });
    }

    if (changedGua && config.showChangedGua) {
        actions.push({
            title: "变卦启示",
            desc: config.detailLevel === 'full'
                ? `第${state.currentResult?.movingYao || '?'}爻动，变卦为${changedGua.fullname}。事物将向「${changedGua.phase}」方向演化。${changedGua.meaning} 提示：${changedGua.transform}`
                : `变卦${changedGua.fullname}提示事物将向「${changedGua.phase}」方向发展。`
        });
    }

    if (config.detailLevel === 'full') {
        actions.push({
            title: "情境觉察",
            desc: `在决策层面，${pratitya.primary.inDecision}。留意${gua.danger}。`
        });
    }

    actions.push({
        title: "交叉策略",
        desc: config.detailLevel === 'brief'
            ? `在${gua.name}卦提示的方向上，带着对${pratitya.primary.name}的觉知行动。`
            : `从${gua.name}卦看，${gua.transform}；从十二因缘看，需在「${pratitya.primary.name}」处建立觉察。两者结合：在${gua.name}卦提示的转化方向上，带着对${pratitya.primary.name}的觉知行动。`
    });

    return actions.slice(0, config.maxActions);
}

// ════════════════════════════════════════
// RENDER RESULTS v4.1 — Depth-aware, copy buttons
// ════════════════════════════════════════

function analyze() {
    const scenario = document.getElementById('scenario').value.trim();
    if (!scenario) {
        showToast('请先描述你想分析的现象');
        return;
    }

    state.currentResult = {
        ...(state.currentResult || {}),
        scenario,
        timestamp: Date.now(),
        llmAnalysis: ''
    };

    runLocalAnalysis(scenario);
    const hasLlmKey = !!(state.settings.llmApiKey || '').trim();
    const provider = state.settings.llmProvider || 'kimi';
    const config = LLM_CONFIG.providers[provider];

    showAnalyzeResult();
    renderAiResultShell(scenario);

    if (!hasLlmKey) {
        renderAnalysisNotice('请先在设置中输入 API Key。浏览器直连推荐使用 OpenRouter。', 'warning');
        return;
    }

    if (!config) {
        renderAnalysisNotice('当前模型提供商不可用，请在设置中重新选择。', 'error');
        return;
    }

    streamLlmToResults(scenario, state.selectedDim, state.selectedType);
}

function showAnalyzeResult() {
    const setup = document.getElementById('analyzeSetup');
    const results = document.getElementById('results');
    const toolbar = document.getElementById('resultToolbar');
    if (setup) setup.classList.add('hidden');
    if (results) results.classList.add('active');
    if (toolbar) toolbar.style.display = 'flex';
}

function showAnalyzeSetup() {
    const setup = document.getElementById('analyzeSetup');
    const results = document.getElementById('results');
    const toolbar = document.getElementById('resultToolbar');
    const streaming = document.getElementById('resultStreaming');
    if (setup) setup.classList.remove('hidden');
    if (results) results.classList.remove('active');
    if (toolbar) toolbar.style.display = 'none';
    if (streaming) streaming.innerHTML = '';
    // Abort any ongoing LLM request
    if (currentLlmAbortController) {
        currentLlmAbortController.abort();
        currentLlmAbortController = null;
    }
}

function streamLlmToResults(scenario, dim, type) {
    const streamingEl = document.getElementById('llmContent') || document.getElementById('resultStreaming');
    if (!streamingEl) return;

    streamingEl.innerHTML = '<div class="streaming-placeholder">正在连接 AI 分析师...</div>';

    const prompt = buildUserPrompt(scenario, dim, type);
    let fullText = '';
    let isFirstChunk = true;

    console.log('[streamLlmToResults] starting, streamingEl:', streamingEl?.id);
    streamLLM(prompt,
        (chunk) => {
            console.log('[streamLlmToResults] onChunk:', chunk.substring(0, 50));
            if (isFirstChunk) {
                streamingEl.innerHTML = '';
                isFirstChunk = false;
                const phaseTag = document.querySelector('#llmResultCard .tag-phase');
                if (phaseTag) phaseTag.textContent = '生成中';
            }
            fullText += chunk;
            streamingEl.innerHTML = markdownToHtml(fullText);
            streamingEl.scrollTop = streamingEl.scrollHeight;
        },
        () => {
            console.log('[streamLlmToResults] onDone');
            if (!state.currentResult) state.currentResult = {};
            state.currentResult.llmAnalysis = fullText;
            state.currentResult.scenario = scenario;
            const phaseTag = document.querySelector('#llmResultCard .tag-phase');
            if (phaseTag) phaseTag.textContent = '已完成';
            showToast('深度分析完成', 'success');
        },
        (error) => {
            console.log('[streamLlmToResults] onError:', error);
            const phaseTag = document.querySelector('#llmResultCard .tag-phase');
            if (phaseTag) phaseTag.textContent = '失败';
            streamingEl.innerHTML = `<div style="color:var(--danger);padding:16px">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px">
                    <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                ${escapeHtml(String(error))}
                <br><br>
                <button class="header-btn" onclick="retryAnalysis()">重试</button>
            </div>`;
        }
    );
}

function runLocalAnalysis(scenario) {
    try {
        const phenomenology = matchPhenomenology(scenario, state.selectedType);
        const gua = matchGua(scenario, state.selectedType);
        const pratitya = matchPratitya(scenario, state.selectedType);
        const movingYao = determineMovingYao(scenario);
        const changedGua = calculateChangedGua(gua, movingYao);
        const praxis = matchPraxis(scenario, state.selectedType);
        const contradiction = matchContradiction(scenario, state.selectedType);
        const stoic = matchStoic(scenario, state.selectedType);
        const cross = crossAnalysis4D(gua, pratitya, praxis, contradiction, phenomenology, stoic);
        const actions = generateActions(gua, pratitya, changedGua);
        const praxisActions = generatePraxisActions(praxis, analysisDepthConfig[getAnalysisDepth()]);
        const contraActions = generateContradictionActions(contradiction, analysisDepthConfig[getAnalysisDepth()]);
        const stoicActions = generateStoicActions(stoic, analysisDepthConfig[getAnalysisDepth()]);

        const result = {
            phenomenology,
            gua, pratitya, changedGua,
            praxis, contradiction, stoic,
            cross, actions, praxisActions, contraActions, stoicActions,
            scenario, timestamp: Date.now(), movingYao
        };

        // Merge with existing currentResult to preserve llmAnalysis if already set
        if (state.currentResult) {
            Object.assign(state.currentResult, result);
        } else {
            state.currentResult = result;
        }
        saveToHistory(state.currentResult);
        return state.currentResult;
    } catch (err) {
        console.error('本地分析失败:', err);
        return null;
    }
}

// ════════════════════════════════════════
// ANALYSIS MODAL — LLM streaming in focused dialog
// ════════════════════════════════════════

function showAnalysisModal(scenario, dim, type) {
    try {
        const modal = document.getElementById('analysisModal');
        const summaryEl = document.getElementById('analysisInputSummary');
        const contentEl = document.getElementById('analysisStreamingContent');
        const retryBtn = document.getElementById('analysisModalRetry');
        const copyBtn = document.getElementById('analysisModalCopy');

        if (!modal || !summaryEl || !contentEl) {
            showToast('弹窗元素未找到，请刷新页面重试', 'error');
            return;
        }

        // Reset state
        contentEl.innerHTML = '<div class="streaming-placeholder">正在连接 AI 分析师...</div>';
        if (retryBtn) retryBtn.style.display = 'none';
        if (copyBtn) copyBtn.style.display = 'none';

        // Build summary
        const dimNames = {
            all: '全面分析',
            phenomenology: '现象学',
            yijing: '易经推演',
            buddhism: '十二因缘',
            marxism: '马克思主义',
            stoic: '斯多葛哲学'
        };
        const typeNames = {
            personal: '个人决策',
            relationship: '人际关系',
            business: '商业战略',
            social: '社会现象',
            creative: '创作瓶颈',
            political: '政治博弈'
        };

        summaryEl.innerHTML = `
            <div class="input-summary-header" onclick="this.closest('.input-summary').classList.toggle('collapsed')">
                <span>分析输入摘要</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
            <div class="input-summary-content">
                <div class="summary-row">
                    <span class="summary-label">分析维度</span>
                    <span class="summary-value">${dimNames[dim] || dimNames.all}</span>
                </div>
                ${type ? `
                <div class="summary-row">
                    <span class="summary-label">现象类型</span>
                    <span class="summary-value">${typeNames[type] || type}</span>
                </div>
                ` : ''}
                <div class="summary-scenario">${escapeHtml(scenario)}</div>
            </div>
        `;

        // Show modal
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Start LLM streaming
        const prompt = buildUserPrompt(scenario, dim, type);
        let fullText = '';
        let isFirstChunk = true;

        streamLLM(prompt,
            (chunk) => {
                if (isFirstChunk) {
                    contentEl.innerHTML = '';
                    isFirstChunk = false;
                }
                fullText += chunk;
                contentEl.innerHTML = markdownToHtml(fullText);
                contentEl.scrollTop = contentEl.scrollHeight;
            },
            () => {
                // Done
                if (!state.currentResult) state.currentResult = {};
                state.currentResult.llmAnalysis = fullText;
                state.currentResult.scenario = scenario;
                if (retryBtn) retryBtn.style.display = 'inline-flex';
                if (copyBtn) copyBtn.style.display = 'inline-flex';
                showToast('深度分析完成', 'success');
            },
            (error) => {
                contentEl.innerHTML = `<div style="color:var(--danger);padding:16px">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px">
                        <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    ${escapeHtml(String(error))}
                    <br><br>
                    <button class="header-btn" onclick="retryAnalysis()">重试</button>
                </div>`;
                if (retryBtn) retryBtn.style.display = 'inline-flex';
            }
        );
    } catch (err) {
        console.error('showAnalysisModal error:', err);
        showToast('弹窗初始化失败: ' + (err.message || err), 'error');
    }
}

function closeAnalysisModal() {
    const modal = document.getElementById('analysisModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';

    // Abort any ongoing LLM request
    if (currentLlmAbortController) {
        currentLlmAbortController.abort();
        currentLlmAbortController = null;
    }
}

function showSavedAnalysisModal(result) {
    const modal = document.getElementById('analysisModal');
    const summaryEl = document.getElementById('analysisInputSummary');
    const contentEl = document.getElementById('analysisStreamingContent');
    const retryBtn = document.getElementById('analysisModalRetry');
    const copyBtn = document.getElementById('analysisModalCopy');

    if (!modal || !summaryEl || !contentEl) {
        showToast('弹窗元素未找到，请刷新页面重试', 'error');
        return;
    }

    // Build summary from saved result
    summaryEl.innerHTML = `
        <div class="input-summary-header" onclick="this.closest('.input-summary').classList.toggle('collapsed')">
            <span>历史分析结果</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        </div>
        <div class="input-summary-content">
            <div class="summary-row">
                <span class="summary-label">分析时间</span>
                <span class="summary-value">${new Date(result.timestamp).toLocaleString()}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">卦象</span>
                <span class="summary-value">${result.gua ? result.gua.fullname : '-'}</span>
            </div>
            <div class="summary-scenario">${escapeHtml(result.scenario || '')}</div>
        </div>
    `;

    // Show saved content
    if (result.llmAnalysis) {
        contentEl.innerHTML = markdownToHtml(result.llmAnalysis);
    } else {
        contentEl.innerHTML = '<div class="streaming-placeholder">该记录暂无深度分析内容</div>';
    }

    if (retryBtn) retryBtn.style.display = 'none';
    if (copyBtn) {
        copyBtn.style.display = result.llmAnalysis ? 'inline-flex' : 'none';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function retryAnalysis() {
    const scenario = document.getElementById('scenario').value.trim();
    if (!scenario) return;
    const provider = state.settings.llmProvider || 'kimi';
    const config = LLM_CONFIG.providers[provider];
    if (!state.settings.llmApiKey) {
        renderAnalysisNotice('请先在设置中输入 API Key。浏览器直连推荐使用 OpenRouter。', 'warning');
        return;
    }
    if (!config) {
        renderAnalysisNotice('当前模型提供商不可用，请在设置中重新选择。', 'error');
        return;
    }
    if (!document.getElementById('llmContent')) {
        renderAiResultShell(scenario);
    }
    streamLlmToResults(scenario, state.selectedDim, state.selectedType);
}

function copyAnalysisResult() {
    if (!state.currentResult?.llmAnalysis) return;
    navigator.clipboard.writeText(state.currentResult.llmAnalysis)
        .then(() => showToast('已复制到剪贴板', 'success'));
}

function showSkeletonResults() {
    const resultsEl = document.getElementById('results');
    if (!resultsEl) return;
    resultsEl.classList.add('active');
    const dims = state.selectedDim === 'all' ? ['phenomenology','yijing','pratitya','praxis','contradiction','stoic','cross','actions'] : [state.selectedDim];
    const titles = {
        phenomenology: { icon: '现', color: 'linear-gradient(135deg,#00bcd4,#3f51b5)', title: '现象学分析' },
        yijing: { icon: '☰', color: 'var(--accent-400)', title: '易经卦象' },
        pratitya: { icon: '因', color: 'linear-gradient(135deg,#e8a0a0,#a0d4d4)', title: '十二因缘' },
        praxis: { icon: '实', color: 'linear-gradient(135deg,#e57373,#81c784)', title: '实践论' },
        contradiction: { icon: '矛', color: 'linear-gradient(135deg,#ff7043,#ab47bc)', title: '矛盾论' },
        stoic: { icon: '宁', color: 'linear-gradient(135deg,#66bb6a,#26a69a)', title: '斯多葛指南' },
        cross: { icon: '交', color: 'linear-gradient(135deg,#5c6bc0,#26c6da)', title: '交叉分析' },
        actions: { icon: '行', color: 'var(--success)', title: '干预建议' }
    };
    let html = '';
    dims.forEach(dim => {
        const t = titles[dim] || { icon: '析', color: 'var(--accent-400)', title: '分析中' };
        html += `
        <div class="result-card skeleton-card">
            <div class="result-header">
                <div class="gua-symbol" style="background:${t.color};color:#fff">${t.icon}</div>
                <div class="gua-info">
                    <div class="skeleton-line skeleton-title"></div>
                    <div class="skeleton-line skeleton-meta"></div>
                </div>
            </div>
            <div class="result-body">
                <div class="skeleton-line skeleton-text"></div>
                <div class="skeleton-line skeleton-text short"></div>
                <div class="skeleton-line skeleton-text"></div>
                <div class="skeleton-line skeleton-text medium"></div>
            </div>
        </div>`;
    });
    resultsEl.innerHTML = html;
}

// ════════════════════════════════════════
// ANALYSIS PROGRESS TRACKER
// ════════════════════════════════════════
function showAnalysisProgress() {
    const resultsEl = document.getElementById('results');
    if (!resultsEl) return;
    resultsEl.classList.add('active');
    const steps = [
        '匹配现象学维度',
        '推演易经卦象',
        '分析十二因缘',
        '计算动爻变卦',
        '匹配实践论阶段',
        '分析矛盾结构',
        '匹配斯多葛原则',
        '生成交叉分析',
        '生成行动建议',
        '保存结果',
        '渲染结果'
    ];
    let html = '<div id="analysisProgress" style="padding:20px;background:var(--bg-secondary);border-radius:12px;border:1px solid var(--border-color);margin-bottom:16px">';
    html += '<div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:16px">分析进度</div>';
    steps.forEach((step, i) => {
        html += `
            <div class="progress-step" id="progressStep${i}" style="display:flex;align-items:center;gap:10px;padding:8px 0;opacity:0.4;transition:opacity 0.3s">
                <div class="progress-dot" style="width:20px;height:20px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-tertiary);transition:all 0.3s">${i + 1}</div>
                <div style="font-size:13px;color:var(--text-secondary)">${step}</div>
            </div>
        `;
    });
    html += '</div>';
    resultsEl.innerHTML = html;
}

function updateProgressStep(stepIndex, message) {
    const stepEl = document.getElementById(`progressStep${stepIndex}`);
    if (stepEl) {
        stepEl.style.opacity = '1';
        const dot = stepEl.querySelector('.progress-dot');
        if (dot) {
            dot.style.background = 'var(--accent-400)';
            dot.style.color = '#fff';
            dot.textContent = '✓';
        }
        const text = stepEl.querySelector('div:last-child');
        if (text) text.textContent = message || text.textContent;
    }
    // Mark previous steps as done
    for (let i = 0; i < stepIndex; i++) {
        const prev = document.getElementById(`progressStep${i}`);
        if (prev) {
            prev.style.opacity = '0.7';
            const prevDot = prev.querySelector('.progress-dot');
            if (prevDot) {
                prevDot.style.background = 'var(--success)';
                prevDot.style.color = '#fff';
                prevDot.textContent = '✓';
            }
        }
    }
}

function showProgressError(message) {
    const progressEl = document.getElementById('analysisProgress');
    if (!progressEl) return;
    progressEl.innerHTML += `
        <div style="margin-top:16px;padding:12px;background:rgba(239,68,68,0.1);border-radius:8px;border-left:3px solid var(--danger);color:var(--danger);font-size:13px">
            <strong>分析失败：</strong>${escapeHtml(message)}
        </div>
    `;
}

function copyResultSection(type) {
    if (!state.currentResult) return;
    const { phenomenology, gua, pratitya, praxis, contradiction, stoic, cross, actions } = state.currentResult;
    let text = '';
    switch(type) {
        case 'gua':
            text = `【卦象 · ${gua.fullname}】
${gua.meaning}

当前位置：${gua.position}
危险警示：${gua.danger}
转化方向：${gua.transform}`;
            break;
        case 'pratitya':
            text = `【十二因缘 · ${pratitya.primary.name}】
含义：${pratitya.primary.meaning}
表现：${pratitya.primary.manifestation}
在决策中：${pratitya.primary.inDecision}
突破点：${pratitya.primary.breakPoint}`;
            break;
        case 'praxis':
            text = `【实践论 · ${praxis.primary.name}】\n含义：${praxis.primary.meaning}\n表现：${praxis.primary.manifestation}\n在决策中：${praxis.primary.inDecision}\n突破点：${praxis.primary.breakPoint}${praxis.primary.questions ? '\n\n反思问题：\n' + praxis.primary.questions.map((q, i) => `${i+1}. ${q}`).join('\n') : ''}`;
            break;
        case 'contradiction':
            text = `【矛盾论 · ${contradiction.primary.name}】
含义：${contradiction.primary.meaning}
表现：${contradiction.primary.manifestation}
在决策中：${contradiction.primary.inDecision}
突破点：${contradiction.primary.breakPoint}
辩证法：${contradiction.primary.dialectic}`;
            break;
        case 'cross':
            text = `【交叉分析】
${cross}`;
            break;
        case 'phenomenology':
            text = `【现象学分析 · ${phenomenology.primary.name}】\n含义：${phenomenology.primary.meaning}\n表现：${phenomenology.primary.manifestation}\n在决策中：${phenomenology.primary.inDecision}\n突破点：${phenomenology.primary.breakPoint}${phenomenology.primary.questions ? '\n\n反思问题：\n' + phenomenology.primary.questions.map((q, i) => `${i+1}. ${q}`).join('\n') : ''}`;
            break;
        case 'stoic':
            text = `【斯多葛指南 · ${stoic.primary.name}】\n含义：${stoic.primary.meaning}\n表现：${stoic.primary.manifestation}\n在决策中：${stoic.primary.inDecision}\n突破点：${stoic.primary.breakPoint}\n日常练习：${stoic.primary.practice}`;
            break;
        case 'actions':
            text = `【干预建议】\n${actions.map((a, i) => `${i+1}. ${a.title}：${a.desc}`).join('\n')}`;
            break;
    }
    navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板', 'success'));
}

function renderAiResultShell(scenario) {
    const resultsEl = document.getElementById('results');
    const streamingEl = document.getElementById('resultStreaming');
    const toolbar = document.getElementById('resultToolbar');
    console.log('[renderAiResultShell] resultsEl:', !!resultsEl, 'streamingEl:', !!streamingEl, 'toolbar:', !!toolbar);
    if (!resultsEl || !streamingEl) return;

    resultsEl.classList.add('active');
    if (toolbar) toolbar.style.display = 'flex';

    streamingEl.innerHTML = `
        <div class="result-card llm-card" id="llmResultCard">
            <div class="result-header">
                <div class="gua-symbol">AI</div>
                <div class="gua-info">
                    <h3>AI 深度分析</h3>
                    <div class="result-meta">
                        <span class="tag tag-phase">准备中</span>
                    </div>
                </div>
            </div>
            <div class="result-body">
                <div class="content-block" style="margin-bottom:16px">
                    <h4>分析对象</h4>
                    <p>${escapeHtml(scenario || '')}</p>
                </div>
                <div class="llm-streaming-content" id="llmContent">
                    <div class="streaming-placeholder">正在准备分析...</div>
                </div>
            </div>
        </div>
    `;
}

function renderAnalysisNotice(message, level = 'warning') {
    const llmContent = document.getElementById('llmContent') || document.getElementById('resultStreaming');
    if (!llmContent) return;
    const color = level === 'error' ? 'var(--danger)' : 'var(--warning)';
    llmContent.innerHTML = `
        <div style="color:${color};padding:16px;border:1px solid var(--border-default);border-radius:12px;background:var(--bg-tertiary)">
            ${escapeHtml(message)}
        </div>
    `;
}

function renderActionList(actions = []) {
    return actions.map((action, i) => `
        <div class="action-item">
            <div class="action-num">${i + 1}</div>
            <div class="action-content">
                <h5>${escapeHtml(action.title)}</h5>
                <p>${escapeHtml(action.desc)}</p>
            </div>
        </div>
    `).join('');
}

function renderNodeChain(chain = []) {
    return chain.map((node, i) => `
        <span class="chain-node ${node.isPrimary ? 'active' : ''}">${escapeHtml(node.data?.name || '')}</span>
        ${i < chain.length - 1 ? '<span class="chain-arrow">→</span>' : ''}
    `).join('');
}

function renderResult(result, withLlmPlaceholder = false) {
    const resultsEl = document.getElementById('results');
    const streamingEl = document.getElementById('resultStreaming');
    const toolbar = document.getElementById('resultToolbar');
    if (!resultsEl || !streamingEl || !result) return;

    resultsEl.classList.add('active');
    if (toolbar) toolbar.style.display = 'flex';

    const llmCard = withLlmPlaceholder ? `
        <div class="result-card llm-card" id="llmResultCard">
            <div class="result-header">
                <div class="gua-symbol">AI</div>
                <div class="gua-info">
                    <h3>AI 深度解读</h3>
                    <div class="result-meta"><span class="tag tag-phase">等待生成</span></div>
                </div>
            </div>
            <div class="result-body">
                <div class="llm-streaming-content" id="llmContent">
                    <div class="streaming-placeholder">准备连接 AI 分析师...</div>
                </div>
            </div>
        </div>
    ` : '';

    streamingEl.innerHTML = `
        <div class="result-card collapsible">
            <div class="result-header" onclick="toggleResultCard(this)">
                <div class="gua-symbol">${escapeHtml(result.gua?.symbol || '易')}</div>
                <div class="gua-info">
                    <h3>${escapeHtml(result.gua?.fullname || result.scenario || '分析结果')}</h3>
                    <div class="result-meta">
                        ${result.gua?.nature ? `<span class="tag tag-yang">${escapeHtml(result.gua.nature)}</span>` : ''}
                        ${result.gua?.phase ? `<span class="tag tag-phase">${escapeHtml(result.gua.phase)}</span>` : ''}
                        ${result.changedGua ? `<span class="tag tag-info">变卦：${escapeHtml(result.changedGua.fullname)}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="result-body">
                <div class="content-block">
                    <h4>卦象释义</h4>
                    <p>${escapeHtml(result.gua?.meaning || '暂无卦象释义')}</p>
                </div>
                <div class="content-block">
                    <h4>转化方向</h4>
                    <p>${escapeHtml(result.gua?.transform || '暂无转化方向')}</p>
                </div>
            </div>
        </div>
        <div class="result-card collapsible">
            <div class="result-header" onclick="toggleResultCard(this)">
                <div class="gua-symbol">因</div>
                <div class="gua-info">
                    <h3>十二因缘 · ${escapeHtml(result.pratitya?.primary?.name || '未匹配')}</h3>
                    <div class="result-meta">${result.pratitya?.secondary ? `<span class="tag tag-phase">次要：${escapeHtml(result.pratitya.secondary.name)}</span>` : ''}</div>
                </div>
            </div>
            <div class="result-body">
                <div class="chain-display">${renderNodeChain(result.pratitya?.chain || [])}</div>
                <div class="content-block">
                    <h4>主要卡点</h4>
                    <p>${escapeHtml(result.pratitya?.primary?.meaning || '')} ${escapeHtml(result.pratitya?.primary?.breakPoint || '')}</p>
                </div>
            </div>
        </div>
        <div class="result-card cross-analysis collapsible">
            <div class="result-header" onclick="toggleResultCard(this)">
                <div class="gua-symbol">交</div>
                <div class="gua-info"><h3>交叉分析</h3></div>
            </div>
            <div class="result-body">
                <div class="content-block"><p>${escapeHtml(result.cross || '暂无交叉分析')}</p></div>
            </div>
        </div>
        <div class="result-card collapsible">
            <div class="result-header" onclick="toggleResultCard(this)">
                <div class="gua-symbol">行</div>
                <div class="gua-info"><h3>干预建议</h3></div>
            </div>
            <div class="result-body action-items">${renderActionList(result.actions || [])}</div>
        </div>
        ${llmCard}
    `;
    restoreResultCardStates();
}
function renderLlmAnalysis(result) {
    try {
    const prompt = buildSystemPrompt(result.gua, result.pratitya, result.scenario, result.movingYao, result.changedGua);
    const llmContent = document.getElementById('llmContent');
    const llmCopyBtn = document.getElementById('llmCopyBtn');
    const llmCard = document.getElementById('llmResultCard');
    
    let fullText = '';
    let isFirstChunk = true;
    
    streamLLM(prompt,
        (chunk) => {
            if (isFirstChunk) {
                llmContent.innerHTML = '';
                isFirstChunk = false;
                // Update tag to show streaming
                const phaseTag = llmCard?.querySelector('.tag-phase');
                if (phaseTag) phaseTag.textContent = '生成中...';
            }
            fullText += chunk;
            llmContent.innerHTML = markdownToHtml(fullText);
            // Auto-scroll to bottom of LLM content
            llmContent.scrollTop = llmContent.scrollHeight;
        },
        () => {
            // Done
            const phaseTag = llmCard?.querySelector('.tag-phase');
            if (phaseTag) phaseTag.textContent = '已完成';
            if (llmCopyBtn) llmCopyBtn.style.display = 'flex';
            // Save LLM result to currentResult for export
            state.currentResult.llmAnalysis = fullText;
            showToast('深度解读完成', 'success');
        },
        (error) => {
            llmContent.innerHTML = `<div style="color:var(--danger);padding:16px">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px">
                    <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                ${error}
                <br><br>
                <button class="header-btn" onclick="renderLlmAnalysis(state.currentResult)">重试</button>
            </div>`;
            const phaseTag = llmCard?.querySelector('.tag-phase');
            if (phaseTag) {
                phaseTag.textContent = '失败';
                phaseTag.style.background = 'var(--danger)';
            }
        }
    );
    } catch (err) {
        const llmContent = document.getElementById('llmContent');
        if (llmContent) {
            llmContent.innerHTML = `<div style="color:var(--danger);padding:16px">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px">
                    <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                深度解读出错: ${err.message}
                <br><br>
                <button class="header-btn" onclick="renderLlmAnalysis(state.currentResult)">重试</button>
            </div>`;
        }
    }
}

function copyLlmResult() {
    if (!state.currentResult?.llmAnalysis) return;
    navigator.clipboard.writeText(state.currentResult.llmAnalysis)
        .then(() => showToast('已复制到剪贴板', 'success'));
}

// Result card collapse persistence with localStorage
function getCardType(card) {
    if (card.classList.contains('cross-analysis')) return 'cross';
    const symbol = card.querySelector('.gua-symbol');
    if (symbol) {
        const text = symbol.textContent.trim();
        if (text === '☸') return 'pratitya';
        if (text === '◈') return 'cross';
        if (text === '◉') return 'actions';
        return 'gua_' + text;
    }
    return 'card';
}

function toggleResultCard(header) {
    const card = header.closest('.result-card');
    if (!card) return;
    const isCollapsed = card.classList.toggle('collapsed');
    const type = getCardType(card);
    const key = 'yiyin_collapsed_' + type;
    try {
        localStorage.setItem(key, isCollapsed ? '1' : '0');
    } catch(e) {}
    // Animate the toggle
    const body = card.querySelector('.result-body');
    if (body && window.YIYIN_ANIMATIONS) {
        if (!isCollapsed) {
            window.YIYIN_ANIMATIONS.fadeIn(body, { duration: 300, translateY: 8 });
        }
    }
}

function restoreResultCardStates() {
    document.querySelectorAll('.result-card.collapsible').forEach(card => {
        const type = getCardType(card);
        const key = 'yiyin_collapsed_' + type;
        try {
            const val = localStorage.getItem(key);
            if (val === '1') card.classList.add('collapsed');
            else if (val === '0') card.classList.remove('collapsed');
        } catch(e) {}
    });
}

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
loadSettings().then(() => {
    loadDraft();
    handleShareUrl();
});
loadHistoryFromDB().then(() => {
    updateHistoryUI();
    updateFavoritesUI();
});
updateCharCount();
renderTags();

// ════════════════════════════════════════
// INTERSECTION OBSERVER LAZY LOADING
// ════════════════════════════════════════
const knowledgeViewRenderers = {
    gua: { rendered: false, fn: () => { renderGuaView(); setTimeout(() => window.YIYIN_ANIMATIONS?.animateGuaCards(), 100); } },
    pratitya: { rendered: false, fn: () => renderPratityaView() },
    phenomenology: { rendered: false, fn: () => renderPhenomenologyView() },
    praxis: { rendered: false, fn: () => renderPraxisView() },
    contradiction: { rendered: false, fn: () => renderContradictionView() },
    stoic: { rendered: false, fn: () => renderStoicView() }
};

// Observe knowledge view containers for lazy rendering
if ('IntersectionObserver' in window) {
    const viewObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const viewId = entry.target.id.replace('View', '');
                const renderer = knowledgeViewRenderers[viewId];
                if (renderer && !renderer.rendered) {
                    renderer.fn();
                    renderer.rendered = true;
                }
            }
        });
    }, { root: document.getElementById('mainContent'), threshold: 0.01 });

    Object.keys(knowledgeViewRenderers).forEach(view => {
        const el = document.getElementById(view + 'View');
        if (el) viewObserver.observe(el);
    });
} else {
    // Fallback: pre-render all for browsers without IO support
    Object.values(knowledgeViewRenderers).forEach(r => { if (!r.rendered) { r.fn(); r.rendered = true; } });
}

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}


// ════════════════════════════════════════
// TOUCH EVENT SUPPORT (Mobile)
// ════════════════════════════════════════
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}

function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
}

function handleSwipe() {
    const swipeThreshold = 80;
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    
    // Only handle horizontal swipes
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > swipeThreshold) {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        
        if (diffX > 0 && touchStartX < 50) {
            // Swipe right from left edge - open sidebar
            sidebar.classList.add('open');
        } else if (diffX < 0 && sidebar.classList.contains('open')) {
            // Swipe left - close sidebar
            sidebar.classList.remove('open');
        }
    }
}

// Attach touch listeners
document.addEventListener('touchstart', handleTouchStart, { passive: true });
document.addEventListener('touchend', handleTouchEnd, { passive: true });

// Touch feedback for buttons
document.addEventListener('touchstart', (e) => {
    const btn = e.target.closest('.nav-item, .gua-card, .history-card, .action-item');
    if (btn) btn.classList.add('touch-active');
}, { passive: true });

document.addEventListener('touchend', (e) => {
    document.querySelectorAll('.touch-active').forEach(el => el.classList.remove('touch-active'));
}, { passive: true });
function renderPraxisView(container) {
    if (!container) container = document.getElementById('praxisGrid');
    if (!container) return;
    let html = `
    <div class="knowledge-section">
        <div class="knowledge-header">
            <div class="knowledge-icon" style="background:linear-gradient(135deg,#c9a96e,#a08450)">实</div>
            <div class="knowledge-title">
                <h2>实践论 · 认识发展五阶段</h2>
                <p>从感性认识到理性认识，再到实践检验的螺旋上升</p>
            </div>
        </div>
        <div class="knowledge-content">
            <div class="chain-display" style="margin-bottom:24px;flex-wrap:wrap">
                ${Object.values(praxisData).map((stage, i) => `
                    <div class="chain-node ${stage.color}">${stage.name}</div>
                    ${i < Object.values(praxisData).length - 1 ? '<span class="chain-arrow">→</span>' : ''}
                `).join('')}
            </div>
            <div class="knowledge-grid">
                ${Object.entries(praxisData).map(([key, stage]) => `
                    <div class="knowledge-card">
                        <div class="knowledge-card-header">
                            <span class="knowledge-card-num">${stage.stage}</span>
                            <h4>${stage.name}</h4>
                        </div>
                        <div class="knowledge-card-body">
                            <p><strong>含义：</strong>${stage.meaning}</p>
                            <p><strong>表现：</strong>${stage.manifestation}</p>
                            <p><strong>决策应用：</strong>${stage.inDecision}</p>
                            <p style="color:var(--success)"><strong>突破点：</strong>${stage.breakPoint}</p>
                            <div style="margin-top:12px;padding:10px;background:var(--bg-tertiary);border-radius:6px">
                                <strong style="font-size:12px;color:var(--text-tertiary)">辩证法：</strong>
                                <p style="margin:6px 0 0;font-size:13px">${stage.dialectic}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>`;
    container.innerHTML = html;
}

function renderContradictionView(container) {
    if (!container) container = document.getElementById('contradictionGrid');
    if (!container) return;
    let html = `
    <div class="knowledge-section">
        <div class="knowledge-header">
            <div class="knowledge-icon" style="background:linear-gradient(135deg,#c9a96e,#a08450)">矛</div>
            <div class="knowledge-title">
                <h2>矛盾论 · 结构动力学</h2>
                <p>主要矛盾决定事物性质，矛盾双方相互转化</p>
            </div>
        </div>
        <div class="knowledge-content">
            <div class="knowledge-grid">
                ${Object.entries(contradictionData).map(([key, dim]) => `
                    <div class="knowledge-card">
                        <div class="knowledge-card-header">
                            <span class="knowledge-card-num">${dim.stage}</span>
                            <h4>${dim.name}</h4>
                        </div>
                        <div class="knowledge-card-body">
                            <p><strong>含义：</strong>${dim.meaning}</p>
                            <p><strong>表现：</strong>${dim.manifestation}</p>
                            <p><strong>决策应用：</strong>${dim.inDecision}</p>
                            <p style="color:var(--success)"><strong>突破点：</strong>${dim.breakPoint}</p>
                            <div class="dialectic-box">
                                <strong>辩证法：</strong>${dim.dialectic}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:32px;padding:20px;background:var(--bg-secondary);border-radius:12px;border:1px solid var(--border-color)">
                <h4 style="margin-bottom:16px;color:var(--text-primary)">场景矩阵</h4>
                <div class="knowledge-grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
                    ${Object.entries(contradictionMatrix).map(([type, matrix]) => `
                        <div class="knowledge-card">
                            <div class="knowledge-card-header">
                                <h4>${type === 'personal' ? '个人成长' : type === 'relationship' ? '人际关系' : type === 'business' ? '商业决策' : type === 'social' ? '社会现象' : type === 'creative' ? '创作瓶颈' : '政治博弈'}</h4>
                            </div>
                            <div class="knowledge-card-body">
                                <p><strong>主要矛盾：</strong>${contradictionData[matrix.primary]?.name || matrix.primary}</p>
                                <p><strong>次要维度：</strong>${contradictionData[matrix.secondary]?.name || matrix.secondary}</p>
                                <p style="font-size:13px;color:var(--text-secondary)">${matrix.desc}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>`;
    container.innerHTML = html;
}

function renderPhenomenologyView(container) {
    if (!container) container = document.getElementById('phenomenologyGrid');
    if (!container) return;
    let html = `
    <div class="knowledge-section">
        <div class="knowledge-header">
            <div class="knowledge-icon" style="background:linear-gradient(135deg,#c9a96e,#a08450)">现</div>
            <div class="knowledge-title">
                <h2>现象学 · 回到事物本身</h2>
                <p>悬置预设，直面经验原貌，在意识活动中揭示意义构造</p>
            </div>
        </div>
        <div class="knowledge-content">
            <div class="chain-display" style="margin-bottom:24px;flex-wrap:wrap">
                ${Object.values(phenomenologyData).map((dim, i) => `
                    <div class="chain-node ${dim.color}">${dim.name}</div>
                    ${i < Object.values(phenomenologyData).length - 1 ? '<span class="chain-arrow">→</span>' : ''}
                `).join('')}
            </div>
            <div class="knowledge-grid">
                ${Object.entries(phenomenologyData).map(([key, dim]) => `
                    <div class="knowledge-card">
                        <div class="knowledge-card-header">
                            <span class="knowledge-card-num">${dim.order}</span>
                            <h4>${dim.name}</h4>
                        </div>
                        <div class="knowledge-card-body">
                            <p><strong>含义：</strong>${dim.meaning}</p>
                            <p><strong>表现：</strong>${dim.manifestation}</p>
                            <p><strong>决策应用：</strong>${dim.inDecision}</p>
                            <p style="color:var(--success)"><strong>突破点：</strong>${dim.breakPoint}</p>
                            <div style="margin-top:12px;padding:10px;background:var(--bg-tertiary);border-radius:6px">
                                <strong style="font-size:12px;color:var(--text-tertiary)">反思问题：</strong>
                                <ul style="margin:6px 0 0 16px;padding:0;font-size:13px">
                                    ${dim.questions.map(q => `<li style="margin-bottom:4px">${q}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>`;
    container.innerHTML = html;
}

function renderStoicView(container) {
    if (!container) container = document.getElementById('stoicGrid');
    if (!container) return;
    let html = `
    <div class="knowledge-section">
        <div class="knowledge-header">
            <div class="knowledge-icon" style="background:linear-gradient(135deg,#c9a96e,#a08450)">斯</div>
            <div class="knowledge-title">
                <h2>斯多葛学派 · 可控之事</h2>
                <p>区分可控与不可控，在限制中寻找自由，以终为始地行动</p>
            </div>
        </div>
        <div class="knowledge-content">
            <div class="knowledge-grid">
                ${Object.entries(stoicData).map(([key, practice]) => `
                    <div class="knowledge-card">
                        <div class="knowledge-card-header">
                            <span class="knowledge-card-num">${practice.order}</span>
                            <h4>${practice.name}</h4>
                        </div>
                        <div class="knowledge-card-body">
                            <p><strong>含义：</strong>${practice.meaning}</p>
                            <p><strong>表现：</strong>${practice.manifestation}</p>
                            <p><strong>决策应用：</strong>${practice.inDecision}</p>
                            <p style="color:var(--success)"><strong>突破点：</strong>${practice.breakPoint}</p>
                            <div style="margin-top:12px;padding:10px;background:var(--bg-tertiary);border-radius:6px;border-left:3px solid var(--success)">
                                <strong style="color:var(--success)">日常练习：</strong>${practice.practice}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:32px;padding:20px;background:var(--bg-secondary);border-radius:12px;border:1px solid var(--border-color)">
                <h4 style="margin-bottom:16px;color:var(--text-primary)">场景矩阵</h4>
                <div class="knowledge-grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
                    ${Object.entries(stoicMatrix).map(([type, matrix]) => `
                        <div class="knowledge-card">
                            <div class="knowledge-card-header">
                                <h4>${type === 'personal' ? '个人成长' : type === 'relationship' ? '人际关系' : type === 'business' ? '商业决策' : type === 'social' ? '社会现象' : type === 'creative' ? '创作瓶颈' : '政治博弈'}</h4>
                            </div>
                            <div class="knowledge-card-body">
                                <p><strong>核心原则：</strong>${stoicData[matrix.primary]?.name || matrix.primary}</p>
                                <p><strong>辅助原则：</strong>${stoicData[matrix.secondary]?.name || matrix.secondary}</p>
                                <p style="font-size:13px;color:var(--text-secondary)">${matrix.desc}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>`;
    container.innerHTML = html;
}
