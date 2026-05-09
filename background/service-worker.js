/**
 * 后台服务 - Service Worker (修复版)
 * 
 * 修复清单:
 * - 默认使用百度翻译（国内可用）
 * - 添加请求超时机制
 * - 完善 HTTP 状态检查
 * - 添加自动降级（主引擎失败自动切换备用）
 * - 完善消息监听和错误处理
 */

const STORAGE_KEY = 'mochi_translate_settings';

// 翻译引擎优先级
const ENGINE_FALLBACK = ['baidu', 'google', 'youdao', 'microsoft'];

// 初始化右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: '🟤 麻薯翻译选中内容',
    contexts: ['selection']
  });
  chrome.contextMenus.create({
    id: 'translate-page',
    title: '📄 翻译整页',
    contexts: ['page']
  });
  updateIcon(true);
});

// 右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'translate-selection' && info.selectionText) {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'translateSelection',
        text: info.selectionText
      });
    } else if (info.menuItemId === 'translate-page') {
      await chrome.tabs.sendMessage(tab.id, { action: 'translatePage' });
    }
  } catch (e) {
    console.warn('无法发送消息到当前页面（可能是不支持的页面）', e);
  }
});

// 消息监听（完善版）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslation(request.text, request.targetLang, request.sourceLang)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
  
  if (request.action === 'updateStatus') {
    updateIcon(request.enabled);
    sendResponse({ success: true });
    return true;
  }
});

/**
 * 获取带超时的 fetch
 */
async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络');
    }
    throw error;
  }
}

/**
 * 处理翻译请求（带自动降级）
 */
async function handleTranslation(text, targetLang, sourceLang) {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const config = result[STORAGE_KEY] || {};
  const engine = config.engine || 'baidu';
  
  // 翻译引擎列表（主引擎 + 备用）
  const engines = [];
  
  // 添加用户选择的引擎
  if (engine && canUseEngine(engine, config)) {
    engines.push(engine);
  }
  
  // 添加备用引擎
  ENGINE_FALLBACK.forEach(e => {
    if (e !== engine && canUseEngine(e, config) && !engines.includes(e)) {
      engines.push(e);
    }
  });
  
  if (engines.length === 0) {
    throw new Error('没有可用的翻译引擎，请在设置中配置');
  }
  
  // 依次尝试每个引擎
  const errors = [];
  for (const eng of engines) {
    try {
      const result = await translateWith(eng, text, targetLang, sourceLang, config);
      return result;
    } catch (error) {
      errors.push(`${eng}: ${error.message}`);
      console.warn(`[翻译] ${eng} 失败:`, error.message);
    }
  }
  
  throw new Error(`所有翻译引擎均失败:\n${errors.join('\n')}`);
}

function canUseEngine(engine, config) {
  if (engine === 'baidu') return true;
  if (engine === 'google') return true;
  if (engine === 'microsoft') return !!(config.microsoftKey);
  if (engine === 'youdao') return !!(config.youdaoAppId && config.youdaoAppKey);
  return false;
}

async function translateWith(engine, text, targetLang, sourceLang, config) {
  switch (engine) {
    case 'baidu': return translateWithBaidu(text, targetLang, sourceLang);
    case 'google': return translateWithGoogle(text, targetLang, sourceLang);
    case 'microsoft': return translateWithMicrosoft(text, targetLang, sourceLang, config.microsoftKey, config.microsoftRegion);
    case 'youdao': return translateWithYoudao(text, targetLang, sourceLang, config.youdaoAppId, config.youdaoAppKey);
    default: throw new Error(`未知引擎: ${engine}`);
  }
}

// ===== 百度翻译（国内可用，免费） =====

async function translateWithBaidu(text, targetLang, sourceLang) {
  // 百度翻译免费 API（无需 key，使用网页版接口）
  // 语言代码映射
  const langMap = {
    'auto': 'auto', 'zh-CN': 'zh', 'en': 'en', 'ja': 'jp',
    'ko': 'kor', 'fr': 'fra', 'de': 'de', 'es': 'spa',
    'ru': 'ru', 'pt': 'pt', 'it': 'it', 'ar': 'ara',
    'th': 'th', 'vi': 'vie'
  };
  
  const to = langMap[targetLang] || targetLang;
  const from = langMap[sourceLang] || sourceLang;
  
  const url = `https://fanyi.baidu.com/sug`;
  const body = `kw=${encodeURIComponent(text)}`;
  
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  
  if (!response.ok) {
    throw new Error(`百度翻译 HTTP ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.data || data.data.length === 0) {
    throw new Error('百度翻译未返回结果');
  }
  
  return {
    translated: data.data[0].v || data.data.map(d => d.v).join('; '),
    detected: from === 'auto' ? 'auto' : from,
    engine: 'baidu'
  };
}

// ===== Google 翻译（备用，国内可能不可用） =====

async function translateWithGoogle(text, targetLang, sourceLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  
  const response = await fetchWithTimeout(url, {}, 5000);
  
  if (!response.ok) {
    throw new Error(`Google 翻译 HTTP ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data || !data[0] || !data[0].length) {
    throw new Error('Google 翻译返回数据异常');
  }
  
  const translated = data[0].map(item => item[0] || '').join('');
  
  if (!translated) {
    throw new Error('Google 翻译结果为空');
  }
  
  return {
    translated,
    detected: data[2] || sourceLang,
    engine: 'google'
  };
}

// ===== 微软翻译 =====

async function translateWithMicrosoft(text, targetLang, sourceLang, key, region = 'eastasia') {
  if (!key) throw new Error('微软翻译需要 API Key');
  
  const endpoint = 'https://api.cognitive.microsofttranslator.com/translate';
  const url = `${endpoint}?api-version=3.0&to=${targetLang}${sourceLang !== 'auto' ? `&from=${sourceLang}` : ''}`;
  
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Ocp-Apim-Subscription-Region': region,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([{ text }])
  });
  
  if (!response.ok) {
    throw new Error(`微软翻译 HTTP ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message);
  }
  
  return {
    translated: data[0].translations[0].text,
    detected: data[0].detectedLanguage?.language || sourceLang,
    engine: 'microsoft'
  };
}

// ===== 有道翻译 =====

async function translateWithYoudao(text, targetLang, sourceLang, appId, appKey) {
  if (!appId || !appKey) throw new Error('有道翻译需要 AppID 和 AppKey');
  
  const salt = Date.now().toString();
  const curtime = Math.floor(Date.now() / 1000);
  const input = text.length > 20 
    ? text.substring(0, 10) + text.length + text.substring(text.length - 10)
    : text;
  
  // 使用 Web Crypto API（Service Worker 兼容）
  const encoder = new TextEncoder();
  const signStr = appId + input + salt + curtime + appKey;
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(signStr));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const sign = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const langMap = { 'zh-CN': 'zh-CHS', 'auto': 'auto' };
  const params = new URLSearchParams({
    q: text,
    from: langMap[sourceLang] || sourceLang,
    to: langMap[targetLang] || targetLang,
    appKey: appId,
    salt,
    sign,
    signType: 'v3',
    curtime
  });

  const response = await fetchWithTimeout(`https://openapi.youdao.com/api?${params}`);
  
  if (!response.ok) {
    throw new Error(`有道翻译 HTTP ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.errorCode !== '0') {
    throw new Error(`有道错误码: ${data.errorCode}`);
  }
  
  return {
    translated: data.translation[0],
    detected: data.l.split('2')[0] || sourceLang,
    engine: 'youdao'
  };
}

/**
 * 更新图标状态
 */
async function updateIcon(enabled) {
  chrome.action.setBadgeText({ text: enabled ? '' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: '#999' });
}

// 监听 storage 变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes[STORAGE_KEY]) {
    const newSettings = changes[STORAGE_KEY].newValue;
    updateIcon(newSettings.selectionTranslateEnabled !== false);
  }
});