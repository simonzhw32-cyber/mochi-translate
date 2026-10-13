# Mochi Translate 

一款的 Chrome/Edge 翻译插件。

## ✨ 功能特色

- 🤖 **多引擎翻译** — 支持百度（默认）、Google、微软、有道
- 📄 **全文翻译** — 自动检测外语页面，一键翻译为中文
- 🖱️ **选中翻译** — 选中文字右键点击即可翻译
- 🔄 **自动降级** — 主引擎失败自动切换备用引擎
- 🔒 **隐私优先** — 翻译请求直连翻译 API，不经过第三方服务器
- 📱 **响应式** — 支持桌面和移动设备



## 🚀 安装方法

### Chrome
1. 下载 `translate-plugin.zip` 并解压
2. 打开 `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择解压后的文件夹

### Edge
1. 打开 `edge://extensions/`
2. 开启「开发人员模式」
3. 点击「加载已解压的扩展」
4. 选择解压后的文件夹

## ⚙️ 设置

点击插件图标打开设置面板：
- 选择翻译引擎（百度/Google/微软/有道）
- 设置目标语言
- 开关选中翻译
- 开关悬浮窗

## 🛠️ 技术栈

- **Manifest V3** — 最新扩展标准
- **Web Crypto API** — 安全签名（有道翻译）
- **Service Worker** — 后台翻译服务

## 📁 项目结构

```
translate-plugin/
├── manifest.json          # 扩展配置
├── background/
│   └── service-worker.js  # 后台翻译服务
├── content/
│   ├── content.js         # 主脚本（宠物 + 翻译）
│   ├── content.css        # 基础样式
│   ├── mochi-pet.js       # 宠物类（备用）
│   └── float-window.css   # 悬浮窗样式
├── popup/
│   ├── popup.html         # 弹出面板
│   ├── popup.css          # 面板样式
│   └── popup.js           # 面板逻辑
├── options/
│   ├── options.html       # 设置页面
│   └── options.js         # 设置逻辑
├── utils/
│   ├── storage.js         # 存储工具
│   └── translator.js      # 翻译工具
├── assets/
    └── icons/             # 图标资源

```

## 📄 开源协议

MIT License

## 🙏 致谢

- [百度翻译](https://fanyi.baidu.com/) — 默认翻译引擎
- [Google Translate](https://translate.google.com/) — 备用翻译引擎
