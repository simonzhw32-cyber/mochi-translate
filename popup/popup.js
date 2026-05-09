/**
 * Popup 控制逻辑
 */

// 默认设置
const DEFAULT_SETTINGS = {
  engine: 'baidu',
  targetLang: 'zh-CN',
  sourceLang: 'auto',
  selectionTranslateEnabled: true,
  floatWindowEnabled: true,
  microsoftKey: '',
  microsoftRegion: 'eastasia',
  youdaoAppId: '',
  youdaoAppKey: ''
};

const STORAGE_KEY = 'mochi_translate_settings';

// DOM 元素
const els = {
  enableTranslate: document.getElementById('enableTranslate'),
  enableFloat: document.getElementById('enableFloat'),
  sourceLang: document.getElementById('sourceLang'),
  targetLang: document.getElementById('targetLang'),
  engine: document.getElementById('engine'),
  apiConfig: document.getElementById('apiConfig'),
  translatePage: document.getElementById('translatePage'),
  translateClipboard: document.getElementById('translateClipboard'),
  openOptions: document.getElementById('openOptions'),
  feedback: document.getElementById('feedback')
};

// 初始化：加载保存的设置
async function init() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const settings = result[STORAGE_KEY] || { ...DEFAULT_SETTINGS };
  
  // 恢复 UI 状态
  els.enableTranslate.checked = settings.selectionTranslateEnabled;
  els.enableFloat.checked = settings.floatWindowEnabled;
  els.sourceLang.value = settings.sourceLang || 'auto';
  els.targetLang.value = settings.targetLang || 'zh-CN';
  els.engine.value = settings.engine || 'google';
  
  updateApiConfigVisibility(settings.engine);
}

// 保存设置
async function saveSetting(key, value) {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const settings = result[STORAGE_KEY] || { ...DEFAULT_SETTINGS };
  settings[key] = value;
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
  
  // 通知 content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'settingsUpdated',
        settings
      });
    }
  });
}

// 更新 API 配置提示显示
function updateApiConfigVisibility(engine) {
  if (engine === 'google') {
    els.apiConfig.classList.add('hidden');
  } else {
    els.apiConfig.classList.remove('hidden');
    const hint = els.apiConfig.querySelector('.config-hint');
    if (engine === 'microsoft') {
      hint.textContent = '⚙️ 请在设置页面配置微软翻译 API Key';
    } else if (engine === 'youdao') {
      hint.textContent = '⚙️ 请在设置页面配置有道翻译 AppID + AppKey';
    }
  }
}

// ===== 事件绑定 =====

// 开关：启用翻译
els.enableTranslate.addEventListener('change', async () => {
  const enabled = els.enableTranslate.checked;
  await saveSetting('selectionTranslateEnabled', enabled);
  // 通知 background 更新图标
  chrome.runtime.sendMessage({ action: 'updateStatus', enabled });
});

// 开关：悬浮窗
els.enableFloat.addEventListener('change', async () => {
  await saveSetting('floatWindowEnabled', els.enableFloat.checked);
});

// 源语言
els.sourceLang.addEventListener('change', async () => {
  await saveSetting('sourceLang', els.sourceLang.value);
});

// 目标语言
els.targetLang.addEventListener('change', async () => {
  await saveSetting('targetLang', els.targetLang.value);
});

// 翻译引擎
els.engine.addEventListener('change', async () => {
  const engine = els.engine.value;
  await saveSetting('engine', engine);
  updateApiConfigVisibility(engine);
});

// 翻译当前页面
els.translatePage.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'translatePage' });
      window.close();
    }
  });
});

// 翻译剪贴板
els.translateClipboard.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text && text.trim()) {
      // 发送到 content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'translateSelection',
            text: text.trim()
          });
          window.close();
        }
      });
    } else {
      // 显示提示
      const btn = els.translateClipboard;
      const original = btn.textContent;
      btn.textContent = '📭 剪贴板为空';
      setTimeout(() => { btn.textContent = original; }, 1500);
    }
  } catch (err) {
    const btn = els.translateClipboard;
    const original = btn.textContent;
    btn.textContent = '❌ 无法读取剪贴板';
    setTimeout(() => { btn.textContent = original; }, 1500);
  }
});

// 打开设置
els.openOptions.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// 反馈（暂未实现）
els.feedback.addEventListener('click', (e) => {
  e.preventDefault();
  const btn = e.target;
  const original = btn.textContent;
  btn.textContent = '🎉 感谢使用！';
  setTimeout(() => { btn.textContent = original; }, 2000);
});

// 初始化
init();