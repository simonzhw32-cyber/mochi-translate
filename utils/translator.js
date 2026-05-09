/**
 * 翻译引擎封装 - 支持多种翻译 API
 * 可插拔架构，方便切换翻译服务商
 */

class Translator {
  constructor() {
    this.engine = 'google'; // 默认使用 Google 翻译
    this.microsoftKey = null; // 微软翻译 API Key（后续配置）
    this.youdaoId = null; // 有道应用 ID
    this.youdaoKey = null; // 有道密钥
  }

  /**
   * 设置翻译引擎
   * @param {string} engine - 'google' | 'microsoft' | 'youdao'
   * @param {object} config - 引擎配置
   */
  setEngine(engine, config = {}) {
    this.engine = engine;
    if (engine === 'microsoft') {
      this.microsoftKey = config.key;
    } else if (engine === 'youdao') {
      this.youdaoId = config.appId;
      this.youdaoKey = config.appKey;
    }
  }

  /**
   * 检测语言
   * @param {string} text - 待检测文本
   * @returns {Promise<string>} - 语言代码
   */
  async detectLanguage(text) {
    // 使用 Google 的语言检测（免费）
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
      const response = await fetch(url);
      const data = await response.json();
      return data[2] || 'auto'; // 返回检测到的语言代码
    } catch (error) {
      console.error('Language detection failed:', error);
      return 'auto';
    }
  }

  /**
   * 翻译文本
   * @param {string} text - 待翻译文本
   * @param {string} targetLang - 目标语言（默认中文）
   * @param {string} sourceLang - 源语言（默认自动检测）
   * @returns {Promise<object>} - { translated: string, detected: string }
   */
  async translate(text, targetLang = 'zh-CN', sourceLang = 'auto') {
    switch (this.engine) {
      case 'google':
        return this.translateWithGoogle(text, targetLang, sourceLang);
      case 'microsoft':
        return this.translateWithMicrosoft(text, targetLang, sourceLang);
      case 'youdao':
        return this.translateWithYoudao(text, targetLang, sourceLang);
      default:
        return this.translateWithGoogle(text, targetLang, sourceLang);
    }
  }

  /**
   * Google 翻译（免费，无需 key）
   */
  async translateWithGoogle(text, targetLang, sourceLang) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      const response = await fetch(url);
      const data = await response.json();
      
      // 拼接翻译结果
      const translated = data[0].map(item => item[0]).join('');
      const detected = data[2] || sourceLang;
      
      return {
        translated,
        detected,
        engine: 'google'
      };
    } catch (error) {
      throw new Error(`Google 翻译失败: ${error.message}`);
    }
  }

  /**
   * 微软翻译（需要 Azure key）
   * 每月免费 200 万字符
   */
  async translateWithMicrosoft(text, targetLang, sourceLang) {
    if (!this.microsoftKey) {
      throw new Error('微软翻译需要 API Key，请先在设置中配置');
    }

    try {
      const endpoint = 'https://api.cognitive.microsofttranslator.com/translate';
      const url = `${endpoint}?api-version=3.0&to=${targetLang}${sourceLang !== 'auto' ? `&from=${sourceLang}` : ''}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.microsoftKey,
          'Ocp-Apim-Subscription-Region': 'global',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{ text }])
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      return {
        translated: data[0].translations[0].text,
        detected: data[0].detectedLanguage?.language || sourceLang,
        engine: 'microsoft'
      };
    } catch (error) {
      throw new Error(`微软翻译失败: ${error.message}`);
    }
  }

  /**
   * 有道翻译（需要 AppID + AppKey）
   */
  async translateWithYoudao(text, targetLang, sourceLang) {
    if (!this.youdaoId || !this.youdaoKey) {
      throw new Error('有道翻译需要 AppID 和 AppKey，请先在设置中配置');
    }

    try {
      const crypto = await import('crypto');
      const salt = Date.now().toString();
      const curtime = Math.floor(Date.now() / 1000);
      const input = text.length > 20 
        ? text.substring(0, 10) + text.length + text.substring(text.length - 10)
        : text;
      
      const signStr = this.youdaoId + input + salt + curtime + this.youdaoKey;
      const sign = crypto.createHash('sha256').update(signStr).digest('hex');

      const params = new URLSearchParams({
        q: text,
        from: sourceLang === 'auto' ? 'auto' : sourceLang,
        to: targetLang === 'zh-CN' ? 'zh-CHS' : targetLang,
        appKey: this.youdaoId,
        salt,
        sign,
        signType: 'v3',
        curtime
      });

      const response = await fetch(`https://openapi.youdao.com/api?${params}`);
      const data = await response.json();

      if (data.errorCode !== '0') {
        throw new Error(`有道错误码: ${data.errorCode}`);
      }

      return {
        translated: data.translation[0],
        detected: data.l.split('2')[0] || sourceLang,
        engine: 'youdao'
      };
    } catch (error) {
      throw new Error(`有道翻译失败: ${error.message}`);
    }
  }
}

// 导出单例
const translator = new Translator();
export default translator;
