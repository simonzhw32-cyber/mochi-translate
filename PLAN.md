# 翻译插件开发计划

## 📋 需求概述

一个跨平台翻译插件，支持浏览器和办公软件，使用有道翻译 API。

### 目标平台
- ✅ Chrome 浏览器插件（优先）
- ✅ Edge 浏览器插件（Chrome 插件可直接安装）
- ⏳ WPS 插件（后续）

### 翻译引擎
- 有道翻译 API
- API Key: `sk-7b6770a0e4a2e8fa0968c6721dbe62be2b9cb4e0982cbfd5e6263ea3bdb8d976`
- ⚠️ 待验证 key 格式是否正确

### 核心功能
1. **网页整页翻译** - 翻译当前网页所有文本
2. **选中文字翻译** - 选中后即时翻译
3. **复制粘贴翻译** - 粘贴板内容翻译
4. **文档翻译** - 上传文档翻译（浏览器版可能需要限制）

### 交互设计
- 自动检测源语言
- 默认：英语 → 中文
- 可手动选择其他语言对
- 开关状态可见（Toolbar 图标/Popup 界面）
- 悬浮窗：卡通风格 🎨

---

## 🛠 技术架构

### 浏览器插件 (Chrome/Edge)

```
translate-plugin/
├── manifest.json          # 插件配置
├── popup/                 # 弹窗界面
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/               # 内容脚本（注入网页）
│   ├── content.js
│   ├── content.css
│   └── float-window.js    # 悬浮窗组件
├── background/            # 后台服务
│   └── service-worker.js
├── utils/
│   ├── translator.js      # 翻译 API 封装
│   ├── detector.js        # 语言检测
│   └── storage.js         # 本地存储
├── assets/
│   ├── icons/
│   └── cartoon-theme/     # 卡通风格素材
└── options/               # 设置页面
    ├── options.html
    └── options.js
```

### 技术栈
- **Manifest V3** (Chrome 最新标准)
- **纯 JavaScript** (无框架依赖，轻量)
- **CSS3** 动画 + 卡通主题
- **Chrome APIs**: storage, tabs, contextMenus, runtime

---

## 📅 开发阶段

### Phase 1: 基础架构 (Day 1)
- [ ] 项目初始化
- [ ] manifest.json 配置
- [ ] 验证有道翻译 API Key
- [ ] 基础 popup 界面
- [ ] 后台 service-worker

### Phase 2: 核心功能 (Day 2-3)
- [ ] 选中文字翻译
- [ ] 悬浮窗显示（卡通风格）
- [ ] 语言自动检测
- [ ] 翻译结果缓存

### Phase 3: 高级功能 (Day 4-5)
- [ ] 整页翻译
- [ ] 复制粘贴翻译
- [ ] 设置页面（语言偏好、API 配置）
- [ ] 开关状态管理

### Phase 4: 优化 & 打包 (Day 6)
- [ ] 性能优化
- [ ] 错误处理
- [ ] UI/UX 打磨
- [ ] 打包发布

### Phase 5: WPS 插件 (后续)
- [ ] 调研 WPS 插件开发方式
- [ ] 复用翻译核心逻辑
- [ ] WPS 特定适配

---

## 🎨 悬浮窗设计（卡通风格）

### 视觉风格
- 圆角卡片 + 阴影
- 可爱的配色（浅蓝/粉/黄）
- 简笔画图标
- 弹跳/渐变动画
- 可拖拽移动

### 交互
- 鼠标悬停放大
- 点击复制译文
- 关闭按钮（小叉号）
- 拖拽定位

---

## ⚠️ 待确认事项

1. **API Key 格式**: 有道官方 key 通常是 `应用ID + 密钥`，提供的 key 格式需要验证
2. **API 配额**: 免费版有调用限制，需要确认
3. **WPS 插件**: WPS 使用 JavaScript API，但需要 WPS 开发者账号

---

## 🚀 开始开发

确认以上计划后，从 Phase 1 开始实施。