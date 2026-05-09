/**
 * 本地存储工具
 * 使用 Chrome Storage API 持久化用户设置
 */

const STORAGE_KEY = 'mochi_translate_settings';

const DEFAULT_SETTINGS = {
  // 翻译引擎: baidu | google | microsoft | youdao
  engine: 'baidu',
  // 默认目标语言
  targetLang: 'zh-CN',
  // 是否启用整页翻译
  pageTranslateEnabled: false,
  // 是否启用选中翻译
  selectionTranslateEnabled: true,
  // 是否启用悬浮窗
  floatWindowEnabled: true,
  // 悬浮窗位置
  floatWindowPosition: { x: 100, y: 100 },
  // 微软翻译配置
  microsoftKey: '',
  microsoftRegion: 'global',
  // 有道翻译配置
  youdaoAppId: '',
  youdaoAppKey: ''
};

class Storage {
  /**
   * 获取设置
   * @param {string} key - 可选，获取单个设置项
   * @returns {Promise<any>}
   */
  static async get(key) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(STORAGE_KEY, (result) => {
        const settings = result[STORAGE_KEY] || { ...DEFAULT_SETTINGS };
        resolve(key ? settings[key] : settings);
      });
    });
  }

  /**
   * 更新设置
   * @param {object} updates - 要更新的键值对
   */
  static async set(updates) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(STORAGE_KEY, (result) => {
        const settings = result[STORAGE_KEY] || { ...DEFAULT_SETTINGS };
        Object.assign(settings, updates);
        chrome.storage.sync.set({ [STORAGE_KEY]: settings }, resolve);
      });
    });
  }

  /**
   * 重置为默认设置
   */
  static async reset() {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [STORAGE_KEY]: { ...DEFAULT_SETTINGS } }, resolve);
    });
  }

  /**
   * 获取默认设置
   */
  static getDefaults() {
    return { ...DEFAULT_SETTINGS };
  }
}

export default Storage;
export { DEFAULT_SETTINGS };
