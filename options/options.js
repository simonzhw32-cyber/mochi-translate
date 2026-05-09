/**
 * 设置页面逻辑
 */

const STORAGE_KEY = 'mochi_translate_settings';

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

// DOM 元素
const els = {
  engine: document.getElementById('engine'),
  targetLang: document.getElementById('targetLang'),
  microsoftConfig: document.getElementById('microsoftConfig'),
  microsoftKey: document.getElementById('microsoftKey'),
  microsoftRegion: document.getElementById('microsoftRegion'),
  youdaoConfig: document.getElementById('youdaoConfig'),
  youdaoAppId: document.getElementById('youdaoAppId'),
  youdaoAppKey: document.getElementById('youdaoAppKey'),
  save: document.getElementById('save'),
  reset: document.getElementById('reset'),
  status: document.getElementById('status')
};

// 加载设置
async function loadSettings() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const settings = result[STORAGE_KEY] || { ...DEFAULT_SETTINGS };
  
  // 填充表单
  els.engine.value = settings.engine || 'google';
  els.targetLang.value = settings.targetLang || 'zh-CN';
  els.microsoftKey.value = settings.microsoftKey || '';
  els.microsoftRegion.value = settings.microsoftRegion || 'global';
  els.youdaoAppId.value = settings.youdaoAppId || '';
  els.youdaoAppKey.value = settings.youdaoAppKey || '';
  
  updateConfigVisibility();
}

// 保存设置
async function saveSettings() {
  const settings = {
    engine: els.engine.value,
    targetLang: els.targetLang.value,
    sourceLang: 'auto',
    selectionTranslateEnabled: true,
    floatWindowEnabled: true,
    microsoftKey: els.microsoftKey.value.trim(),
    microsoftRegion: els.microsoftRegion.value,
    youdaoAppId: els.youdaoAppId.value.trim(),
    youdaoAppKey: els.youdaoAppKey.value.trim()
  };
  
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
  
  // 显示成功提示
  els.status.classList.add('success');
  setTimeout(() => {
    els.status.classList.remove('success');
  }, 2000);
}

// 重置设置
async function resetSettings() {
  if (confirm('确定要恢复默认设置吗？')) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: { ...DEFAULT_SETTINGS } });
    await loadSettings();
  }
}

// 更新配置区域可见性
function updateConfigVisibility() {
  const engine = els.engine.value;
  
  // 默认隐藏所有配置
  els.microsoftConfig.style.display = 'none';
  els.youdaoConfig.style.display = 'none';
  
  if (engine === 'microsoft') {
    els.microsoftConfig.style.display = 'block';
  } else if (engine === 'youdao') {
    els.youdaoConfig.style.display = 'block';
  }
}

// 事件绑定
els.engine.addEventListener('change', updateConfigVisibility);
els.save.addEventListener('click', saveSettings);
els.reset.addEventListener('click', resetSettings);

// 初始化
loadSettings();