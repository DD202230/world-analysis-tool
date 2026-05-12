// ════════════════════════════════════════
// ANIMATIONS ENGINE · 易因 v4.0
// Web Animations API + CSS Transitions
// ════════════════════════════════════════

const YIYIN_EASINGS = {
  easeOutExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeOutBack: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  easeInOutQuint: 'cubic-bezier(0.86, 0, 0.07, 1)',
  easeOutQuart: 'cubic-bezier(0.25, 1, 0.5, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  linear: 'linear'
};

const YIYIN_DURATIONS = {
  fast: 150,
  base: 250,
  slow: 350,
  slower: 500,
  dramatic: 800
};

// ════════════════════════════════════════
// CORE ANIMATION HELPERS
// ════════════════════════════════════════

function animateElement(el, keyframes, options = {}) {
  if (!el) return Promise.resolve();
  const opts = {
    duration: options.duration || YIYIN_DURATIONS.base,
    easing: options.easing || YIYIN_EASINGS.easeOutExpo,
    fill: options.fill || 'forwards',
    delay: options.delay || 0,
    ...options
  };
  return el.animate(keyframes, opts).finished.catch(() => {});
}

function fadeIn(el, options = {}) {
  return animateElement(el, [
    { opacity: 0, transform: options.translateY ? `translateY(${options.translateY}px)` : 'translateY(8px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], { duration: YIYIN_DURATIONS.base, ...options });
}

function fadeInScale(el, options = {}) {
  return animateElement(el, [
    { opacity: 0, transform: 'scale(0.96)' },
    { opacity: 1, transform: 'scale(1)' }
  ], { duration: YIYIN_DURATIONS.slow, easing: YIYIN_EASINGS.easeOutBack, ...options });
}

function slideInRight(el, options = {}) {
  return animateElement(el, [
    { opacity: 0, transform: 'translateX(20px)' },
    { opacity: 1, transform: 'translateX(0)' }
  ], { duration: YIYIN_DURATIONS.base, ...options });
}

function slideInUp(el, options = {}) {
  return animateElement(el, [
    { opacity: 0, transform: 'translateY(20px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], { duration: YIYIN_DURATIONS.base, ...options });
}

function pulseGlow(el, options = {}) {
  return animateElement(el, [
    { boxShadow: '0 0 20px rgba(201,169,110,0.1)' },
    { boxShadow: '0 0 40px rgba(201,169,110,0.25)' },
    { boxShadow: '0 0 20px rgba(201,169,110,0.1)' }
  ], { duration: 2000, iterations: Infinity, ...options });
}

function shimmer(el, options = {}) {
  el.style.background = 'linear-gradient(90deg, transparent 0%, rgba(201,169,110,0.08) 50%, transparent 100%)';
  el.style.backgroundSize = '200% 100%';
  return animateElement(el, [
    { backgroundPosition: '-200% 0' },
    { backgroundPosition: '200% 0' }
  ], { duration: 1500, easing: 'linear', iterations: Infinity, ...options });
}

// ════════════════════════════════════════
// STAGGERED ANIMATIONS
// ════════════════════════════════════════

async function staggerFadeIn(elements, options = {}) {
  const { delay = 50, duration = YIYIN_DURATIONS.base, translateY = 12 } = options;
  const items = Array.from(elements).filter(el => el);
  for (let i = 0; i < items.length; i++) {
    fadeIn(items[i], { delay: i * delay, duration, translateY });
  }
}

async function staggerScaleIn(elements, options = {}) {
  const { delay = 60, duration = YIYIN_DURATIONS.slow } = options;
  const items = Array.from(elements).filter(el => el);
  for (let i = 0; i < items.length; i++) {
    fadeInScale(items[i], { delay: i * delay, duration });
  }
}

// ════════════════════════════════════════
// VIEW TRANSITIONS
// ════════════════════════════════════════

async function transitionView(fromEl, toEl, options = {}) {
  if (fromEl) {
    await animateElement(fromEl, [
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(-8px)' }
    ], { duration: YIYIN_DURATIONS.fast, easing: YIYIN_EASINGS.easeInOutQuint });
    fromEl.style.display = 'none';
  }
  if (toEl) {
    toEl.style.display = 'block';
    toEl.style.opacity = '0';
    await fadeIn(toEl, { duration: YIYIN_DURATIONS.slow, translateY: 16 });
    toEl.style.opacity = '';
  }
}

// ════════════════════════════════════════
// SCROLL TRIGGERED ANIMATIONS
// ════════════════════════════════════════

const scrollObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const animation = el.dataset.scrollAnimation || 'fadeIn';
      const delay = parseInt(el.dataset.scrollDelay || '0');
      
      switch (animation) {
        case 'fadeIn':
          fadeIn(el, { delay, translateY: 16 });
          break;
        case 'slideInRight':
          slideInRight(el, { delay });
          break;
        case 'slideInUp':
          slideInUp(el, { delay });
          break;
        case 'scaleIn':
          fadeInScale(el, { delay });
          break;
      }
      
      el.classList.add('animated');
      scrollObserver.unobserve(el);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

function initScrollAnimations() {
  document.querySelectorAll('[data-scroll-animation]').forEach(el => {
    el.style.opacity = '0';
    scrollObserver.observe(el);
  });
}

// ════════════════════════════════════════
// MICRO-INTERACTIONS
// ════════════════════════════════════════

function addMicroInteractions() {
  // Button press effect
  document.querySelectorAll('.header-btn, .nav-item, .gua-card, .history-card, .history-card-action').forEach(btn => {
    btn.addEventListener('mousedown', () => {
      animateElement(btn, [
        { transform: 'scale(1)' },
        { transform: 'scale(0.97)' }
      ], { duration: 100, easing: YIYIN_EASINGS.easeOutExpo, fill: 'both' });
    });
    btn.addEventListener('mouseup', () => {
      animateElement(btn, [
        { transform: 'scale(0.97)' },
        { transform: 'scale(1)' }
      ], { duration: 200, easing: YIYIN_EASINGS.spring, fill: 'both' });
    });
    btn.addEventListener('mouseleave', () => {
      btn.getAnimations().forEach(anim => anim.cancel());
      btn.style.transform = '';
    });
  });

  // Option chip select animation
  document.querySelectorAll('.option-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      animateElement(chip, [
        { transform: 'scale(1)' },
        { transform: 'scale(0.95)' },
        { transform: 'scale(1)' }
      ], { duration: 300, easing: YIYIN_EASINGS.spring });
    });
  });

  // Input focus glow
  const textarea = document.querySelector('.main-textarea');
  if (textarea) {
    textarea.addEventListener('focus', () => {
      const wrapper = textarea.closest('.input-card');
      if (wrapper) {
        animateElement(wrapper, [
          { boxShadow: '0 0 0 rgba(201,169,110,0)' },
          { boxShadow: '0 0 40px rgba(201,169,110,0.08)' }
        ], { duration: 300, easing: YIYIN_EASINGS.easeOutExpo, fill: 'both' });
      }
    });
    textarea.addEventListener('blur', () => {
      const wrapper = textarea.closest('.input-card');
      if (wrapper) {
        animateElement(wrapper, [
          { boxShadow: '0 0 40px rgba(201,169,110,0.08)' },
          { boxShadow: '0 0 0 rgba(201,169,110,0)' }
        ], { duration: 200, easing: YIYIN_EASINGS.easeOutExpo, fill: 'both' });
      }
    });
  }
}

// ════════════════════════════════════════
// SIDEBAR ANIMATION
// ════════════════════════════════════════

function animateSidebarOpen(sidebar) {
  sidebar.classList.add('open');
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99;opacity:0;';
  document.body.appendChild(overlay);
  
  animateElement(overlay, [
    { opacity: 0 },
    { opacity: 1 }
  ], { duration: YIYIN_DURATIONS.base });
  
  overlay.addEventListener('click', () => {
    animateSidebarClose(sidebar, overlay);
  });
  
  return overlay;
}

function animateSidebarClose(sidebar, overlay) {
  animateElement(sidebar, [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-100%)' }
  ], { duration: YIYIN_DURATIONS.base, easing: YIYIN_EASINGS.easeInOutQuint });
  
  if (overlay) {
    animateElement(overlay, [
      { opacity: 1 },
      { opacity: 0 }
    ], { duration: YIYIN_DURATIONS.base }).then(() => overlay.remove());
  }
  
  setTimeout(() => sidebar.classList.remove('open'), YIYIN_DURATIONS.base);
}

// ════════════════════════════════════════
// RESULT CARD ENTRANCE
// ════════════════════════════════════════

function animateResultCards() {
  const cards = document.querySelectorAll('.result-card');
  staggerFadeIn(cards, { delay: 80, duration: YIYIN_DURATIONS.slow, translateY: 20 });
}

function animateHistoryCards() {
  const cards = document.querySelectorAll('.history-card');
  staggerFadeIn(cards, { delay: 40, duration: YIYIN_DURATIONS.base, translateY: 12 });
}

function animateGuaCards() {
  const cards = document.querySelectorAll('.gua-card');
  staggerScaleIn(cards, { delay: 20, duration: YIYIN_DURATIONS.base });
}

// ════════════════════════════════════════
// LOADING ANIMATION
// ════════════════════════════════════════

function createLoadingAnimation(container) {
  const loader = document.createElement('div');
  loader.className = 'waapi-loader';
  loader.innerHTML = `
    <div class="waapi-loader-ring"></div>
    <div class="waapi-loader-ring"></div>
    <div class="waapi-loader-ring"></div>
  `;
  loader.style.cssText = 'display:flex;gap:6px;align-items:center;justify-content:center;padding:8px;';
  
  container.appendChild(loader);
  
  const rings = loader.querySelectorAll('.waapi-loader-ring');
  rings.forEach((ring, i) => {
    ring.style.cssText = 'width:8px;height:8px;background:var(--accent-400);border-radius:50%;';
    animateElement(ring, [
      { transform: 'scale(1)', opacity: 0.4 },
      { transform: 'scale(1.4)', opacity: 1 },
      { transform: 'scale(1)', opacity: 0.4 }
    ], { duration: 1200, delay: i * 150, iterations: Infinity, easing: 'ease-in-out' });
  });
  
  return loader;
}

function removeLoadingAnimation(loader) {
  if (loader && loader.parentNode) {
    animateElement(loader, [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.8)' }
    ], { duration: 200 }).then(() => loader.remove());
  }
}

// ════════════════════════════════════════
// TOAST QUEUE SYSTEM
// ════════════════════════════════════════

const toastQueue = [];
let toastProcessing = false;

async function processToastQueue() {
  if (toastProcessing || toastQueue.length === 0) return;
  toastProcessing = true;
  
  while (toastQueue.length > 0) {
    const { msg, type } = toastQueue.shift();
    await showToastAnimated(msg, type);
    await new Promise(r => setTimeout(r, 100));
  }
  
  toastProcessing = false;
}

function enqueueToast(msg, type = 'info') {
  toastQueue.push({ msg, type });
  processToastQueue();
}

async function showToastAnimated(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span>${msg}</span>
    <div class="toast-progress"></div>
  `;
  
  container.appendChild(toast);
  
  // Entrance animation
  await animateElement(toast, [
    { opacity: 0, transform: 'translateX(-50%) translateY(20px) scale(0.95)' },
    { opacity: 1, transform: 'translateX(-50%) translateY(0) scale(1)' }
  ], { duration: 300, easing: YIYIN_EASINGS.easeOutBack });
  
  // Wait
  await new Promise(r => setTimeout(r, 2200));
  
  // Exit animation
  await animateElement(toast, [
    { opacity: 1, transform: 'translateX(-50%) translateY(0) scale(1)' },
    { opacity: 0, transform: 'translateX(-50%) translateY(10px) scale(0.95)' }
  ], { duration: 250, easing: YIYIN_EASINGS.easeInOutQuint });
  
  toast.remove();
}

// ════════════════════════════════════════
// COMMAND PALETTE KEYBOARD NAV
// ════════════════════════════════════════

let cmdSelectedIndex = 0;
let cmdItems = [];

function initCmdKeyboardNav() {
  const input = document.getElementById('cmdInput');
  if (!input) return;
  
  input.addEventListener('keydown', (e) => {
    const items = document.querySelectorAll('.cmd-item');
    if (items.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cmdSelectedIndex = (cmdSelectedIndex + 1) % items.length;
      updateCmdSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cmdSelectedIndex = (cmdSelectedIndex - 1 + items.length) % items.length;
      updateCmdSelection(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = items[cmdSelectedIndex];
      if (selected) selected.click();
    }
  });
}

function updateCmdSelection(items) {
  items.forEach((item, i) => {
    item.classList.toggle('selected', i === cmdSelectedIndex);
    if (i === cmdSelectedIndex) {
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}

// ════════════════════════════════════════
// HELP / SHORTCUTS PANEL
// ════════════════════════════════════════
function openShortcutsHelp() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = 'shortcutsOverlay';
  overlay.innerHTML = `
    <div class="modal-panel" style="width:520px" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">键盘快捷键</div>
        <button class="modal-close" onclick="document.getElementById('shortcutsOverlay').remove()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="shortcuts-grid">
          <div class="shortcut-group">
            <div class="shortcut-group-title">导航</div>
            <div class="shortcut-item"><kbd>⌘ K</kbd><span>命令面板</span></div>
            <div class="shortcut-item"><kbd>⌘ N</kbd><span>新建分析</span></div>
            <div class="shortcut-item"><kbd>⌘ H</kbd><span>历史记录</span></div>
            <div class="shortcut-item"><kbd>⌘ ⇧ F</kbd><span>收藏</span></div>
            <div class="shortcut-item"><kbd>⌘ ⇧ C</kbd><span>对比模式</span></div>
          </div>
          <div class="shortcut-group">
            <div class="shortcut-group-title">操作</div>
            <div class="shortcut-item"><kbd>⌘ E</kbd><span>导出 Markdown</span></div>
            <div class="shortcut-item"><kbd>⌘ ⇧ P</kbd><span>导出 PDF</span></div>
            <div class="shortcut-item"><kbd>⌘ ⇧ I</kbd><span>导出图片</span></div>
            <div class="shortcut-item"><kbd>⌘ ⇧ S</kbd><span>分享链接</span></div>
            <div class="shortcut-item"><kbd>⌘ ⇧ X</kbd><span>清空输入</span></div>
          </div>
          <div class="shortcut-group">
            <div class="shortcut-group-title">其他</div>
            <div class="shortcut-item"><kbd>⌘ T</kbd><span>时间起卦</span></div>
            <div class="shortcut-item"><kbd>⌘ ,</kbd><span>设置</span></div>
            <div class="shortcut-item"><kbd>⌘ 1</kbd><span>六十四卦</span></div>
            <div class="shortcut-item"><kbd>⌘ 2</kbd><span>十二因缘</span></div>
            <div class="shortcut-item"><kbd>?</kbd><span>显示此帮助</span></div>
          </div>
        </div>
      </div>
    </div>
  `;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

// ════════════════════════════════════════
// HERO ENTRANCE ANIMATION
// ════════════════════════════════════════

function animateHeroEntrance() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  
  const badge = hero.querySelector('.hero-badge');
  const title = hero.querySelector('.hero-title');
  const subtitle = hero.querySelector('.hero-subtitle');
  
  if (badge) {
    badge.style.opacity = '0';
    fadeIn(badge, { delay: 100, duration: YIYIN_DURATIONS.slow });
  }
  if (title) {
    title.style.opacity = '0';
    fadeIn(title, { delay: 200, duration: YIYIN_DURATIONS.slower, translateY: 16 });
  }
  if (subtitle) {
    subtitle.style.opacity = '0';
    fadeIn(subtitle, { delay: 350, duration: YIYIN_DURATIONS.slow });
  }
}

// ════════════════════════════════════════
// ANALYZE BUTTON LOADING STATE
// ════════════════════════════════════════

function setAnalyzeButtonLoading(loading) {
  const btn = document.getElementById('analyzeBtn');
  if (!btn) return;
  
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = '';
    const loader = createLoadingAnimation(btn);
    loader.style.display = 'inline-flex';
    const span = document.createElement('span');
    span.textContent = ' 分析中...';
    span.style.marginLeft = '8px';
    btn.appendChild(span);
  } else {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      开始分析
    `;
  }
}

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimations();
  addMicroInteractions();
  initCmdKeyboardNav();
  animateHeroEntrance();
  initParticles();
});

// ════════════════════════════════════════
// BACKGROUND PARTICLES
// ════════════════════════════════════════
function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  
  const particleCount = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 12;
  
  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 200 + 100;
    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation-delay: ${Math.random() * 15}s;
      animation-duration: ${10 + Math.random() * 20}s;
    `;
    container.appendChild(p);
  }
}

// Expose globals
window.YIYIN_ANIMATIONS = {
  fadeIn,
  fadeInScale,
  slideInRight,
  slideInUp,
  pulseGlow,
  shimmer,
  staggerFadeIn,
  staggerScaleIn,
  transitionView,
  animateElement,
  animateResultCards,
  animateHistoryCards,
  animateGuaCards,
  setAnalyzeButtonLoading,
  enqueueToast,
  showToastAnimated,
  animateSidebarOpen,
  animateSidebarClose,
  initScrollAnimations,
  initParticles,
  YIYIN_EASINGS,
  YIYIN_DURATIONS
};
