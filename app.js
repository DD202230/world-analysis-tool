// ════════════════════════════════════════
// INDEXEDDB LAYER
// ════════════════════════════════════════
const DB_NAME = 'yiyin_db';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error);
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

async function dbGetAll(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dbPut(storeName, data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dbDelete(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function dbClear(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function dbGet(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
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
    timeGua: null,
    compareList: JSON.parse(localStorage.getItem('yiyin_compare') || '[]'),
    currentTags: [],
    draftId: null,
    settings: {
        autoSave: true,
        animations: true,
        soundEffects: false,
        compactMode: false
    }
};

// ════════════════════════════════════════
// SETTINGS PERSISTENCE
// ════════════════════════════════════════
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
function onScenarioInput() {
    updateCharCount();
    clearTimeout(livePreviewTimeout);
    const text = document.getElementById('scenario').value.trim();

    if (text.length < 5) {
        document.getElementById('livePreview').classList.remove('active');
    } else {
        livePreviewTimeout = setTimeout(() => {
            updateLivePreview(text);
        }, 300);
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
            updateLivePreview(d.text);
        }
    }
}

function clearInput() {
    document.getElementById('scenario').value = '';
    updateCharCount();
    document.getElementById('results').classList.remove('active');
    document.getElementById('livePreview').classList.remove('active');
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
    { id: 'compare', label: '对比模式', shortcut: '⌘⇧C', icon: '⚖️', action: () => { switchView('compare'); closeCmdPalette(); } },
    { id: 'gua', label: '六十四卦', shortcut: '⌘1', icon: '☰', action: () => { switchView('gua'); closeCmdPalette(); } },
    { id: 'pratitya', label: '十二因缘', shortcut: '⌘2', icon: '☸', action: () => { switchView('pratitya'); closeCmdPalette(); } },
    { id: 'export', label: '导出 Markdown', shortcut: '⌘E', icon: '📥', action: () => { exportResult('markdown'); closeCmdPalette(); } },
    { id: 'pdf', label: '导出 PDF', shortcut: '⌘⇧P', icon: '📄', action: () => { exportResult('pdf'); closeCmdPalette(); } },
    { id: 'share', label: '复制分享链接', shortcut: '⌘⇧S', icon: '🔗', action: () => { shareResult(); closeCmdPalette(); } },
    { id: 'image', label: '导出图片', shortcut: '⌘⇧I', icon: '🖼️', action: () => { openExportImage(); closeCmdPalette(); } },
    { id: 'clear', label: '清空输入', shortcut: '⌘⇧X', icon: '🗑️', action: () => { clearInput(); closeCmdPalette(); } },
    { id: 'time', label: '时间起卦', shortcut: '⌘T', icon: '⏰', action: () => { refreshTimeGua(); closeCmdPalette(); } },
    { id: 'settings', label: '设置', shortcut: '⌘,', icon: '⚙️', action: () => { openSettings(); closeCmdPalette(); } },
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
    if (cmds.length === 0) {
        document.getElementById('cmdResults').innerHTML = '<div style="padding:16px;color:var(--text-tertiary);text-align:center;font-size:14px;">无匹配命令</div>';
        return;
    }
    const html = `
        <div class="cmd-section">
            <div class="cmd-section-title">命令</div>
            ${cmds.map((cmd, i) => `
                <div class="cmd-item ${i === 0 ? 'selected' : ''}" onclick="commands.find(c => c.id === '${cmd.id}').action()">
                    <span class="cmd-item-icon">${cmd.icon}</span>
                    <span class="cmd-item-text">${cmd.label}</span>
                    <span class="cmd-item-kbd">${cmd.shortcut}</span>
                </div>
            `).join('')}
        </div>
    `;
    document.getElementById('cmdResults').innerHTML = html;
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
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
        e.preventDefault();
        switchView('compare');
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        exportResult('markdown');
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();
        shareResult();
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'i') {
        e.preventDefault();
        openExportImage();
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        exportResult('pdf');
    }
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        openSettings();
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'x') {
        e.preventDefault();
        clearInput();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        refreshTimeGua();
    }
    if (e.key === 'Escape') {
        closeCmdPalette();
        closeCompareModal();
        closeExportImage();
        closeSettings();
    }
});

// ════════════════════════════════════════
// VIEW MANAGEMENT
// ════════════════════════════════════════
function switchView(view) {
    state.currentView = view;

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.querySelector(`[data-nav="${view}"]`);
    if (navItem) navItem.classList.add('active');

    const titles = {
        analyze: '新建分析',
        history: '历史记录',
        favorites: '收藏',
        compare: '对比分析',
        gua: '六十四卦',
        pratitya: '十二因缘'
    };
    document.getElementById('pageTitle').textContent = titles[view] || '易因';

    const views = ['analyze', 'history', 'favorites', 'compare', 'gua', 'pratitya'];
    const currentEl = document.getElementById(state.currentView + 'View');
    
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

    if (view === 'history') { renderHistoryView(); setTimeout(() => window.YIYIN_ANIMATIONS?.animateHistoryCards(), 100); }
    if (view === 'favorites') renderFavoritesView();
    if (view === 'compare') renderCompareView();
    if (view === 'gua') { renderGuaView(); setTimeout(() => window.YIYIN_ANIMATIONS?.animateGuaCards(), 100); }
    if (view === 'pratitya') renderPratityaView();

    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
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
            ${tag}
            <span class="remove" onclick="removeTag('${tag}')">×</span>
        </span>
    `).join('');
    wrapper.innerHTML = tagsHtml + '<input type="text" class="tag-input" id="tagInput" placeholder="添加标签..." onkeydown="onTagInput(event)">';
}

function removeTag(tag) {
    state.currentTags = state.currentTags.filter(t => t !== tag);
    renderTags();
}

// ════════════════════════════════════════
// LIVE PREVIEW
// ════════════════════════════════════════
let livePreviewTimeout;
function onScenarioInput() {
    updateCharCount();
    clearTimeout(livePreviewTimeout);
    const text = document.getElementById('scenario').value.trim();

    if (text.length < 5) {
        document.getElementById('livePreview').classList.remove('active');
        return;
    }

    livePreviewTimeout = setTimeout(() => {
        updateLivePreview(text);
    }, 300);
}

function updateLivePreview(text) {
    const preview = document.getElementById('livePreview');
    const tagsEl = document.getElementById('liveTags');
    const hintEl = document.getElementById('liveGuaHint');

    const allKeywords = [];
    for (let gua in guaPatterns) {
        guaPatterns[gua].forEach(kw => {
            if (text.includes(kw)) allKeywords.push({ word: kw, type: 'gua', gua });
        });
    }
    for (let node in pratityaPatterns) {
        pratityaPatterns[node].forEach(kw => {
            if (text.includes(kw)) allKeywords.push({ word: kw, type: 'pratitya', node });
        });
    }

    if (allKeywords.length === 0) {
        preview.classList.remove('active');
        return;
    }

    preview.classList.add('active');

    const uniqueKeywords = allKeywords.slice(0, 8);
    tagsEl.innerHTML = uniqueKeywords.map(k =>
        `<span class="live-tag match">${k.word}</span>`
    ).join('');

    const gua = matchGua(text, state.selectedType);
    hintEl.innerHTML = `
        <div class="live-gua-symbol">${gua.symbol}</div>
        <div class="live-gua-info">
            <div class="live-gua-name">${gua.fullname}</div>
            <div class="live-gua-desc">${gua.phase} · ${gua.nature}</div>
        </div>
    `;
}

// ════════════════════════════════════════
// TIME DIVINATION
// ════════════════════════════════════════
function refreshTimeGua() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();

    const upperNum = (year + month + day) % 8 || 8;
    const lowerNum = (hour + minute + day) % 8 || 8;
    const movingNum = (year + month + day + hour + minute) % 6 || 6;

    const trigramMap = ['', '☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷'];
    const trigramNames = ['', '乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];

    const upper = trigramMap[upperNum];
    const lower = trigramMap[lowerNum];
    const upperName = trigramNames[upperNum];
    const lowerName = trigramNames[lowerNum];

    let matchedGua = null;
    for (let key in guaData) {
        if (guaData[key].trigrams &&
            guaData[key].trigrams.upper === upperName &&
            guaData[key].trigrams.lower === lowerName) {
            matchedGua = guaData[key];
            break;
        }
    }

    if (!matchedGua) {
        matchedGua = guaData.qian;
    }

    state.timeGua = {
        gua: matchedGua,
        upper: upperName,
        lower: lowerName,
        moving: movingNum,
        time: now.toLocaleString('zh-CN')
    };

    renderTimeDivination();
    showToast('时间起卦已更新');
}

function renderTimeDivination() {
    const body = document.getElementById('timeDivinationBody');
    if (!state.timeGua) {
        refreshTimeGua();
        return;
    }

    const { gua, upper, lower, moving, time } = state.timeGua;
    body.innerHTML = `
        <div class="time-gua-display">
            <div class="time-gua-symbol">${gua.symbol}</div>
            <div class="time-gua-name">${gua.name}</div>
        </div>
        <div class="time-divination-info">
            <p><strong style="color:var(--text-primary)">${gua.fullname}</strong> · ${gua.phase}</p>
            <p style="margin-top:4px">上卦${upper} · 下卦${lower} · 动爻第${moving}爻</p>
            <p style="margin-top:4px;color:var(--text-tertiary)">${time}</p>
        </div>
        <div class="time-divination-actions">
            <button class="header-btn primary" onclick="useTimeGua()">采用此卦</button>
        </div>
    `;
}

function useTimeGua() {
    if (!state.timeGua) return;
    showToast(`已采用 ${state.timeGua.gua.fullname}`);
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
            <div class="history-title">${h.scenario || '未命名分析'}</div>
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
        document.getElementById('scenario').value = item.scenario;
        updateCharCount();
        state.currentTags = item.tags || [];
        renderTags();
        renderResult(item.fullResult);
        switchView('analyze');
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

function addToCompare(id, event) {
    if (event) event.stopPropagation();
    const item = state.history.find(h => h.id === id);
    if (!item) return;

    if (state.compareList.find(c => c.id === id)) {
        showToast('已在对比列表中');
        return;
    }

    if (state.compareList.length >= 2) {
        showToast('对比最多选择2项');
        return;
    }

    state.compareList.push({ id: item.id, result: item.fullResult });
    localStorage.setItem('yiyin_compare', JSON.stringify(state.compareList));
    updateCompareBadge();
    showToast('已加入对比');
}

function removeFromCompare(id) {
    state.compareList = state.compareList.filter(c => c.id !== id);
    localStorage.setItem('yiyin_compare', JSON.stringify(state.compareList));
    updateCompareBadge();
    if (state.currentView === 'compare') renderCompareView();
}

function clearCompare() {
    state.compareList = [];
    localStorage.setItem('yiyin_compare', JSON.stringify(state.compareList));
    updateCompareBadge();
    renderCompareView();
    showToast('对比列表已清空');
}

function updateCompareBadge() {
    const badge = document.getElementById('compareCount');
    badge.textContent = state.compareList.length;
    badge.style.display = state.compareList.length > 0 ? 'inline-flex' : 'none';
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

    grid.innerHTML = filtered.map(h => `
        <div class="history-card" onclick="loadHistory(${h.id})">
            <div class="history-card-header">
                <div class="history-card-scenario">${h.scenario || '未命名分析'}</div>
                <div class="history-card-actions">
                    <button class="history-card-action ${h.favorited ? 'favorited' : ''}" onclick="toggleFavorite(${h.id}, event)">
                        ${h.favorited ? '★' : '☆'}
                    </button>
                    <button class="history-card-action" onclick="addToCompare(${h.id}, event)" title="加入对比">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="3" width="20" height="6" rx="2"></rect>
                            <rect x="2" y="15" width="20" height="6" rx="2"></rect>
                        </svg>
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
                    <span class="tag tag-yang">${h.guaFull}</span>
                    <span class="tag tag-phase">${h.pratitya}</span>
                    ${(h.tags || []).map(t => `<span class="tag tag-info">${t}</span>`).join('')}
                </div>
                <span class="history-card-date">${new Date(h.timestamp).toLocaleString('zh-CN')}</span>
            </div>
        </div>
    `).join('');
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
                <div class="history-card-scenario">${h.scenario || '未命名分析'}</div>
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
// COMPARE MODE
// ════════════════════════════════════════
function renderCompareView() {
    const stats = document.getElementById('compareStats');
    const grid = document.getElementById('compareGrid');

    if (state.compareList.length === 0) {
        stats.innerHTML = '';
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚖️</div>
                <div class="empty-title">暂无对比项</div>
                <div class="empty-desc">在历史记录中点击对比图标添加分析到对比列表</div>
            </div>
        `;
        return;
    }

    const guaCounts = {};
    const pratityaCounts = {};
    state.compareList.forEach(c => {
        const g = c.result.gua.name;
        const p = c.result.pratitya.primary.name;
        guaCounts[g] = (guaCounts[g] || 0) + 1;
        pratityaCounts[p] = (pratityaCounts[p] || 0) + 1;
    });

    stats.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${state.compareList.length}</div>
            <div class="stat-label">对比项</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${Object.keys(guaCounts).length}</div>
            <div class="stat-label">不同卦象</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${Object.keys(pratityaCounts).length}</div>
            <div class="stat-label">不同卡点</div>
        </div>
    `;

    if (state.compareList.length === 1) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚖️</div>
                <div class="empty-title">再添加一项</div>
                <div class="empty-desc">对比需要至少2项分析</div>
            </div>
        `;
        return;
    }

    const [a, b] = state.compareList;
    grid.innerHTML = `
        <div class="compare-col">
            <div class="compare-col-header">分析 A</div>
            ${renderCompareCol(a.result)}
            <button class="header-btn" style="margin-top:12px;width:100%" onclick="removeFromCompare(${a.id})">移除</button>
        </div>
        <div class="compare-col">
            <div class="compare-col-header">分析 B</div>
            ${renderCompareCol(b.result)}
            <button class="header-btn" style="margin-top:12px;width:100%" onclick="removeFromCompare(${b.id})">移除</button>
        </div>
    `;
}

function renderCompareCol(result) {
    const { gua, pratitya, cross, actions } = result;
    return `
        <div style="margin-bottom:16px">
            <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:4px">卦象</div>
            <div style="font-size:18px;font-family:var(--font-serif);color:var(--accent-300)">${gua.fullname}</div>
            <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${gua.phase} · ${gua.nature}</div>
        </div>
        <div style="margin-bottom:16px">
            <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:4px">主要卡点</div>
            <div style="font-size:16px;color:var(--text-primary)">${pratitya.primary.name}</div>
            <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${pratitya.primary.meaning}</div>
        </div>
        <div style="margin-bottom:16px">
            <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:4px">交叉分析</div>
            <div style="font-size:13px;color:var(--text-secondary);line-height:1.7">${cross}</div>
        </div>
        <div>
            <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">干预建议</div>
            ${actions.map((action, i) => `
                <div class="action-item" style="margin-bottom:8px">
                    <div class="action-num">${i + 1}</div>
                    <div class="action-content">
                        <h5>${action.title}</h5>
                        <p>${action.desc}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function closeCompareModal() {
    document.getElementById('compareModal').classList.remove('active');
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
        <div class="pratitya-node-large">
            <div class="pratitya-node-num ${node.color}">${i + 1}</div>
            <div class="pratitya-node-info">
                <div class="pratitya-node-name">${node.name}</div>
                <div class="pratitya-node-meaning">${node.meaning}</div>
            </div>
        </div>
        ${i < nodes.length - 1 ? '<div class="pratitya-arrow-down">↓</div>' : ''}
    `).join('');
}

// ════════════════════════════════════════
// EXPORT & SHARE
// ════════════════════════════════════════
function exportResult(format) {
    if (!state.currentResult) {
        showToast('请先进行分析');
        return;
    }

    if (format === 'json') {
        const data = JSON.stringify(state.currentResult, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `yiyin-analysis-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('JSON 已导出');
    } else if (format === 'markdown') {
        const { gua, pratitya, cross, actions, scenario } = state.currentResult;
        const md = `# 易因分析报告

**分析时间**: ${new Date().toLocaleString('zh-CN')}
**分析场景**: ${scenario}

---

## 卦象 · ${gua.fullname}

- **卦符**: ${gua.symbol}
- **性质**: ${gua.nature}
- **阶段**: ${gua.phase}

### 卦象释义
${gua.meaning}

### 当前位置
${gua.position}

### 危险警示
${gua.danger}

### 转化方向
${gua.transform}

---

## 十二因缘 · ${pratitya.primary.name}

### 主要卡点
- **含义**: ${pratitya.primary.meaning}
- **表现**: ${pratitya.primary.manifestation}
- **在决策中**: ${pratitya.primary.inDecision}
- **突破点**: ${pratitya.primary.breakPoint}

${pratitya.secondary ? `### 次要卡点 · ${pratitya.secondary.name}
- **含义**: ${pratitya.secondary.meaning}
- **突破点**: ${pratitya.secondary.breakPoint}
` : ''}

---

## 交叉分析

${cross}

---

## 干预建议

${actions.map((a, i) => `${i + 1}. **${a.title}**: ${a.desc}`).join('\n\n')}

---

*由 易因 · 世界分析引擎 生成*`;

        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `yiyin-analysis-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Markdown 已导出');
    }
}

function exportResult(format) {
    if (!state.currentResult) {
        showToast('请先进行分析');
        return;
    }

    if (format === 'json') {
        const data = JSON.stringify(state.currentResult, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `yiyin-analysis-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('JSON 已导出');
    } else if (format === 'markdown') {
        const { gua, pratitya, cross, actions, scenario } = state.currentResult;
        const md = `# 易因分析报告

|**分析时间**: ${new Date().toLocaleString('zh-CN')}
|**分析场景**: ${scenario}

---

## 卦象 · ${gua.fullname}

- **卦符**: ${gua.symbol}
- **性质**: ${gua.nature}
- **阶段**: ${gua.phase}

### 卦象释义
${gua.meaning}

### 当前位置
${gua.position}

### 危险警示
${gua.danger}

### 转化方向
${gua.transform}

---

## 十二因缘 · ${pratitya.primary.name}

### 主要卡点
- **含义**: ${pratitya.primary.meaning}
- **表现**: ${pratitya.primary.manifestation}
- **在决策中**: ${pratitya.primary.inDecision}
- **突破点**: ${pratitya.primary.breakPoint}

${pratitya.secondary ? `### 次要卡点 · ${pratitya.secondary.name}
- **含义**: ${pratitya.secondary.meaning}
- **突破点**: ${pratitya.secondary.breakPoint}
` : ''}

---

## 交叉分析

${cross}

---

## 干预建议

${actions.map((a, i) => `${i + 1}. **${a.title}**: ${a.desc}`).join('\n\n')}

---

*由 易因 · 世界分析引擎 生成*`;

        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `yiyin-analysis-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Markdown 已导出');
    } else if (format === 'pdf') {
        exportToPDF();
    }
}

function exportToPDF() {
    const { gua, pratitya, cross, actions, scenario, movingYao, changedGua } = state.currentResult;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('请允许弹出窗口以导出 PDF');
        return;
    }

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>易因分析报告</title>
<style>
@page { size: A4; margin: 2cm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: 'Noto Serif SC', 'Songti SC', serif;
    font-size: 11pt;
    line-height: 1.8;
    color: #333;
    background: #fff;
    padding: 40px;
    max-width: 800px;
    margin: 0 auto;
}
.header {
    text-align: center;
    padding-bottom: 30px;
    border-bottom: 2px solid #c9a96e;
    margin-bottom: 30px;
}
.header h1 {
    font-size: 28pt;
    color: #1a1a2e;
    letter-spacing: 8px;
    margin-bottom: 8px;
}
.header .subtitle {
    font-size: 12pt;
    color: #666;
}
.header .meta {
    font-size: 10pt;
    color: #999;
    margin-top: 12px;
}
.section {
    margin-bottom: 28px;
    page-break-inside: avoid;
}
.section-title {
    font-size: 14pt;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    align-items: center;
    gap: 8px;
}
.section-title .symbol {
    font-size: 20pt;
    color: #c9a96e;
}
.tag {
    display: inline-block;
    padding: 2px 10px;
    background: #f5f0e8;
    border: 1px solid #e0d5c0;
    border-radius: 4px;
    font-size: 9pt;
    color: #8a7a5a;
    margin-right: 6px;
    margin-bottom: 6px;
}
.gua-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
}
.gua-symbol {
    width: 60px; height: 60px;
    background: linear-gradient(135deg, #f5f0e8, #e8e0d0);
    border: 1px solid #d0c8b8;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 28pt;
    color: #c9a96e;
    flex-shrink: 0;
}
.gua-info h2 {
    font-size: 18pt;
    color: #1a1a2e;
    letter-spacing: 4px;
}
.gua-info .phase {
    font-size: 10pt;
    color: #666;
    margin-top: 4px;
}
.content-block {
    margin-bottom: 16px;
}
.content-block h4 {
    font-size: 11pt;
    font-weight: 600;
    color: #444;
    margin-bottom: 6px;
}
.content-block p {
    font-size: 10.5pt;
    color: #555;
    line-height: 1.8;
}
.action-item {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
    padding: 12px;
    background: #faf8f5;
    border-radius: 6px;
    border-left: 3px solid #c9a96e;
}
.action-num {
    width: 24px; height: 24px;
    background: #c9a96e;
    color: #fff;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10pt;
    font-weight: 700;
    flex-shrink: 0;
}
.action-content h5 {
    font-size: 10.5pt;
    font-weight: 600;
    color: #8a7a5a;
    margin-bottom: 4px;
}
.action-content p {
    font-size: 10pt;
    color: #666;
    line-height: 1.6;
}
.chain {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin: 12px 0;
    padding: 12px;
    background: #faf8f5;
    border-radius: 6px;
}
.chain-node {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 9pt;
    background: #e8e0d0;
    color: #5a5040;
}
.chain-node.active {
    background: #c9a96e;
    color: #fff;
}
.chain-arrow {
    color: #999;
    font-size: 9pt;
}
.footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;
    text-align: center;
    font-size: 9pt;
    color: #999;
}
.yao-lines {
    margin: 12px 0;
}
.yao-line {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 0;
    font-size: 10pt;
}
.yao-bar {
    width: 40px;
    height: 3px;
    background: #c9a96e;
    border-radius: 2px;
}
.yao-bar.yin {
    background: transparent;
    border-top: 3px solid #999;
    border-bottom: 3px solid #999;
    height: 8px;
}
.yao-label {
    font-size: 9pt;
    color: #999;
    min-width: 36px;
}
.yao-text {
    flex: 1;
    color: #555;
}
@media print {
    body { padding: 0; }
    .no-print { display: none; }
}
</style>
</head>
<body>
<div class="header">
    <h1>易因分析报告</h1>
    <div class="subtitle">以易经六十四卦理解世界规律，以佛教十二因缘洞察人性驱动</div>
    <div class="meta">分析时间：${new Date().toLocaleString('zh-CN')} · 场景：${scenario.slice(0, 80)}${scenario.length > 80 ? '...' : ''}</div>
</div>

<div class="section">
    <div class="gua-header">
        <div class="gua-symbol">${gua.symbol}</div>
        <div class="gua-info">
            <h2>${gua.fullname}</h2>
            <div class="phase">${gua.nature} · ${gua.phase}</div>
            <div style="margin-top:8px">
                ${gua.keywords.map(k => `<span class="tag">${k}</span>`).join('')}
            </div>
        </div>
    </div>
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
        <p style="color:#c94f4f">${gua.danger}</p>
    </div>
    <div class="content-block">
        <h4>转化方向</h4>
        <p style="color:#5a9a6e">${gua.transform}</p>
    </div>
    ${movingYao ? `
    <div class="content-block">
        <h4>动爻与变卦</h4>
        <p>第${movingYao}爻动，变卦为${changedGua ? changedGua.fullname : '未知'}。事物将向「${changedGua ? changedGua.phase : '未知'}」方向演化。</p>
    </div>
    ` : ''}
</div>

<div class="section">
    <div class="section-title"><span class="symbol">☸</span> 十二因缘分析</div>
    <div class="chain">
        ${pratitya.chain.map((node, i) => `
            <span class="chain-node ${node.isPrimary ? 'active' : ''}">${node.data.name}</span>
            ${i < pratitya.chain.length - 1 ? '<span class="chain-arrow">→</span>' : ''}
        `).join('')}
    </div>
    <div style="margin-bottom:12px">
        <span class="tag">主要卡点：${pratitya.primary.name}</span>
        ${pratitya.secondary ? `<span class="tag">次要卡点：${pratitya.secondary.name}</span>` : ''}
    </div>
    <div class="content-block">
        <h4>主要卡点 · ${pratitya.primary.name}</h4>
        <p><strong>含义：</strong>${pratitya.primary.meaning}</p>
        <p><strong>表现：</strong>${pratitya.primary.manifestation}</p>
        <p><strong>在决策中：</strong>${pratitya.primary.inDecision}</p>
        <p><strong style="color:#5a9a6e">突破点：</strong>${pratitya.primary.breakPoint}</p>
    </div>
    ${pratitya.secondary ? `
    <div class="content-block">
        <h4>次要卡点 · ${pratitya.secondary.name}</h4>
        <p><strong>含义：</strong>${pratitya.secondary.meaning}</p>
        <p><strong style="color:#5a9a6e">突破点：</strong>${pratitya.secondary.breakPoint}</p>
    </div>
    ` : ''}
</div>

<div class="section">
    <div class="section-title"><span class="symbol">◈</span> 交叉分析</div>
    <div class="content-block">
        <p>${cross}</p>
    </div>
</div>

<div class="section">
    <div class="section-title"><span class="symbol">◉</span> 干预建议</div>
    ${actions.map((action, i) => `
        <div class="action-item">
            <div class="action-num">${i + 1}</div>
            <div class="action-content">
                <h5>${action.title}</h5>
                <p>${action.desc}</p>
            </div>
        </div>
    `).join('')}
</div>

<div class="footer">
    <p>由 易因 · 世界分析引擎 生成 · yiyin.app</p>
    <p class="no-print" style="margin-top:8px;color:#c9a96e">请使用浏览器「打印 → 另存为 PDF」功能保存此报告</p>
</div>
<script>
    window.onload = function() {
        setTimeout(function() { window.print(); }, 500);
    };
</script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    showToast('PDF 打印窗口已打开');
}

function shareResult() {
    if (!state.currentResult) {
        showToast('请先进行分析');
        return;
    }

    // Generate shareable URL with encoded result
    try {
        const shareData = {
            s: state.currentResult.scenario.slice(0, 200),
            g: state.currentResult.gua.name,
            p: state.currentResult.pratitya.primary.key,
            t: Date.now()
        };
        const encoded = btoa(encodeURIComponent(JSON.stringify(shareData)));
        const shareUrl = `${window.location.origin}${window.location.pathname}#share=${encoded}`;

        navigator.clipboard.writeText(shareUrl).then(() => {
            showToast('分享链接已复制到剪贴板');
        }).catch(() => {
            // Fallback
            const text = `【易因分析】\n卦象：${state.currentResult.gua.fullname}\n卡点：${state.currentResult.pratitya.primary.name}\n\n${state.currentResult.cross}`;
            navigator.clipboard.writeText(text).then(() => {
                showToast('分析摘要已复制（链接生成失败）');
            });
        });
    } catch (e) {
        const text = `【易因分析】\n卦象：${state.currentResult.gua.fullname}\n卡点：${state.currentResult.pratitya.primary.name}\n\n${state.currentResult.cross}`;
        navigator.clipboard.writeText(text).then(() => {
            showToast('分析摘要已复制到剪贴板');
        });
    }
}

// ════════════════════════════════════════
// SETTINGS MODAL
// ════════════════════════════════════════
function openSettings() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'settingsOverlay';
    overlay.innerHTML = `
        <div class="modal-panel" style="width:420px" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">设置</div>
                <button class="modal-close" onclick="closeSettings()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="settings-section">
                    <div class="settings-title">通用</div>
                    <label class="settings-item">
                        <span class="settings-label">自动保存草稿</span>
                        <input type="checkbox" class="settings-toggle" ${state.settings.autoSave ? 'checked' : ''} onchange="toggleSetting('autoSave', this.checked)">
                    </label>
                    <label class="settings-item">
                        <span class="settings-label">动画效果</span>
                        <input type="checkbox" class="settings-toggle" ${state.settings.animations ? 'checked' : ''} onchange="toggleSetting('animations', this.checked)">
                    </label>
                    <label class="settings-item">
                        <span class="settings-label">紧凑模式</span>
                        <input type="checkbox" class="settings-toggle" ${state.settings.compactMode ? 'checked' : ''} onchange="toggleSetting('compactMode', this.checked)">
                    </label>
                </div>
                <div class="settings-section">
                    <div class="settings-title">数据</div>
                    <button class="header-btn" style="width:100%;margin-bottom:8px" onclick="exportAllData()">导出所有数据 (JSON)</button>
                    <button class="header-btn" style="width:100%;color:var(--danger)" onclick="clearAllData()">清除所有数据</button>
                </div>
                <div class="settings-section">
                    <div class="settings-title">关于</div>
                    <div class="settings-about">
                        <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px">易因 · 世界分析引擎</div>
                        <div style="font-size:12px;color:var(--text-tertiary)">版本 v4.0 · 易经64卦 + 佛教十二因缘</div>
                        <div style="font-size:12px;color:var(--text-tertiary);margin-top:4px">本地运行，数据存储于浏览器 IndexedDB</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function closeSettings() {
    const overlay = document.getElementById('settingsOverlay');
    if (overlay) overlay.remove();
}

function toggleSetting(key, value) {
    state.settings[key] = value;
    saveSettings();
    applySettings();
    showToast('设置已保存');
}

async function exportAllData() {
    const history = await dbGetAll('history');
    const settings = await dbGetAll('settings');
    const data = { history, settings, exportedAt: new Date().toISOString(), version: '4.0' };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yiyin-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据备份已导出');
}

async function clearAllData() {
    if (!confirm('确定要清除所有数据吗？此操作不可恢复。')) return;
    await dbClear('history');
    await dbClear('settings');
    state.history = [];
    state.compareList = [];
    localStorage.removeItem('yiyin_compare');
    updateHistoryUI();
    updateFavoritesUI();
    updateCompareBadge();
    showToast('所有数据已清除');
    closeSettings();
}

// ════════════════════════════════════════
// URL SHARE HANDLING
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
                if (shareData.g && guaData[shareData.g]) {
                    const gua = guaData[shareData.g];
                    const pratityaKey = shareData.p || 'avidya';
                    const pratitya = {
                        primary: { ...pratityaData[pratityaKey], key: pratityaKey },
                        secondary: null,
                        chain: Object.keys(pratityaData).map(key => ({
                            key, data: pratityaData[key],
                            isPrimary: key === pratityaKey,
                            isSecondary: false
                        }))
                    };
                    const result = {
                        gua,
                        pratitya,
                        cross: `${gua.fullname}的${gua.phase}状态与「${pratitya.primary.name}」的卡点形成共振。`,
                        actions: generateActions(gua, pratitya, null),
                        scenario: shareData.s,
                        timestamp: shareData.t || Date.now()
                    };
                    state.currentResult = result;
                    renderResult(result);
                    showToast('已加载分享的分析');
                }
                // Clear the hash
                history.replaceState(null, '', window.location.pathname + window.location.search);
            }
        } catch (e) {
            console.error('Failed to parse share URL:', e);
        }
    }
}

// ════════════════════════════════════════
// IMAGE EXPORT (DOM to Image)
// ════════════════════════════════════════
function openExportImage() {
    if (!state.currentResult) {
        showToast('请先进行分析');
        return;
    }
    const overlay = document.getElementById('exportOverlay');
    const preview = document.getElementById('exportPreview');
    preview.innerHTML = buildExportPreview(state.currentResult);
    overlay.classList.add('active');
}

function closeExportImage() {
    document.getElementById('exportOverlay').classList.remove('active');
}

function buildExportPreview(result) {
    const { gua, pratitya, cross, actions, movingYao, changedGua, scenario } = result;
    let html = `
        <div class="export-preview-card">
            <div style="text-align:center;margin-bottom:20px">
                <div style="font-size:32px;margin-bottom:8px">${gua.symbol}</div>
                <div style="font-family:var(--font-serif);font-size:22px;font-weight:600;color:var(--text-primary);letter-spacing:2px">${gua.fullname}</div>
                <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${gua.phase} · ${gua.nature}</div>
            </div>
            <div style="margin-bottom:16px">
                <div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">卦象释义</div>
                <div style="font-size:14px;color:var(--text-secondary);line-height:1.8">${gua.meaning}</div>
            </div>
            <div style="margin-bottom:16px">
                <div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">十二因缘 · ${pratitya.primary.name}</div>
                <div style="font-size:14px;color:var(--text-secondary);line-height:1.8">${pratitya.primary.meaning}</div>
            </div>
            <div style="margin-bottom:16px">
                <div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">交叉分析</div>
                <div style="font-size:14px;color:var(--text-secondary);line-height:1.8">${cross}</div>
            </div>
            <div>
                <div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">干预建议</div>
                ${actions.map((a, i) => `
                    <div style="display:flex;gap:12px;margin-bottom:12px;padding:12px;background:var(--bg-tertiary);border-radius:10px;border-left:3px solid var(--accent-400)">
                        <div style="width:24px;height:24px;background:var(--accent-400);color:var(--bg-primary);border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${i+1}</div>
                        <div>
                            <div style="font-size:13px;font-weight:600;color:var(--accent-300);margin-bottom:2px">${a.title}</div>
                            <div style="font-size:13px;color:var(--text-secondary);line-height:1.6">${a.desc}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border-subtle);text-align:center">
                <div style="font-size:12px;color:var(--text-tertiary)">易因 · 世界分析引擎 · ${new Date().toLocaleString('zh-CN')}</div>
            </div>
        </div>
    `;
    return html;
}

async function downloadImage() {
    const preview = document.getElementById('exportPreview');
    const card = preview.querySelector('.export-preview-card');
    if (!card) return;

    try {
        const canvas = await htmlToCanvas(card);
        const link = document.createElement('a');
        link.download = `yiyin-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('图片已导出');
        closeExportImage();
    } catch (err) {
        showToast('导出失败，请重试', 'error');
    }
}

async function htmlToCanvas(element) {
    const rect = element.getBoundingClientRect();
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // Fill background
    const styles = getComputedStyle(element);
    const bg = styles.backgroundColor || '#030305';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw text content recursively
    await drawElementToCanvas(ctx, element, 0, 0, scale);

    return canvas;
}

async function drawElementToCanvas(ctx, element, offsetX, offsetY, scale) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const x = rect.left - offsetX;
    const y = rect.top - offsetY;

    // Skip hidden elements
    if (style.display === 'none' || style.visibility === 'hidden') return;

    // Draw background if it has one
    if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
        ctx.fillStyle = style.backgroundColor;
        const r = parseFloat(style.borderRadius) || 0;
        roundRect(ctx, x, y, rect.width, rect.height, r);
        ctx.fill();
    }

    // Draw border
    if (parseFloat(style.borderWidth) > 0) {
        ctx.strokeStyle = style.borderColor;
        ctx.lineWidth = parseFloat(style.borderWidth);
        const r = parseFloat(style.borderRadius) || 0;
        roundRect(ctx, x, y, rect.width, rect.height, r);
        ctx.stroke();
    }

    // Draw text for leaf nodes
    if (element.children.length === 0 && element.textContent.trim()) {
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.fillStyle = style.color;
        ctx.textAlign = style.textAlign || 'left';
        ctx.textBaseline = 'middle';
        const lines = element.textContent.split('\n');
        const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
        lines.forEach((line, i) => {
            ctx.fillText(line.trim(), x + parseFloat(style.paddingLeft) || x + 4, y + (parseFloat(style.paddingTop) || 4) + (i + 0.5) * lineHeight);
        });
    }

    // Recurse children
    for (const child of element.children) {
        await drawElementToCanvas(ctx, child, offsetX, offsetY, scale);
    }
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function showToast(msg, type = 'info') {
    if (window.YIYIN_ANIMATIONS) {
        window.YIYIN_ANIMATIONS.enqueueToast(msg, type);
        return;
    }
    // Fallback
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span>${msg}</span>
        <div class="toast-progress"></div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ════════════════════════════════════════
// DATA: COMPLETE 64 GUA (FIXED KEYS)
// ════════════════════════════════════════
const guaData = {
    qian: { symbol: "☰", name: "乾", fullname: "乾为天", nature: "纯阳", phase: "创始/扩张", meaning: "天行健，君子以自强不息。创造、领导、主动扩张的能量态。", keywords: ["创造", "领导", "扩张", "阳刚", "主动"], position: "创始阶段，一切刚开始，势能最大但需持续投入", danger: "过刚易折，独断专行，忽视承载基础", transform: "阳极转阴，需引入坤的承载力", lines: ["潜龙勿用——时机未到，蓄力", "见龙在田——初露头角，需贵人", "君子终日乾乾——勤奋不懈，警惕", "或跃在渊——关键一跃，可进可退", "飞龙在天——巅峰状态，大展宏图", "亢龙有悔——过犹不及，需收敛"], trigrams: { upper: "乾", lower: "乾" } },
    kun: { symbol: "☷", name: "坤", fullname: "坤为地", nature: "纯阴", phase: "承载/收敛", meaning: "地势坤，君子以厚德载物。包容、承载、顺应、滋养的能量态。", keywords: ["承载", "包容", "顺应", "滋养", "收敛"], position: "成熟阶段，需稳固基础，蓄势待发", danger: "过于柔顺，丧失主体性，被他人利用", transform: "阴极转阳，需引入乾的创造力", lines: ["履霜坚冰至——见微知著，防微杜渐", "直方大——正直方正，自然光大", "含章可贞——内敛才华，待时而发", "括囊无咎——谨言慎行，收敛锋芒", "黄裳元吉——居中守正，大吉", "龙战于野——阴阳冲突，需调和"], trigrams: { upper: "坤", lower: "坤" } },
    zhun: { symbol: "☳☵", name: "屯", fullname: "水雷屯", nature: "阴阳始交", phase: "初生/艰难", meaning: "刚柔始交而难生。万事开头难，充满不确定性但蕴含生机。", keywords: ["初创", "艰难", "生机", "混沌", "扎根"], position: "事物萌芽，内外皆难，但正是扎根时", danger: "急于求成，忽视基础建设", transform: "经蒙卦而成长，需耐心培育", lines: ["磐桓——徘徊不前，宜守不宜进", "屯如邅如——进退两难，需坚持", "即鹿无虞——盲目追逐，徒劳无功", "乘马班如——求而不得，需调整方向", "屯其膏——资源不足，需节制", "泣血涟如——极度艰难，但终将过去"], trigrams: { upper: "坎", lower: "震" } },
    meng: { symbol: "☵☳", name: "蒙", fullname: "山水蒙", nature: "蒙昧", phase: "启蒙/教育", meaning: "山下出泉，蒙。君子以果行育德。蒙昧初开，需要启蒙教育。", keywords: ["启蒙", "教育", "学习", "蒙昧", "开智"], position: "需要学习和 guidance 的阶段", danger: "拒绝学习，固步自封", transform: "需卦——启蒙后需等待时机", lines: ["发蒙——启发蒙昧，利用刑人", "包蒙——包容蒙昧，纳妇吉", "勿用取女——见金夫，不有躬", "困蒙——困于蒙昧，不利", "童蒙——童蒙之吉，顺以巽也", "击蒙——击蒙，不利为寇"], trigrams: { upper: "艮", lower: "坎" } },
    xu: { symbol: "☵☰", name: "需", fullname: "水天需", nature: "等待", phase: "等待/蓄积", meaning: "云上于天，需。君子以饮食宴乐。等待时机，蓄积力量。", keywords: ["等待", "蓄积", "耐心", "时机", "准备"], position: "条件不成熟，需耐心等待", danger: " impatient，强行冒进", transform: "讼卦——等待不当引发争执", lines: ["需于郊——在郊外等待，不犯难行", "需于沙——在沙地等待，小有言", "需于泥——在泥中等待，致寇至", "需于血——在血泊中等待，出自穴", "需于酒食——在酒食中等待，贞吉", "入于穴——进入洞穴，有不速之客"], trigrams: { upper: "坎", lower: "乾" } },
    song: { symbol: "☰☵", name: "讼", fullname: "天水讼", nature: "争讼", phase: "争执/冲突", meaning: "天与水违行，讼。君子以作事谋始。意见不合，产生争讼。", keywords: ["争讼", "冲突", "争执", "辩论", "诉讼"], position: "利益冲突，需要明辨是非", danger: "争讼不休，两败俱伤", transform: "师卦——争讼升级为冲突", lines: ["不永所事——不长久从事争讼", "不克讼——不能胜诉，归逋", "食旧德——依靠旧德，贞厉", "不克讼——复命渝，安贞吉", "讼元吉——中正之讼，大吉", "或锡之鞶带——终朝三褫之"], trigrams: { upper: "乾", lower: "坎" } },
    shi: { symbol: "☵☷", name: "师", fullname: "地水师", nature: "军队", phase: "组织/行动", meaning: "地中有水，师。君子以容民畜众。组织力量，集体行动。", keywords: ["军队", "组织", "集体", "行动", "纪律"], position: "需要组织力量，统一行动", danger: "军队失控，纪律涣散", transform: "比卦——战争后需要团结", lines: ["师出以律——军队出动需纪律", "在师中——在军中，吉无咎", "师或舆尸——军队可能载尸而归", "师左次——军队左退，无咎", "田有禽——田中有禽，利执言", "大君有命——大君有命，开国承家"], trigrams: { upper: "坤", lower: "坎" } },
    bi_gua: { symbol: "☷☵", name: "比", fullname: "水地比", nature: "亲比", phase: "团结/依附", meaning: "地上有水，比。先王以建万国，亲诸侯。团结依附，亲近合作。", keywords: ["团结", "依附", "合作", "亲近", "联盟"], position: "需要团结他人，建立联盟", danger: "依附不当，失去独立", transform: "小畜卦——团结后需蓄积", lines: ["有孚比之——有诚信而亲比", "比之自内——从内亲比，贞吉", "比之匪人——亲比非人", "外比之——从外亲比，贞吉", "显比——显明亲比，王用三驱", "比之无首——亲比无首，凶"], trigrams: { upper: "坎", lower: "坤" } },
    xiaochu: { symbol: "☴☰", name: "小畜", fullname: "风天小畜", nature: "蓄积", phase: "蓄积/小有", meaning: "风行天上，小畜。君子以懿文德。小有蓄积，力量渐长。", keywords: ["蓄积", "小有", "积累", "准备", "成长"], position: "力量尚小，需继续蓄积", danger: "蓄积不足，急于求成", transform: "履卦——蓄积后需谨慎行动", lines: ["复自道——回归正道，何其咎", "牵复——牵引回归，吉", "舆说辐——车轮脱辐，夫妻反目", "有孚——有诚信，血去惕出", "有孚挛如——诚信相连，富以其邻", "既雨既处——雨已下，尚德载"], trigrams: { upper: "巽", lower: "乾" } },
    lu: { symbol: "☰☱", name: "履", fullname: "天泽履", nature: "践行", phase: "践行/谨慎", meaning: "上天下泽，履。君子以辨上下，定民志。谨慎践行，循礼而行。", keywords: ["践行", "谨慎", "礼节", "行动", "秩序"], position: "需要谨慎行动，遵循规则", danger: "冒失行动，违反礼节", transform: "泰卦——谨慎后通达", lines: ["素履——朴素践行，往无咎", "履道坦坦——道路平坦，幽人贞吉", "眇能视——瞎眼能看，跛能履", "履虎尾——踩虎尾，不咥人", "夬履——决断践行，贞厉", "视履考祥——审视践行，考察吉凶"], trigrams: { upper: "乾", lower: "兑" } },
    tai: { symbol: "☷☰", name: "泰", fullname: "地天泰", nature: "天地交", phase: "通达/和谐", meaning: "泰，小往大来，吉亨。天地交而万物通，上下交而其志同。", keywords: ["通达", "和谐", "交流", "顺利", "生发"], position: "最佳状态，阴阳和谐", danger: "安于现状，忽视泰极否来的转化", transform: "否卦——泰极否来", lines: ["拔茅茹——连根拔起，征吉", "包荒——包容荒秽，得尚于中行", "无平不陂——无平不陂，无往不复", "翩翩——轻浮下降，不富以其邻", "帝乙归妹——帝王嫁女，以祉元吉", "城复于隍——城墙倒塌，勿用师"], trigrams: { upper: "坤", lower: "乾" } },
    pi: { symbol: "☰☷", name: "否", fullname: "天地否", nature: "天地不交", phase: "闭塞/分离", meaning: "否，不利君子贞，大往小来。天地不交而万物不通。", keywords: ["闭塞", "分离", "不通", "小人道长", "隐忍"], position: "最困难时期，需隐忍待时", danger: "强行突破，或彻底消沉", transform: "同人卦——否极泰来，需团结", lines: ["拔茅茹——连根拔起，贞吉亨", "包承——包容承受，小人吉大人否", "包羞——包容羞耻", "有命无咎——接受天命，无咎", "休否——停止闭塞，大人吉", "倾否——倾覆闭塞，先否后喜"], trigrams: { upper: "乾", lower: "坤" } },
    tongren: { symbol: "☰☲", name: "同人", fullname: "天火同人", nature: "同人", phase: "团结/共识", meaning: "天与火，同人。君子以类族辨物。与人同心，达成共识。", keywords: ["同人", "团结", "共识", "合作", "同心"], position: "需要团结志同道合者", danger: "同而不和，表面团结", transform: "大有卦——团结后大有收获", lines: ["同人于门——在门口同人，无咎", "同人于宗——在宗族同人，吝", "伏戎于莽——伏兵于草莽", "乘其墉——登上城墙，弗克攻", "同人先号咷——同人先哭后笑", "同人于郊——在郊外同人，无悔"], trigrams: { upper: "乾", lower: "离" } },
    dayou: { symbol: "☲☰", name: "大有", fullname: "火天大有", nature: "大有", phase: "丰收/拥有", meaning: "火在天上，大有。君子以遏恶扬善，顺天休命。大有收获，丰盛之时。", keywords: ["丰收", "拥有", "丰盛", "收获", "成功"], position: "收获丰盛，但需保持谦逊", danger: "骄傲自满，挥霍无度", transform: "谦卦——大有后需谦虚", lines: ["无交害——无交往之害", "大车以载——用大车装载", "公用亨于天子——公侯享于天子", "匪其彭——不盛大，无咎", "厥孚交如——诚信相交", "自天佑之——上天保佑，吉无不利"], trigrams: { upper: "离", lower: "乾" } },
    qian2: { symbol: "☶☷", name: "谦", fullname: "地山谦", nature: "谦虚", phase: "谦虚/内敛", meaning: "地中有山，谦。君子以裒多益寡，称物平施。谦虚内敛，不骄不躁。", keywords: ["谦虚", "内敛", "低调", "平和", "退让"], position: "成功后需保持谦虚", danger: "虚伪谦虚，内心骄傲", transform: "豫卦——谦虚后需预备", lines: ["谦谦君子——谦而又谦", "鸣谦——谦虚有声", "劳谦——勤劳谦虚", "无不利——无所不利", "不富以其邻——不富以其邻", "鸣谦——谦虚有声，可用行师"], trigrams: { upper: "坤", lower: "艮" } },
    yu: { symbol: "☷☳", name: "豫", fullname: "雷地豫", nature: "愉悦", phase: "愉悦/预备", meaning: "雷出地奋，豫。先王以作乐崇德，殷荐之上帝。愉悦安乐，预备行动。", keywords: ["愉悦", "预备", "安乐", "享乐", "准备"], position: "安乐之时，需预备未来", danger: "沉溺享乐，忽视危机", transform: "随卦——预备后需随从", lines: ["鸣豫——鸣叫愉悦，凶", "介于石——介于石，不终日", "盱豫——张目愉悦，悔", "由豫——由豫，大有得", "贞疾——正固疾病，恒不死", "冥豫——昏暗愉悦，成有渝"], trigrams: { upper: "震", lower: "坤" } },
    sui: { symbol: "☱☳", name: "随", fullname: "泽雷随", nature: "随从", phase: "随从/顺应", meaning: "泽中有雷，随。君子以向晦入宴息。随从顺应，随遇而安。", keywords: ["随从", "顺应", "跟随", "适应", "灵活"], position: "需要顺应时势，随从他人", danger: "盲从，失去自我", transform: "蛊卦——随从不当生蛊", lines: ["官有渝——官职有变，贞吉", "系小子——系住小子，失丈夫", "系丈夫——系住丈夫，失小子", "随有获——随从有获", "孚于嘉——诚信于嘉", "拘系之——拘禁之，乃从维之"], trigrams: { upper: "兑", lower: "震" } },
    gu: { symbol: "☶☴", name: "蛊", fullname: "山风蛊", nature: "腐败", phase: "腐败/革新", meaning: "山下有风，蛊。君子以振民育德。腐败生蛊，需要革新。", keywords: ["腐败", "革新", "整治", "改革", "除弊"], position: "积弊已深，需要革新", danger: "改革过急，引发动荡", transform: "临卦——革新后需临民", lines: ["干父之蛊——整治父辈之蛊", "干母之蛊——整治母辈之蛊", "干父之蛊——小有悔，无大咎", "裕父之蛊——宽裕父辈之蛊", "干父之蛊——用誉", "不事王侯——不事王侯，高尚其事"], trigrams: { upper: "艮", lower: "巽" } },
    lin: { symbol: "☷☱", name: "临", fullname: "地泽临", nature: "临民", phase: "临民/督导", meaning: "泽上有地，临。君子以教思无穷，容保民无疆。亲临督导，教化民众。", keywords: ["临民", "督导", "教化", "管理", "领导"], position: "需要亲临现场，督导管理", danger: "脱离群众，高高在上", transform: "观卦——临民后需观察", lines: ["咸临——感化临民，贞吉", "咸临——感化临民，吉无不利", "甘临——甘美临民，无攸利", "至临——至亲临民，无咎", "知临——智慧临民", "敦临——敦厚临民，吉无不利"], trigrams: { upper: "坤", lower: "兑" } },
    guan: { symbol: "☴☷", name: "观", fullname: "风地观", nature: "观察", phase: "观察/审视", meaning: "风行地上，观。先王以省方观民设教。观察审视，了解民情。", keywords: ["观察", "审视", "了解", "考察", "观望"], position: "需要观察形势，了解状况", danger: "观望过久，错失时机", transform: "噬嗑卦——观察后需决断", lines: ["童观——儿童之观", "窥观——窥视之观", "观我生——观察我生", "观国之光——观察国之光", "观我生——君子无咎", "观其生——观察其生，君子无咎"], trigrams: { upper: "巽", lower: "坤" } },
    shihe: { symbol: "☲☳", name: "噬嗑", fullname: "火雷噬嗑", nature: "咬合", phase: "决断/刑罚", meaning: "雷电噬嗑。先王以明罚勅法。咬合决断，明罚勅法。", keywords: ["决断", "刑罚", "法律", "咬合", "解决"], position: "需要果断解决，明正典刑", danger: "刑罚过重，引发反抗", transform: "贲卦——决断后需文饰", lines: ["屦校灭趾——穿鞋校灭趾", "噬肤灭鼻——咬肤灭鼻", "噬腊肉——咬腊肉，遇毒", "噬干胏——咬干骨", "噬干肉——咬干肉，得黄金", "何校灭耳——戴校灭耳，凶"], trigrams: { upper: "离", lower: "震" } },
    bi2: { symbol: "☶☲", name: "贲", fullname: "山火贲", nature: "文饰", phase: "文饰/修饰", meaning: "山下有火，贲。君子以明庶政，无敢折狱。文饰修饰，美化外表。", keywords: ["文饰", "修饰", "美化", "外表", "礼仪"], position: "需要文饰美化，提升形象", danger: "华而不实，虚有其表", transform: "剥卦——文饰过度而剥落", lines: ["贲其趾——文饰其足", "贲其须——文饰其须", "贲如濡如——文饰润泽", "贲如皤如——文饰白色", "贲于丘园——文饰丘园", "白贲——白色文饰，无咎"], trigrams: { upper: "艮", lower: "离" } },
    bo: { symbol: "☶☷", name: "剥", fullname: "山地剥", nature: "剥落", phase: "剥落/衰败", meaning: "山附于地，剥。上以厚下安宅。剥落衰败，基础动摇。", keywords: ["剥落", "衰败", "侵蚀", "削弱", "消亡"], position: "基础动摇，逐渐剥落", danger: "坐以待毙，不图自救", transform: "复卦——剥极而复", lines: ["剥床以足——剥床从足开始", "剥床以辨——剥床到床板", "剥之无咎——剥落无咎", "剥床以肤——剥床到皮肤", "贯鱼——贯鱼，以宫人宠", "硕果不食——大果不食，君子得舆"], trigrams: { upper: "艮", lower: "坤" } },
    fu: { symbol: "☷☳", name: "复", fullname: "地雷复", nature: "回复", phase: "回复/复兴", meaning: "雷在地中，复。先王以至日闭关，商旅不行。回复复兴，重新开始。", keywords: ["回复", "复兴", "回归", "开始", "循环"], position: "衰败之后，重新开始", danger: "回复过急，根基不稳", transform: "无妄卦——回复后需无妄", lines: ["不远复——不远就回复", "休复——休息回复，吉", "频复——频繁回复", "中行独复——中道独行回复", "敦复——敦厚回复", "迷复——迷惑回复，凶"], trigrams: { upper: "坤", lower: "震" } },
    wuwang: { symbol: "☰☳", name: "无妄", fullname: "天雷无妄", nature: "无妄", phase: "无妄/真实", meaning: "天下雷行，物与无妄。先王以茂对时，育万物。真实无妄，不虚伪。", keywords: ["真实", "无妄", "诚实", "自然", "本真"], position: "需要真实无妄，不虚伪", danger: "虚伪造作，招致灾祸", transform: "大畜卦——无妄后需大畜", lines: ["无妄往——无妄而往，吉", "不耕获——不耕而获", "无妄之灾——无妄之灾", "可贞——可以正固", "无妄之疾——无妄之疾", "无妄之行——无妄之行"], trigrams: { upper: "乾", lower: "震" } },
    daxu: { symbol: "☶☰", name: "大畜", fullname: "山天大畜", nature: "大畜", phase: "大畜/蓄积", meaning: "天在山中，大畜。君子以多识前言往行，以畜其德。大量蓄积，厚积薄发。", keywords: ["蓄积", "储备", "积累", "厚积", "待发"], position: "大量蓄积，准备待发", danger: "蓄积过多，不知运用", transform: "颐卦——大畜后需颐养", lines: ["有厉利已——有危险，利于停止", "舆说輹——车轮脱辐", "良马逐——良马追逐", "童牛之牿——小牛之角", "豶豕之牙——阉猪之牙", "何天之衢——何等天之大道"], trigrams: { upper: "艮", lower: "乾" } },
    yi: { symbol: "☶☱", name: "颐", fullname: "山雷颐", nature: "颐养", phase: "颐养/养生", meaning: "山下有雷，颐。君子以慎言语，节饮食。颐养养生，保重身体。", keywords: ["颐养", "养生", "保养", "饮食", "言语"], position: "需要颐养保养，保重身体", danger: "纵欲过度，损害健康", transform: "大过卦——颐养不当生大过", lines: ["舍尔灵龟——舍弃灵龟", "颠颐——颠倒颐养", "拂颐——违背颐养", "颠颐吉——颠倒颐养，吉", "拂经——违背常道", "由颐——顺从颐养"], trigrams: { upper: "艮", lower: "震" } },
    daguo: { symbol: "☱☴", name: "大过", fullname: "泽风大过", nature: "大过", phase: "大过/过度", meaning: "泽灭木，大过。君子以独立不惧，遁世无闷。过度极端，非常时期。", keywords: ["过度", "极端", "非常", "危机", "转折"], position: "非常时期，需要极端手段", danger: "过度极端，自取灭亡", transform: "坎卦——大过后生坎险", lines: ["藉用白茅——用白茅铺垫", "枯杨生稊——枯杨生芽", "栋桡——栋梁弯曲", "栋隆——栋梁隆起", "枯杨生华——枯杨开花", "过涉灭顶——涉水灭顶，凶"], trigrams: { upper: "兑", lower: "巽" } },
    kan: { symbol: "☵☵", name: "坎", fullname: "坎为水", nature: "坎险", phase: "坎险/困难", meaning: "水洊至，习坎。君子以常德行，习教事。坎险困难，重重危机。", keywords: ["坎险", "困难", "危机", "重重", "陷落"], position: "重重危机，深陷困境", danger: "放弃希望，彻底沉沦", transform: "离卦——坎极生离", lines: ["习坎——习惯坎险", "坎有险——坎中有险", "来之坎——来到坎险", "樽酒簋贰——一樽酒，两簋食", "坎不盈——坎不盈满", "系用徽纆——用绳索捆绑"], trigrams: { upper: "坎", lower: "坎" } },
    li: { symbol: "☲☲", name: "离", fullname: "离为火", nature: "离明", phase: "光明/依附", meaning: "明两作，离。大人以继明照于四方。光明照耀，依附正道。", keywords: ["光明", "依附", "照耀", "文明", "美丽"], position: "光明照耀，但需依附", danger: "依附不当，引火烧身", transform: "咸卦——离后需咸感", lines: ["履错然——步履错乱", "黄离——黄色光明", "日昃之离——日斜之光", "突如其来如——突然来到", "出涕沱若——流泪滂沱", "王用出征——王用出征"], trigrams: { upper: "离", lower: "离" } },
    xian: { symbol: "☱☶", name: "咸", fullname: "泽山咸", nature: "感应", phase: "感应/情感", meaning: "山上有泽，咸。君子以虚受人。感应相通，情感交流。", keywords: ["感应", "情感", "交流", "相通", "感受"], position: "情感感应，心灵相通", danger: "感情用事，失去理智", transform: "恒卦——感应后需恒久", lines: ["咸其拇——感应其拇指", "咸其腓——感应其小腿", "咸其股——感应其大腿", "贞吉悔亡——正固吉祥", "咸其脢——感应其背", "咸其辅颊舌——感应其面颊舌"], trigrams: { upper: "兑", lower: "艮" } },
    heng: { symbol: "☴☳", name: "恒", fullname: "雷风恒", nature: "恒久", phase: "恒久/持久", meaning: "雷风，恒。君子以立不易方。恒久持久，坚定不移。", keywords: ["恒久", "持久", "稳定", "坚持", "不变"], position: "需要恒久坚持，不动摇", danger: "固执不变，不知变通", transform: "遁卦——恒久后需遁退", lines: ["浚恒——深求恒久", "悔亡——悔恨消失", "不恒其德——不恒其德", "田无禽——田中没有禽", "恒其德——恒其德", "振恒——震动恒久"], trigrams: { upper: "震", lower: "巽" } },
    dun: { symbol: "☰☶", name: "遁", fullname: "天山遁", nature: "遁退", phase: "遁退/隐退", meaning: "天下有山，遁。君子以远小人，不恶而严。遁退隐退，远离小人。", keywords: ["遁退", "隐退", "远离", "避开", "退避"], position: "需要退避，远离是非", danger: "退避不及，被小人所害", transform: "大壮卦——遁后需大壮", lines: ["遁尾——退避在后", "执之用黄牛——用黄牛绑住", "系遁——绑住退避", "好遁——喜好退避", "嘉遁——嘉美退避", "肥遁——肥美退避"], trigrams: { upper: "乾", lower: "艮" } },
    dazhuang: { symbol: "☳☰", name: "大壮", fullname: "雷天大壮", nature: "大壮", phase: "强盛/壮大", meaning: "雷在天上，大壮。君子以非礼弗履。强盛壮大，气势如虹。", keywords: ["强盛", "壮大", "气势", "力量", "强大"], position: "强盛之时，气势如虹", danger: "恃强凌弱，招致反噬", transform: "晋卦——大壮后需晋升", lines: ["壮于趾——强壮在趾", "贞吉——正固吉祥", "小人用壮——小人用强", "贞吉悔亡——正固吉祥", "丧羊于易——丧羊于易", "艰则吉——艰难则吉"], trigrams: { upper: "震", lower: "乾" } },
    jin: { symbol: "☲☷", name: "晋", fullname: "火地晋", nature: "晋升", phase: "晋升/进步", meaning: "明出地上，晋。君子以自昭明德。晋升进步，光明向上。", keywords: ["晋升", "进步", "上升", "光明", "发展"], position: "晋升之时，光明向上", danger: "晋升过快，根基不稳", transform: "明夷卦——晋升后需明夷", lines: ["晋如摧如——晋升如摧", "晋如愁如——晋升如愁", "众允——众人允许", "晋如鼫鼠——晋升如大鼠", "悔亡——悔恨消失", "晋其角——晋升其角"], trigrams: { upper: "离", lower: "坤" } },
    mingyi: { symbol: "☷☲", name: "明夷", fullname: "地火明夷", nature: "明夷", phase: "光明受伤", meaning: "明入地中，明夷。君子以莅众，用晦而明。光明受伤，韬光养晦。", keywords: ["受伤", "韬晦", "隐藏", "黑暗", "忍耐"], position: "光明受伤，需要韬晦", danger: "锋芒毕露，招致灾祸", transform: "家人卦——明夷后需家人", lines: ["明夷于飞——明夷飞翔", "明夷——明夷于左股", "明夷于南狩——明夷于南狩", "入于左腹——进入左腹", "箕子之明夷——箕子之明夷", "不明晦——不明而晦"], trigrams: { upper: "坤", lower: "离" } },
    jiaren: { symbol: "☴☲", name: "家人", fullname: "风火家人", nature: "家人", phase: "家庭/内务", meaning: "风自火出，家人。君子以言有物，而行有恒。家庭内务，修身齐家。", keywords: ["家庭", "内务", "齐家", "修身", "和睦"], position: "需要修身齐家，和睦家庭", danger: "家宅不宁，内部分裂", transform: "睽卦——家人后生睽离", lines: ["闲有家——防范家庭", "无攸遂——无所成就", "家人嗃嗃——家庭严厉", "富家——富裕家庭", "王假有家——王至家庭", "有孚威如——有诚信威严"], trigrams: { upper: "巽", lower: "离" } },
    kui: { symbol: "☲☱", name: "睽", fullname: "火泽睽", nature: "睽离", phase: "睽离/背离", meaning: "上火下泽，睽。君子以同而异。睽离背离，求同存异。", keywords: ["睽离", "背离", "分歧", "差异", "矛盾"], position: "分歧背离，需要调和", danger: "矛盾激化，彻底分裂", transform: "蹇卦——睽后生蹇难", lines: ["悔亡——悔恨消失", "遇主于巷——在巷中遇主", "见舆曳——看见车被拖", "睽孤——睽离孤独", "悔亡——悔恨消失", "睽孤——睽离孤独"], trigrams: { upper: "离", lower: "兑" } },
    jian2: { symbol: "☵☶", name: "蹇", fullname: "水山蹇", nature: "蹇难", phase: "蹇难/困难", meaning: "山上有水，蹇。君子以反身修德。蹇难困难，反身修德。", keywords: ["蹇难", "困难", "险阻", "停顿", "反思"], position: "困难险阻，需要反思", danger: "强行突破，越陷越深", transform: "解卦——蹇极而解", lines: ["往蹇来誉——前往蹇难，回来有誉", "王臣蹇蹇——王臣蹇难", "往蹇来反——前往蹇难，回来反复", "往蹇来连——前往蹇难，回来连接", "大蹇朋来——大蹇难朋友来", "往蹇来硕——前往蹇难，回来硕大"], trigrams: { upper: "坎", lower: "艮" } },
    jie: { symbol: "☳☵", name: "解", fullname: "雷水解", nature: "解脱", phase: "解脱/释放", meaning: "雷雨作，解。君子以赦过宥罪。解脱释放，雨过天晴。", keywords: ["解脱", "释放", "解决", "放松", "舒展"], position: "困难解除，雨过天晴", danger: "解除过早，隐患犹存", transform: "损卦——解后需减损", lines: ["无咎——无咎", "田获三狐——田猎获三狐", "负且乘——背负且乘车", "解而拇——解脱拇指", "君子维有解——君子有解脱", "公用射隼——公侯射隼"], trigrams: { upper: "震", lower: "坎" } },
    sun: { symbol: "☶☱", name: "损", fullname: "山泽损", nature: "减损", phase: "减损/节制", meaning: "山下有泽，损。君子以惩忿窒欲。减损节制，克制欲望。", keywords: ["减损", "节制", "克制", "减少", "节约"], position: "需要减损，克制欲望", danger: "减损过度，损害根本", transform: "益卦——损极生益", lines: ["已事遄往——事已速往", "利贞——利于正固", "三人行则损一人——三人行损一人", "损其疾——减损其疾", "或益之——或增益之", "弗损益之——不减损而增益"], trigrams: { upper: "艮", lower: "兑" } },
    yi2: { symbol: "☴☳", name: "益", fullname: "风雷益", nature: "增益", phase: "增益/受益", meaning: "风雷，益。君子以见善则迁，有过则改。增益受益，见善则迁。", keywords: ["增益", "受益", "进步", "改善", "发展"], position: "增益之时，受益良多", danger: "受益忘形，不知回报", transform: "夬卦——益后需夬决", lines: ["利用为大作——利于大作", "或益之——或增益之", "益之用凶事——增益用于凶事", "中行告公从——中道告公顺从", "有孚惠心——有诚信惠心", "莫益之——莫增益之"], trigrams: { upper: "巽", lower: "震" } },
    guai: { symbol: "☱☰", name: "夬", fullname: "泽天夬", nature: "夬决", phase: "决断/决裂", meaning: "泽上于天，夬。君子以施禄及下。决断决裂，果断行动。", keywords: ["决断", "决裂", "果断", "裁决", "决定"], position: "需要决断，果断行动", danger: "决断过急，伤及无辜", transform: "姤卦——夬后遇姤", lines: ["壮于前趾——强壮在前趾", "惕号——警惕呼号", "壮于頄——强壮在面颊", "臀无肤——臀部无肤", "苋陆夬夬——苋陆决断", "无号——无呼号"], trigrams: { upper: "兑", lower: "乾" } },
    gou: { symbol: "☰☴", name: "姤", fullname: "天风姤", nature: "遇合", phase: "遇合/邂逅", meaning: "天下有风，姤。后以施命诰四方。遇合邂逅，不期而遇。", keywords: ["遇合", "邂逅", "相遇", "意外", "不期"], position: "不期而遇，意外相逢", danger: "遇合不当，引狼入室", transform: "萃卦——姤后需萃聚", lines: ["系于金柅——系于金属制动器", "包有鱼——包中有鱼", "臀无肤——臀部无肤", "包无鱼——包中无鱼", "以杞包瓜——用杞包瓜", "姤其角——遇合其角"], trigrams: { upper: "乾", lower: "巽" } },
    cui: { symbol: "☱☷", name: "萃", fullname: "泽地萃", nature: "萃聚", phase: "萃聚/聚集", meaning: "泽上于地，萃。君子以除戎器，戒不虞。萃聚聚集，汇聚力量。", keywords: ["萃聚", "聚集", "汇聚", "集合", "团结"], position: "汇聚力量，团结一致", danger: "聚集过杂，良莠不齐", transform: "升卦——萃后需上升", lines: ["有孚不终——有诚信不终", "引吉——引导吉祥", "萃如嗟如——萃聚叹息", "大吉无咎——大吉无咎", "萃有位——萃聚有位", "赍咨涕洟——叹息流涕"], trigrams: { upper: "兑", lower: "坤" } },
    sheng: { symbol: "☴☷", name: "升", fullname: "地风升", nature: "上升", phase: "上升/晋升", meaning: "地中生木，升。君子以顺德，积小以高大。上升晋升，循序渐进。", keywords: ["上升", "晋升", "发展", "成长", "进步"], position: "上升之时，循序渐进", danger: "上升过快，根基不稳", transform: "困卦——升极生困", lines: ["允升——允许上升", "孚乃利用禴——诚信利用春祭", "升虚邑——上升虚城", "王用亨于岐山——王用享于岐山", "贞吉——正固吉祥", "冥升——昏暗上升"], trigrams: { upper: "坤", lower: "巽" } },
    kun2: { symbol: "☵☱", name: "困", fullname: "泽水困", nature: "困穷", phase: "困穷/困境", meaning: "泽无水，困。君子以致命遂志。困穷困境，致命遂志。", keywords: ["困穷", "困境", "穷困", "艰难", "窘迫"], position: "困穷之时，需要坚持", danger: "困而放弃，丧失志气", transform: "井卦——困后需井养", lines: ["臀困于株木——臀部困于树木", "困于酒食——困于酒食", "困于石——困于石头", "来徐徐——来徐徐", "劓刖——割鼻砍足", "困于葛藟——困于葛藤"], trigrams: { upper: "兑", lower: "坎" } },
    jing: { symbol: "☵☴", name: "井", fullname: "水风井", nature: "井养", phase: "井养/滋养", meaning: "木上有水，井。君子以劳民劝相。井养滋养，为民服务。", keywords: ["井养", "滋养", "服务", "源泉", "供给"], position: "滋养之时，为民服务", danger: "井源枯竭，供给不足", transform: "革卦——井后需变革", lines: ["井泥不食——井泥不食", "井谷射鲋——井谷射鲋", "井渫不食——井清不食", "井甃——井壁", "井洌寒泉——井冽寒泉", "井收勿幕——井收勿幕"], trigrams: { upper: "坎", lower: "巽" } },
    ge: { symbol: "☲☱", name: "革", fullname: "泽火革", nature: "变革", phase: "变革/革新", meaning: "泽中有火，革。君子以治历明时。变革革新，除旧布新。", keywords: ["变革", "革新", "改革", "除旧", "布新"], position: "变革之时，除旧布新", danger: "变革过急，引发动荡", transform: "鼎卦——革后需鼎立", lines: ["巩用黄牛——用黄牛巩固", "己日乃革——己日乃变革", "征凶贞厉——征凶正固危厉", "悔亡——悔恨消失", "大人虎变——大人虎变", "君子豹变——君子豹变"], trigrams: { upper: "离", lower: "兑" } },
    ding: { symbol: "☲☴", name: "鼎", fullname: "火风鼎", nature: "鼎立", phase: "鼎立/稳定", meaning: "木上有火，鼎。君子以正位凝命。鼎立稳定，正位凝命。", keywords: ["鼎立", "稳定", "正位", "凝命", "巩固"], position: "鼎立之时，稳定巩固", danger: "鼎足折断，稳定动摇", transform: "震卦——鼎后生动", lines: ["鼎颠趾——鼎颠倒趾", "鼎有实——鼎有实物", "鼎耳革——鼎耳变革", "鼎折足——鼎折断足", "鼎黄耳——鼎黄耳", "鼎玉铉——鼎玉铉"], trigrams: { upper: "离", lower: "巽" } },
    zhen: { symbol: "☳☳", name: "震", fullname: "震为雷", nature: "震动", phase: "震动/行动", meaning: "洊雷，震。君子以恐惧修省。震动行动，恐惧修省。", keywords: ["震动", "行动", "恐惧", "修省", "警醒"], position: "震动之时，需要警醒", danger: "震动过剧，惊慌失措", transform: "艮卦——震后需止", lines: ["震来虩虩——震来恐惧", "震来厉——震来危厉", "震苏苏——震来颤抖", "震遂泥——震入泥中", "震往来厉——震往来危厉", "震索索——震来瑟缩"], trigrams: { upper: "震", lower: "震" } },
    gen: { symbol: "☶☶", name: "艮", fullname: "艮为山", nature: "止", phase: "止/静止", meaning: "兼山，艮。君子以思不出其位。止静止，思不出位。", keywords: ["止", "静止", "停止", "克制", "收敛"], position: "静止之时，需要收敛", danger: "止而不前，错失良机", transform: "渐卦——止后需渐", lines: ["艮其趾——止其趾", "艮其腓——止其腓", "艮其限——止其限", "艮其身——止其身", "艮其辅——止其辅", "敦艮——敦厚静止"], trigrams: { upper: "艮", lower: "艮" } },
    jian3: { symbol: "☴☶", name: "渐", fullname: "风山渐", nature: "渐进", phase: "渐进/逐步", meaning: "山上有木，渐。君子以居贤德善俗。渐进逐步，循序渐进。", keywords: ["渐进", "逐步", "循序", "渐进", "稳步"], position: "渐进之时，循序渐进", danger: "渐进过慢，错失良机", transform: "归妹卦——渐后需归妹", lines: ["鸿渐于干——鸿雁渐于岸", "鸿渐于磐——鸿雁渐于磐", "鸿渐于陆——鸿雁渐于陆地", "鸿渐于木——鸿雁渐于木", "鸿渐于陵——鸿雁渐于陵", "鸿渐于陆——鸿雁渐于陆地"], trigrams: { upper: "巽", lower: "艮" } },
    guimei: { symbol: "☱☳", name: "归妹", fullname: "雷泽归妹", nature: "归妹", phase: "归妹/嫁娶", meaning: "泽上有雷，归妹。君子以永终知敝。归妹嫁娶，永终知敝。", keywords: ["归妹", "嫁娶", "归宿", "结合", "婚姻"], position: "归妹之时，需要结合", danger: "结合不当，终有敝端", transform: "丰卦——归妹后需丰盛", lines: ["归妹以娣——归妹以娣", "眇能视——瞎眼能视", "归妹以须——归妹以须", "归妹愆期——归妹延期", "帝乙归妹——帝乙归妹", "女承筐——女承筐"], trigrams: { upper: "震", lower: "兑" } },
    feng: { symbol: "☲☳", name: "丰", fullname: "雷火丰", nature: "丰盛", phase: "丰盛/盛大", meaning: "雷电皆至，丰。君子以折狱致刑。丰盛盛大，折狱致刑。", keywords: ["丰盛", "盛大", "繁荣", "盛大", "辉煌"], position: "丰盛之时，盛大辉煌", danger: "丰盛过极，日中则昃", transform: "旅卦——丰后需旅", lines: ["遇其配主——遇其配主", "丰其蔀——丰其遮蔽", "丰其沛——丰其幡幔", "丰其蔀——丰其遮蔽", "来章——来章", "丰其屋——丰其屋"], trigrams: { upper: "震", lower: "离" } },
    lu2: { symbol: "☲☶", name: "旅", fullname: "火山旅", nature: "旅行", phase: "旅行/漂泊", meaning: "山上有火，旅。君子以明慎用刑，而不留狱。旅行漂泊，明慎用刑。", keywords: ["旅行", "漂泊", "流浪", "客居", "外出"], position: "旅行之时，漂泊在外", danger: "旅而不安，无处安身", transform: "巽卦——旅后需巽顺", lines: ["旅琐琐——旅人琐琐", "旅即次——旅人就次", "旅焚其次——旅人焚其次", "旅于处——旅人于处", "射雉一矢亡——射雉一矢亡", "旅人先笑——旅人先笑"], trigrams: { upper: "离", lower: "艮" } },
    xun: { symbol: "☴☴", name: "巽", fullname: "巽为风", nature: "巽顺", phase: "巽顺/顺从", meaning: "随风，巽。君子以申命行事。巽顺顺从，申命行事。", keywords: ["巽顺", "顺从", "谦逊", "进入", "渗透"], position: "巽顺之时，需要谦逊", danger: "巽顺过度，丧失原则", transform: "兑卦——巽后需兑悦", lines: ["进退——进退", "巽在床下——巽在床下", "频巽——频繁巽顺", "悔亡——悔恨消失", "贞吉——正固吉祥", "巽在床下——巽在床下"], trigrams: { upper: "巽", lower: "巽" } },
    dui: { symbol: "☱☱", name: "兑", fullname: "兑为泽", nature: "兑悦", phase: "兑悦/喜悦", meaning: "丽泽，兑。君子以朋友讲习。兑悦喜悦，朋友讲习。", keywords: ["兑悦", "喜悦", "快乐", "和悦", "愉快"], position: "兑悦之时，喜悦快乐", danger: "兑悦过度，乐极生悲", transform: "涣卦——兑后需涣散", lines: ["和兑——和悦", "孚兑——诚信和悦", "来兑——来悦", "商兑——商悦", "引兑——引悦", "引兑——引悦"], trigrams: { upper: "兑", lower: "兑" } },
    huan: { symbol: "☴☵", name: "涣", fullname: "风水涣", nature: "涣散", phase: "涣散/离散", meaning: "风行水上，涣。先王以享于帝立庙。涣散离散，享于帝立庙。", keywords: ["涣散", "离散", "分散", "解散", "疏散"], position: "涣散之时，需要凝聚", danger: "涣散过度，分崩离析", transform: "节卦——涣后需节制", lines: ["用拯马壮——用拯马壮", "涣奔其机——涣奔其机", "涣其躬——涣其躬", "涣其群——涣其群", "涣汗其大号——涣汗其大号", "涣王居——涣王居"], trigrams: { upper: "巽", lower: "坎" } },
    jie2: { symbol: "☵☱", name: "节", fullname: "水泽节", nature: "节制", phase: "节制/节约", meaning: "泽上有水，节。君子以制数度，议德行。节制节约，制数度议德行。", keywords: ["节制", "节约", "限制", "约束", "节度"], position: "节制之时，需要约束", danger: "节制过度，苦不堪言", transform: "中孚卦——节后需中孚", lines: ["不出户庭——不出户庭", "不出门庭——不出门庭", "不节若——不节制", "安节——安节制", "甘节——甘节制", "苦节——苦节制"], trigrams: { upper: "坎", lower: "兑" } },
    zhongfu: { symbol: "☱☴", name: "中孚", fullname: "风泽中孚", nature: "中孚", phase: "诚信/中孚", meaning: "泽上有风，中孚。君子以议狱缓死。诚信中孚，议狱缓死。", keywords: ["诚信", "中孚", "信任", "诚实", "信用"], position: "中孚之时，诚信为本", danger: "诚信被疑，中孚受损", transform: "小过卦——中孚后需小过", lines: ["虞吉——安虞吉祥", "鸣鹤在阴——鸣鹤在阴", "得敌——得敌", "月几望——月几望", "有孚挛如——有诚信相连", "翰音登于天——翰音登于天"], trigrams: { upper: "巽", lower: "兑" } },
    xiaoguo: { symbol: "☳☶", name: "小过", fullname: "雷山小过", nature: "小过", phase: "小过/过度", meaning: "山上有雷，小过。君子以行过乎恭，丧过乎哀。小过过度，行过乎恭。", keywords: ["小过", "过度", "过分", "超过", "过失"], position: "小过之时，稍有过度", danger: "小过变大，酿成大错", transform: "既济卦——小过后需既济", lines: ["飞鸟遗之音——飞鸟遗之音", "过其祖——过其祖", "弗过防之——弗过防之", "无咎——无咎", "密云不雨——密云不雨", "弗遇过之——弗遇过之"], trigrams: { upper: "震", lower: "艮" } },
    jiji: { symbol: "☵☲", name: "既济", fullname: "水火既济", nature: "既济", phase: "既济/完成", meaning: "水在火上，既济。君子以思患而预防之。既济完成，思患预防。", keywords: ["既济", "完成", "成功", "达成", "结束"], position: "既济之时，已经完成", danger: "既济忘危，终乱将至", transform: "未济卦——既济终未济", lines: ["曳其轮——拖其轮", "妇丧其茀——妇丧其茀", "高宗伐鬼方——高宗伐鬼方", "繻有衣袽——繻有衣袽", "东邻杀牛——东邻杀牛", "濡其首——濡其首"], trigrams: { upper: "坎", lower: "离" } },
    weiji: { symbol: "☲☵", name: "未济", fullname: "火水未济", nature: "未济", phase: "未济/未完成", meaning: "火在水上，未济。君子以慎辨物居方。未济未完成，慎辨物居方。", keywords: ["未济", "未完成", "未竟", "继续", "待续"], position: "未济之时，尚未完成", danger: "未济急进，终无所成", transform: "乾卦——未济终乾", lines: ["濡其尾——濡其尾", "曳其轮——拖其轮", "未济征凶——未济征凶", "贞吉悔亡——贞吉悔亡", "贞吉无悔——贞吉无悔", "濡其首——濡其首"], trigrams: { upper: "离", lower: "坎" } }
};

const guaPatterns = {
    qian: ["创造", "创始", "领导", "主动", "扩张", "强大", "上升", "开始", "创业", "开创", "主导", "强势", "进取", "天", "乾"],
    kun: ["承载", "包容", "顺应", "滋养", "收敛", "被动", "接受", "基础", "支撑", "厚德", "母性", "地", "坤"],
    zhun: ["初创", "艰难", "混沌", "萌芽", "扎根", "起步", "困难", "新生", "种子", "孕育", "屯"],
    meng: ["启蒙", "教育", "学习", "蒙昧", "开智", "蒙"],
    xu: ["等待", "蓄积", "耐心", "时机", "准备", "需"],
    song: ["争讼", "冲突", "争执", "辩论", "诉讼", "讼"],
    shi: ["军队", "组织", "集体", "行动", "纪律", "师"],
    bi_gua: ["团结", "依附", "合作", "亲近", "联盟", "比"],
    xiaochu: ["蓄积", "小有", "积累", "准备", "成长", "畜"],
    lu: ["践行", "谨慎", "礼节", "行动", "秩序", "履"],
    tai: ["通达", "和谐", "顺利", "交流", "合作", "顺畅", "繁荣", "最佳", "泰"],
    pi: ["闭塞", "分离", "不通", "困难", "阻碍", "否塞", "不顺", "否"],
    tongren: ["同人", "团结", "共识", "合作", "同心", "同"],
    dayou: ["丰收", "拥有", "丰盛", "收获", "成功", "大有"],
    qian2: ["谦虚", "内敛", "低调", "平和", "退让", "谦"],
    yu: ["愉悦", "预备", "安乐", "享乐", "准备", "豫"],
    sui: ["随从", "顺应", "跟随", "适应", "灵活", "随"],
    gu: ["腐败", "革新", "整治", "改革", "除弊", "蛊"],
    lin: ["临民", "督导", "教化", "管理", "领导", "临"],
    guan: ["观察", "审视", "了解", "考察", "观望", "观"],
    shihe: ["决断", "刑罚", "法律", "咬合", "解决", "噬嗑"],
    bi2: ["文饰", "修饰", "美化", "外表", "礼仪", "贲"],
    bo: ["剥落", "衰败", "侵蚀", "削弱", "消亡", "剥"],
    fu: ["回复", "复兴", "回归", "开始", "循环", "复"],
    wuwang: ["真实", "无妄", "诚实", "自然", "本真", "无妄"],
    daxu: ["蓄积", "储备", "积累", "厚积", "待发", "大畜"],
    yi: ["颐养", "养生", "保养", "饮食", "言语", "颐"],
    daguo: ["过度", "极端", "非常", "危机", "转折", "大过"],
    kan: ["坎险", "困难", "危机", "重重", "陷落", "坎"],
    li: ["光明", "依附", "照耀", "文明", "美丽", "离"],
    xian: ["感应", "情感", "交流", "相通", "感受", "咸"],
    heng: ["恒久", "持久", "稳定", "坚持", "不变", "恒"],
    dun: ["遁退", "隐退", "远离", "避开", "退避", "遁"],
    dazhuang: ["强盛", "壮大", "气势", "力量", "强大", "大壮"],
    jin: ["晋升", "进步", "上升", "光明", "发展", "晋"],
    mingyi: ["受伤", "韬晦", "隐藏", "黑暗", "忍耐", "明夷"],
    jiaren: ["家庭", "内务", "齐家", "修身", "和睦", "家人"],
    kui: ["睽离", "背离", "分歧", "差异", "矛盾", "睽"],
    jian2: ["蹇难", "困难", "险阻", "停顿", "反思", "蹇"],
    jie: ["解脱", "释放", "解决", "放松", "舒展", "解"],
    sun: ["减损", "节制", "克制", "减少", "节约", "损"],
    yi2: ["增益", "受益", "进步", "改善", "发展", "益"],
    guai: ["决断", "决裂", "果断", "裁决", "决定", "夬"],
    gou: ["遇合", "邂逅", "相遇", "意外", "不期", "姤"],
    cui: ["萃聚", "聚集", "汇聚", "集合", "团结", "萃"],
    sheng: ["上升", "晋升", "发展", "成长", "进步", "升"],
    kun2: ["困穷", "困境", "穷困", "艰难", "窘迫", "困"],
    jing: ["井养", "滋养", "服务", "源泉", "供给", "井"],
    ge: ["变革", "革新", "改革", "除旧", "布新", "革"],
    ding: ["鼎立", "稳定", "正位", "凝命", "巩固", "鼎"],
    zhen: ["震动", "行动", "恐惧", "修省", "警醒", "震"],
    gen: ["止", "静止", "停止", "克制", "收敛", "艮"],
    jian3: ["渐进", "逐步", "循序", "稳步", "渐"],
    guimei: ["归妹", "嫁娶", "归宿", "结合", "婚姻", "归妹"],
    feng: ["丰盛", "盛大", "繁荣", "辉煌", "丰"],
    lu2: ["旅行", "漂泊", "流浪", "客居", "外出", "旅"],
    xun: ["巽顺", "顺从", "谦逊", "进入", "渗透", "巽"],
    dui: ["兑悦", "喜悦", "快乐", "和悦", "愉快", "兑"],
    huan: ["涣散", "离散", "分散", "解散", "疏散", "涣"],
    jie2: ["节制", "节约", "限制", "约束", "节度", "节"],
    zhongfu: ["诚信", "中孚", "信任", "诚实", "信用", "中孚"],
    xiaoguo: ["小过", "过度", "过分", "超过", "过失", "小过"],
    jiji: ["既济", "完成", "成功", "达成", "结束", "既济"],
    weiji: ["未济", "未完成", "未竟", "继续", "待续", "未济"]
};

const pratityaData = {
    avidya: { name: "无明", meaning: "无知、不明真理，对实相的误解", manifestation: "不了解因果、不知无常、执着于自我", inDecision: "因信息不全、认知偏差、情绪蒙蔽而做出错误判断", breakPoint: "获取真实信息、提升认知、觉察情绪", color: "node-avidya" },
    samskara: { name: "行", meaning: "因无明而产生的意志冲动、行为倾向", manifestation: "习惯性反应、冲动决策、业力惯性", inDecision: "被过往经验、惯性思维驱动的自动反应", breakPoint: "暂停、觉察冲动、打破自动化反应", color: "node-samskara" },
    vijnana: { name: "识", meaning: "认知、意识，对事物的识别与判断", manifestation: "贴标签、分类、形成初步认知框架", inDecision: "如何理解当前情境，赋予什么意义", breakPoint: "质疑初始认知、寻找多元视角", color: "node-vijnana" },
    namarupa: { name: "名色", meaning: "身心聚合，精神与物质的结合", manifestation: "自我身份认同、身体感受、心理状态", inDecision: "我的身份、角色、身体状态如何影响选择", breakPoint: "超越身份限制、觉察身心状态", color: "node-namarupa" },
    sadayatana: { name: "六入", meaning: "六根（眼耳鼻舌身意）接触外境的门户", manifestation: "感官开放、信息输入渠道", inDecision: "通过什么渠道获取信息，感官是否被操控", breakPoint: "关闭某些感官输入、选择信息源", color: "node-sadayatana" },
    sparsha: { name: "触", meaning: "根、境、识三者和合而产生的接触", manifestation: "与世界的第一次接触、触发点", inDecision: "什么触发了这个决策需求", breakPoint: "觉察触发点、选择是否回应", color: "node-sparsha" },
    vedana: { name: "受", meaning: "接触后产生的感受：苦、乐、不苦不乐", manifestation: "情绪反应、身体感受、心理舒适/不适", inDecision: "这个选择让我感觉如何，追求快乐回避痛苦", breakPoint: "不随感受起舞、平等看待苦乐", color: "node-vedana" },
    trishna: { name: "爱", meaning: "对乐受的贪爱、对苦受的嗔厌", manifestation: "渴望、执着、欲望、排斥", inDecision: "我真正渴望什么，恐惧什么", breakPoint: "区分需要与欲望、觉察贪婪", color: "node-trishna" },
    upadana: { name: "取", meaning: "对爱的强化执取，形成固定模式", manifestation: "占有欲、控制欲、僵化信念", inDecision: "我在执着什么，不愿放手的是什么", breakPoint: "练习放下、松动执着", color: "node-upadana" },
    bhava: { name: "有", meaning: "因执取而形成的存在状态、业力积聚", manifestation: "习惯模式、生活状态、存在方式", inDecision: "这个选择将我带向什么样的存在状态", breakPoint: "改变日常模式、创造新习惯", color: "node-bhava" },
    jati: { name: "生", meaning: "新的存在状态的产生", manifestation: "新身份、新角色、新开始", inDecision: "决策后将诞生的新自我", breakPoint: "觉察出生即苦、不执着于新身份", color: "node-jati" },
    jaramarana: { name: "老死", meaning: "衰变、消逝、终结", manifestation: "失去、结束、衰败、死亡焦虑", inDecision: "这个选择最终会导致什么终结", breakPoint: "接纳无常、向死而生", color: "node-jaramarana" }
};

const pratityaPatterns = {
    avidya: ["不知道", "不明白", "不懂", "误解", "错误认知", "盲目", "无知", "迷茫", "困惑", "不清楚", "无明"],
    samskara: ["冲动", "习惯", "惯性", "自动", "下意识", "本能", "反应", "倾向", "行"],
    vijnana: ["认为", "觉得", "看法", "认知", "理解", "判断", "识别", "标签", "定义", "识"],
    vedana: ["感觉", "感受", "情绪", "舒服", "不舒服", "快乐", "痛苦", "焦虑", "愉悦", "受"],
    trishna: ["想要", "渴望", "追求", "欲望", "喜欢", "讨厌", "贪", "怕", "恐惧", "希望", "爱"],
    upadana: ["执着", "坚持", "不放", "控制", "占有", "固守", "僵化", "模式", "习惯", "取"]
};

// ════════════════════════════════════════
// ANALYSIS ENGINE
// ════════════════════════════════════════
function matchGua(scenario, type) {
    const text = scenario.toLowerCase();
    let scores = {};
    for (let key in guaData) scores[key] = 0;

    for (let gua in guaPatterns) {
        guaPatterns[gua].forEach(kw => { if (text.includes(kw)) scores[gua] += 1; });
    }

    let maxScore = 0, bestGua = "weiji";
    for (let gua in scores) {
        if (scores[gua] > maxScore) { maxScore = scores[gua]; bestGua = gua; }
    }

    if (maxScore === 0) {
        const defaults = { personal: "qian", relationship: "tai", business: "tai", social: "tongren", creative: "qian", political: "ge" };
        bestGua = defaults[type] || "weiji";
    }

    return guaData[bestGua];
}

function matchPratitya(scenario, type) {
    const text = scenario.toLowerCase();
    let scores = {};
    for (let key in pratityaData) scores[key] = 0;

    for (let node in pratityaPatterns) {
        pratityaPatterns[node].forEach(kw => { if (text.includes(kw)) scores[node] += 1; });
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

function determineMovingYao(scenario) {
    let hash = 0;
    for (let i = 0; i < scenario.length; i++) {
        hash = ((hash << 5) - hash) + scenario.charCodeAt(i);
        hash |= 0;
    }
    const movingYao = (Math.abs(hash) % 6) + 1;
    return movingYao;
}

function calculateChangedGua(gua, movingYao) {
    const guaKeys = Object.keys(guaData);
    const currentIndex = guaKeys.findIndex(k => guaData[k].name === gua.name);
    const changedIndex = (currentIndex + movingYao) % guaKeys.length;
    return guaData[guaKeys[changedIndex]];
}

function crossAnalysis(gua, pratitya) {
    const analyses = {
        "qian-avidya": "创造冲动源于深层无知——不知道自己真正要什么，用扩张掩盖空虚。",
        "qian-trishna": "对成功的贪婪，永无止境的扩张欲望。",
        "qian-upadana": "执着于控制，不愿放手，刚愎自用。",
        "kun-avidya": "被动接受源于不知道自己有选择。",
        "tai-avidya": "和谐表象下可能隐藏着不愿面对的问题。",
        "pi-vedana": "痛苦感受被放大，陷入情绪漩涡。",
        "weiji-avidya": "未完成的状态源于根本性的认知盲区——不知道自己真正在寻找什么。"
    };
    const key = `${gua.name}-${pratitya.primary.key}`;
    return analyses[key] || `${gua.fullname}的${gua.phase}状态与「${pratitya.primary.name}」的卡点形成共振：${gua.danger}，而人性层面的${pratitya.primary.manifestation}加剧了这一困境。`;
}

function generateActions(gua, pratitya, changedGua) {
    const actions = [];
    actions.push({
        title: "状态调节",
        desc: `当前处于「${gua.phase}」态。${gua.transform}。`
    });
    actions.push({
        title: "断点干预",
        desc: `十二因缘链中，「${pratitya.primary.name}」是主要卡点。${pratitya.primary.breakPoint}。`
    });
    if (pratitya.secondary) {
        actions.push({
            title: "辅助干预",
            desc: `次要卡点「${pratitya.secondary.name}」也需关注。${pratitya.secondary.breakPoint}。`
        });
    }
    if (changedGua) {
        actions.push({
            title: "变卦启示",
            desc: `动爻引发变卦${changedGua.fullname}，提示事物将向「${changedGua.phase}」方向发展。${changedGua.meaning}`
        });
    }
    actions.push({
        title: "交叉策略",
        desc: `从${gua.name}卦看，${gua.transform}；从十二因缘看，需在「${pratitya.primary.name}」处建立觉察。两者结合：在${gua.name}卦提示的转化方向上，带着对${pratitya.primary.name}的觉知行动。`
    });
    return actions;
}

// ════════════════════════════════════════
// RENDER RESULTS
// ════════════════════════════════════════
function analyze() {
    const scenario = document.getElementById('scenario').value.trim();
    if (!scenario) {
        showToast('请先描述你想分析的现象');
        return;
    }

    if (window.YIYIN_ANIMATIONS) {
        window.YIYIN_ANIMATIONS.setAnalyzeButtonLoading(true);
    } else {
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div> 分析中...';
    }

    setTimeout(() => {
        const gua = matchGua(scenario, state.selectedType);
        const pratitya = matchPratitya(scenario, state.selectedType);
        const movingYao = determineMovingYao(scenario);
        const changedGua = calculateChangedGua(gua, movingYao);
        const cross = crossAnalysis(gua, pratitya);
        const actions = generateActions(gua, pratitya, changedGua);

        const result = { gua, pratitya, cross, actions, scenario, timestamp: Date.now(), movingYao, changedGua };
        state.currentResult = result;
        saveToHistory(result);
        renderResult(result);

        if (window.YIYIN_ANIMATIONS) {
            window.YIYIN_ANIMATIONS.setAnalyzeButtonLoading(false);
            setTimeout(() => window.YIYIN_ANIMATIONS.animateResultCards(), 50);
        } else {
            const btn = document.getElementById('analyzeBtn');
            btn.disabled = false;
            btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> 开始分析';
        }
    }, 800);
}

function renderResult(result) {
    const { gua, pratitya, cross, actions, movingYao, changedGua } = result;
    let html = '';

    if (state.selectedDim === 'all' || state.selectedDim === 'yijing') {
        html += `
        <div class="result-card" data-scroll-animation="fadeIn">
            <div class="result-header">
                <div class="gua-symbol">${gua.symbol}</div>
                <div class="gua-info">
                    <h3>${gua.fullname}</h3>
                    <div class="gua-meta">
                        <span class="tag tag-yang">${gua.nature}</span>
                        <span class="tag tag-phase">${gua.phase}</span>
                        ${movingYao ? `<span class="tag tag-info">动爻第${movingYao}爻</span>` : ''}
                    </div>
                </div>
            </div>
            <div style="margin-bottom:16px;">
                ${gua.keywords.map(k => `<span class="tag tag-yang">${k}</span>`).join('')}
            </div>
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
                            <div class="yao-bar ${i % 2 === 0 ? 'yang' : 'yin'} ${movingYao === i + 1 ? 'moving' : ''}"></div>
                            <span class="yao-text">${line}</span>
                            ${movingYao === i + 1 ? '<span class="yao-moving-badge">动</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            ${changedGua ? `
            <div class="changed-gua-section">
                <div class="changed-gua-header">
                    <div class="gua-symbol" style="width:40px;height:40px;font-size:20px;">${gua.symbol}</div>
                    <span class="changed-gua-arrow">→</span>
                    <div class="gua-symbol" style="width:40px;height:40px;font-size:20px;">${changedGua.symbol}</div>
                    <div class="changed-gua-info">
                        <h4>变卦 · ${changedGua.fullname}</h4>
                        <p>第${movingYao}爻动，事物向「${changedGua.phase}」方向演化</p>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>`;
    }

    if (state.selectedDim === 'all' || state.selectedDim === 'buddhism') {
        html += `
        <div class="result-card" data-scroll-animation="fadeIn">
            <div class="result-header">
                <div class="gua-symbol">☸</div>
                <div class="gua-info">
                    <h3>十二因缘分析</h3>
                    <div class="gua-meta">
                        <span class="tag tag-phase">人性驱动链条</span>
                    </div>
                </div>
            </div>
            <div class="chain-display">
                ${pratitya.chain.map((node, i) => `
                    <div class="chain-node ${node.data.color} ${node.isPrimary ? 'active' : ''}" title="${node.data.meaning}">
                        ${node.data.name}
                    </div>
                    ${i < pratitya.chain.length - 1 ? '<span class="chain-arrow">→</span>' : ''}
                `).join('')}
            </div>
            <div style="margin-bottom:16px;">
                <span class="tag tag-phase">主要卡点：${pratitya.primary.name}</span>
                ${pratitya.secondary ? `<span class="tag tag-yin">次要卡点：${pratitya.secondary.name}</span>` : ''}
            </div>
            <div class="content-block">
                <h4>主要卡点 · ${pratitya.primary.name}</h4>
                <p><strong style="color:var(--text-primary)">含义：</strong>${pratitya.primary.meaning}</p>
                <p><strong style="color:var(--text-primary)">表现：</strong>${pratitya.primary.manifestation}</p>
                <p><strong style="color:var(--text-primary)">在决策中：</strong>${pratitya.primary.inDecision}</p>
                <p><strong style="color:var(--success)">突破点：</strong>${pratitya.primary.breakPoint}</p>
            </div>
            ${pratitya.secondary ? `
            <div class="content-block">
                <h4>次要卡点 · ${pratitya.secondary.name}</h4>
                <p><strong style="color:var(--text-primary)">含义：</strong>${pratitya.secondary.meaning}</p>
                <p><strong style="color:var(--success)">突破点：</strong>${pratitya.secondary.breakPoint}</p>
            </div>
            ` : ''}
        </div>`;
    }

    if (state.selectedDim === 'all') {
        html += `
        <div class="result-card cross-analysis" data-scroll-animation="fadeIn">
            <div class="result-header">
                <div class="gua-symbol">◈</div>
                <div class="gua-info">
                    <h3>交叉分析</h3>
                    <div class="gua-meta">
                        <span class="tag tag-yang">${gua.fullname}</span>
                        <span class="tag tag-phase">${pratitya.primary.name}</span>
                    </div>
                </div>
            </div>
            <div class="content-block">
                <p>${cross}</p>
            </div>
        </div>
        <div class="result-card" data-scroll-animation="fadeIn">
            <div class="result-header">
                <div class="gua-symbol">◉</div>
                <div class="gua-info">
                    <h3>干预建议</h3>
                    <div class="gua-meta">
                        <span class="tag tag-phase">可操作策略</span>
                    </div>
                </div>
            </div>
            <div class="action-items">
                ${actions.map((action, i) => `
                    <div class="action-item">
                        <div class="action-num">${i + 1}</div>
                        <div class="action-content">
                            <h5>${action.title}</h5>
                            <p>${action.desc}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    document.getElementById('results').innerHTML = html;
    document.getElementById('results').classList.add('active');
    
    // Initialize scroll animations for new result cards
    setTimeout(() => {
        if (window.YIYIN_ANIMATIONS) {
            window.YIYIN_ANIMATIONS.initScrollAnimations();
        }
        document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
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
updateCompareBadge();
updateCharCount();
renderTimeDivination();
renderTags();

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
