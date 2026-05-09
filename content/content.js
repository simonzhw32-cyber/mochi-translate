/**
 * 内容脚本 - 整合版
 * 包含麻薯宠物 + 翻译功能
 */

(function() {
  // 防重复注入
  if (window.__mochiTranslateInjected) return;
  window.__mochiTranslateInjected = true;

  // 配置
  let settings = {
    selectionTranslateEnabled: true,
    floatWindowEnabled: true,
    targetLang: 'zh-CN'
  };

  // 加载设置
  try {
    chrome.storage.sync.get('mochi_translate_settings', (result) => {
      if (result.mochi_translate_settings) {
        Object.assign(settings, result.mochi_translate_settings);
      }
    });
  } catch (e) {}

  // ==================== 麻薯宠物类 ====================
  class MochiPet {
    constructor(container, options = {}) {
      this.container = container || document.body;
      this.config = {
        size: 140,
        x: options.x || window.innerWidth - 180,
        y: options.y || window.innerHeight - 200,
        onTranslate: options.onTranslate || null,
        ...options
      };

      this.state = {
        expression: 'normal',
        mood: 100,
        hunger: 0,
        petting: false,
        petTimer: 0,
        blinkTimer: 0,
        isBlinking: false,
        breathPhase: 0,
        jumpY: 0,
        scale: 1,
        targetScale: 1,
        particles: [],
        speechBubble: null,
        menuOpen: false,
        dragging: false,
        dragOffsetX: 0,
        dragOffsetY: 0,
        mouseX: 0,
        mouseY: 0,
        // selectedText 已删除（改为按需获取）
        fedCount: 0,
        lastInteraction: Date.now(),
      };

      this.createCanvas();
      this.bindEvents();
      this.running = true;
      this.lastTime = performance.now();
      this.animate(this.lastTime);
    }

    createCanvas() {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 240;
      this.canvas.height = 260;
      this.canvas.id = 'mochi-pet-canvas';
      this.canvas.style.cssText = `
        position: fixed;
        z-index: 2147483646;
        cursor: grab;
        pointer-events: auto;
        left: ${this.config.x}px;
        top: ${this.config.y}px;
        filter: drop-shadow(0 4px 12px rgba(139, 90, 43, 0.25));
      `;
      
      if (this.container && this.container.appendChild) {
        this.container.appendChild(this.canvas);
      } else {
        document.body.appendChild(this.canvas);
      }
      
      this.ctx = this.canvas.getContext('2d');
    }

    bindEvents() {
      document.addEventListener('mousemove', (e) => {
        this.state.mouseX = e.clientX;
        this.state.mouseY = e.clientY;
      });

      this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
      this.canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.onPointerDown(e.touches[0]);
      }, { passive: false });

      document.addEventListener('mousemove', (e) => {
        if (this.state.dragging) this.onPointerMove(e);
      });
      document.addEventListener('touchmove', (e) => {
        if (this.state.dragging) this.onPointerMove(e.touches[0]);
      }, { passive: false });

      document.addEventListener('mouseup', () => this.onPointerUp());
      document.addEventListener('touchend', () => this.onPointerUp());

      this.canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.toggleMenu();
      });

      // 不再自动监听文字选择（改为按需获取，避免弹窗干扰）
      // document.addEventListener('mouseup', () => {...});
    }

    getCanvasCenter() {
      const rect = this.canvas.getBoundingClientRect();
      return { x: rect.left + this.canvas.width / 2, y: rect.top + this.canvas.height / 2 - 20 };
    }

    getHitArea(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2 - 20;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx / (65 * 65) + dy * dy / (60 * 60) <= 1) {
        return dy < -15 ? 'head' : 'body';
      }
      return null;
    }

    onPointerDown(e) {
      this.state.lastInteraction = Date.now();
      this.closeMenu();

      const hit = this.getHitArea(e);
      
      if (hit === 'head') {
        this.state.petting = true;
        this.state.petTimer = 0;
        this.setExpression('happy');
        this.addParticles('heart', 3);
        this.showSpeech('好舒服~ 🥰');
      } else if (hit === 'body') {
        this.state.dragging = true;
        const rect = this.canvas.getBoundingClientRect();
        this.state.dragOffsetX = e.clientX - rect.left;
        this.state.dragOffsetY = e.clientY - rect.top;
        this.canvas.style.cursor = 'grabbing';
        
        if (this.state.expression === 'sleeping') {
          this.setExpression('surprised');
          this.showSpeech('！？');
        }
      }
    }

    onPointerMove(e) {
      if (this.state.dragging) {
        this.canvas.style.left = (e.clientX - this.state.dragOffsetX) + 'px';
        this.canvas.style.top = (e.clientY - this.state.dragOffsetY) + 'px';
      }
      if (this.state.petting) {
        this.state.petTimer++;
        if (this.state.petTimer % 15 === 0) {
          this.addParticles('heart', 2);
          this.state.mood = Math.min(100, this.state.mood + 2);
        }
      }
    }

    onPointerUp() {
      if (this.state.petting) {
        this.state.petting = false;
        if (this.state.petTimer > 20) {
          this.showSpeech('嘿嘿~ 😊');
          this.addParticles('star', 5);
        }
        setTimeout(() => this.setExpression('normal'), 1500);
      }
      if (this.state.dragging) {
        this.state.dragging = false;
        this.canvas.style.cursor = 'grab';
      }
    }

    setExpression(expr) {
      this.state.expression = expr;
      this.state.lastInteraction = Date.now();
    }

    toggleMenu() {
      this.state.menuOpen = !this.state.menuOpen;
      this.createOrUpdateMenu();
    }

    closeMenu() {
      this.state.menuOpen = false;
      const menu = document.getElementById('mochi-menu');
      if (menu) menu.style.display = 'none';
    }

    createOrUpdateMenu() {
      let menu = document.getElementById('mochi-menu');
      
      if (!menu) {
        menu = document.createElement('div');
        menu.id = 'mochi-menu';
        menu.innerHTML = `
          <div class="mochi-menu-item" data-action="translate">📝 翻译选中文字</div>
          <div class="mochi-menu-item" data-action="feed">🍣 喂食</div>
          <div class="mochi-menu-item" data-action="happy">😄 开心</div>
          <div class="mochi-menu-item" data-action="surprised">😲 惊讶</div>
          <div class="mochi-menu-item" data-action="sleeping">😴 睡觉</div>
          <div class="mochi-menu-item" data-action="hide">🙈 隐藏</div>
        `;
        
        // 样式
        const style = document.createElement('style');
        style.textContent = `
          #mochi-menu {
            position: fixed; z-index: 2147483647;
            background: linear-gradient(135deg, #fff8f0, #fff0e6);
            border: 2px solid #f5d5b8; border-radius: 14px;
            padding: 6px 0; box-shadow: 0 6px 24px rgba(139, 90, 43, 0.15);
            font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            min-width: 130px; display: none;
          }
          .mochi-menu-item {
            padding: 8px 14px; font-size: 12px; color: #5a4030;
            cursor: pointer; transition: background 0.15s; user-select: none;
          }
          .mochi-menu-item:hover { background: rgba(245, 213, 184, 0.5); }
        `;
        document.head.appendChild(style);
        document.body.appendChild(menu);
      }
      
      if (this.state.menuOpen) {
        const rect = this.canvas.getBoundingClientRect();
        menu.style.left = (rect.left + rect.width / 2 - 65) + 'px';
        menu.style.top = (rect.top - 10) + 'px';
        menu.style.transform = 'translateY(-100%)';
        menu.style.display = 'block';

        menu.querySelectorAll('.mochi-menu-item').forEach(item => {
          item.onclick = () => {
            this.handleMenuAction(item.dataset.action);
          };
        });
      } else {
        menu.style.display = 'none';
      }
    }

    handleMenuAction(action) {
      this.closeMenu();
      this.state.lastInteraction = Date.now();
      
      switch (action) {
        case 'translate':
          // 按需获取选中文字（不再预先监听）
          const sel = window.getSelection();
          const text = sel ? sel.toString().trim() : '';
          
          if (text && text.length < 500) {
            this.showSpeech('翻译中... 🔍');
            this.setExpression('surprised');
            if (this.config.onTranslate) {
              this.config.onTranslate(text, (result) => {
                this.showSpeech(result, 5000);
                this.setExpression('happy');
                setTimeout(() => this.setExpression('normal'), 3000);
              });
            } else {
              this.showSpeech('翻译功能未连接 😅', 2000);
              this.setExpression('normal');
            }
          } else {
            this.showSpeech('先选中文字再点我哦~', 2000);
            this.setExpression('surprised');
            setTimeout(() => this.setExpression('normal'), 2000);
          }
          break;
        case 'feed':
          this.feed();
          break;
        case 'happy':
          this.setExpression('happy');
          this.addParticles('star', 8);
          this.showSpeech('开心！✨');
          setTimeout(() => this.setExpression('normal'), 3000);
          break;
        case 'surprised':
          this.setExpression('surprised');
          this.addParticles('sparkle', 5);
          this.showSpeech('！？');
          setTimeout(() => this.setExpression('normal'), 2000);
          break;
        case 'sleeping':
          this.setExpression('sleeping');
          this.showSpeech('晚安... 💤');
          break;
        case 'hide':
          this.hide();
          break;
      }
    }

    feed() {
      if (this.state.hunger >= 100) {
        this.showSpeech('吃不下了... 🤢');
        return;
      }
      this.state.fedCount++;
      this.state.hunger = Math.min(100, this.state.hunger + 15);
      this.state.mood = Math.min(100, this.state.mood + 10);
      this.setExpression('eating');
      this.addParticles('food', 3);
      this.showSpeech(['好吃！', '谢谢！', '嗯嗯~'][Math.floor(Math.random() * 3)]);
      setTimeout(() => this.setExpression('normal'), 2000);
    }

    showSpeech(text, duration = 2500) {
      this.state.speechBubble = { text, timer: duration, opacity: 1 };
    }

    addParticles(type, count) {
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2 - 30;
      for (let i = 0; i < count; i++) {
        this.state.particles.push({
          type, x: cx + (Math.random() - 0.5) * 50, y: cy + (Math.random() - 0.5) * 30,
          vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2 - 1,
          life: 1, decay: 0.015 + Math.random() * 0.01, size: 8 + Math.random() * 6,
        });
      }
    }

    hide() {
      this.canvas.style.display = 'none';
      this.showReviveButton();
    }

    show() {
      this.canvas.style.display = 'block';
      this.state.targetScale = 1;
      const btn = document.getElementById('mochi-revive');
      if (btn) btn.remove();
      this.setExpression('surprised');
      this.showSpeech('我回来了！');
    }

    showReviveButton() {
      let btn = document.getElementById('mochi-revive');
      if (!btn) {
        btn = document.createElement('div');
        btn.id = 'mochi-revive';
        btn.textContent = '🟤';
        btn.title = '点击唤醒麻薯';
        btn.style.cssText = `
          position: fixed; z-index: 2147483646; bottom: 20px; right: 20px;
          width: 44px; height: 44px; border-radius: 50%;
          background: linear-gradient(135deg, #FFE0B2, #FFCC80);
          border: 2px solid #F5A623; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; box-shadow: 0 4px 12px rgba(139, 90, 43, 0.2);
        `;
        document.body.appendChild(btn);
      }
      btn.style.display = 'flex';
      btn.onclick = () => this.show();
    }

    animate(currentTime) {
      if (!this.running) return;
      const dt = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;
      this.update(dt);
      this.draw();
      requestAnimationFrame((t) => this.animate(t));
    }

    update(dt) {
      const s = this.state;
      s.breathPhase += dt * 2;
      s.blinkTimer += dt;
      if (s.blinkTimer > 3 + Math.random() * 2) {
        s.isBlinking = true;
        s.blinkTimer = 0;
        setTimeout(() => { s.isBlinking = false; }, 150);
      }
      s.scale += (s.targetScale - s.scale) * 0.15;
      s.hunger = Math.max(0, s.hunger - dt * 0.2);
      s.particles = s.particles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vy -= 0.02; p.life -= p.decay;
        return p.life > 0;
      });
      if (s.speechBubble) {
        s.speechBubble.timer -= dt * 1000;
        if (s.speechBubble.timer < 500) s.speechBubble.opacity = s.speechBubble.timer / 500;
        if (s.speechBubble.timer <= 0) s.speechBubble = null;
      }
      // 自动睡觉
      if ((Date.now() - s.lastInteraction) > 30000 && s.expression === 'normal') {
        s.expression = 'sleeping';
      }
    }

    draw() {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const s = this.state;
      
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      
      const cx = w / 2;
      const cy = h / 2;
      ctx.translate(cx, cy);
      ctx.scale(s.scale, s.scale);
      ctx.translate(-cx, -cy);
      
      const breathOffset = Math.sin(s.breathPhase) * 2;
      const bodyY = cy - 5 + breathOffset;
      
      // 阴影
      ctx.fillStyle = 'rgba(139, 90, 43, 0.12)';
      ctx.beginPath();
      ctx.ellipse(cx, bodyY + 58, 42, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // 脚
      ctx.fillStyle = '#C49050';
      ctx.beginPath();
      ctx.ellipse(cx - 16, bodyY + 52, 13, 8, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 16, bodyY + 52, 13, 8, 0.1, 0, Math.PI * 2);
      ctx.fill();
      
      // 手
      const handWave = s.petting ? Math.sin(s.breathPhase * 8) * 6 : Math.sin(s.breathPhase) * 2;
      ctx.fillStyle = '#D4A860';
      ctx.beginPath();
      ctx.ellipse(cx - 48, bodyY + 5 - handWave, 10, 8, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 48, bodyY + 5 + handWave, 10, 8, 0.3, 0, Math.PI * 2);
      ctx.fill();
      
      // 身体
      ctx.fillStyle = '#C49050';
      ctx.beginPath();
      ctx.ellipse(cx + 2, bodyY + 3, 52, 48, 0, 0, Math.PI * 2);
      ctx.fill();
      
      const bodyGrad = ctx.createRadialGradient(cx - 10, bodyY - 12, 5, cx, bodyY, 50);
      bodyGrad.addColorStop(0, '#F0D898');
      bodyGrad.addColorStop(0.5, '#E0C070');
      bodyGrad.addColorStop(1, '#C8A050');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(cx, bodyY, 50, 48, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'rgba(255, 240, 200, 0.3)';
      ctx.beginPath();
      ctx.ellipse(cx - 14, bodyY - 20, 22, 18, -0.3, 0, Math.PI * 2);
      ctx.fill();
      
      // 表情
      const eyeY = bodyY - 6;
      const eyeSpacing = 16;
      
      const center = this.getCanvasCenter();
      const dx = s.mouseX - center.x;
      const dy = s.mouseY - center.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const lookX = (dx / dist) * Math.min(3, dist * 0.02);
      const lookY = (dy / dist) * Math.min(2, dist * 0.015);
      
      if (s.expression === 'sleeping') {
        ctx.strokeStyle = '#6B4C30';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx - eyeSpacing, eyeY, 6, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + eyeSpacing, eyeY, 6, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        // Zzz
        ctx.fillStyle = 'rgba(139, 90, 43, 0.4)';
        ctx.font = `${11 + Math.sin(s.breathPhase) * 2}px sans-serif`;
        ctx.fillText('z', cx + 35, bodyY - 28);
      } else if (s.expression === 'happy' || s.isBlinking) {
        ctx.strokeStyle = '#5A3C20';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx - eyeSpacing, eyeY, 7, Math.PI, 2 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + eyeSpacing, eyeY, 7, Math.PI, 2 * Math.PI);
        ctx.stroke();
      } else if (s.expression === 'eating') {
        ctx.strokeStyle = '#5A3C20';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx - eyeSpacing, eyeY, 6, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + eyeSpacing, eyeY, 6, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = '#E07050';
        ctx.beginPath();
        ctx.ellipse(cx, bodyY + 10, 5, 6 + Math.sin(s.breathPhase * 6) * 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.expression === 'surprised') {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(cx - eyeSpacing, eyeY, 8, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + eyeSpacing, eyeY, 8, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3A2510';
        ctx.beginPath();
        ctx.arc(cx - eyeSpacing + lookX, eyeY + lookY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + eyeSpacing + lookX, eyeY + lookY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E07050';
        ctx.beginPath();
        ctx.ellipse(cx, bodyY + 10, 6, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(cx - eyeSpacing, eyeY, 7, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + eyeSpacing, eyeY, 7, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3A2510';
        ctx.beginPath();
        ctx.arc(cx - eyeSpacing + lookX, eyeY + lookY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + eyeSpacing + lookX, eyeY + lookY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx - eyeSpacing + 2, eyeY - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + eyeSpacing + 2, eyeY - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5A3C20';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, bodyY + 8, 8, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
      
      // 腮红
      ctx.fillStyle = 'rgba(255, 150, 140, 0.3)';
      ctx.beginPath();
      ctx.ellipse(cx - 30, eyeY + 10, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 30, eyeY + 10, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // 粒子
      s.particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        if (p.type === 'heart') {
          ctx.fillStyle = '#FF6B8A';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'star') {
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size / 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      
      // 气泡
      if (s.speechBubble) {
        this.drawSpeechBubble(ctx, cx, bodyY - 55, s.speechBubble);
      }
      
      ctx.restore();
    }

    drawSpeechBubble(ctx, x, y, bubble) {
      ctx.save();
      ctx.globalAlpha = bubble.opacity;
      
      const lines = bubble.text.split('\n');
      const lineHeight = 16;
      const padding = 10;
      const maxWidth = Math.max(...lines.map(l => l.length)) * 7 + padding * 2;
      const bubbleH = lines.length * lineHeight + padding * 2;
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.roundRect(x - maxWidth / 2, y - bubbleH, maxWidth, bubbleH, 10);
      ctx.fill();
      ctx.strokeStyle = '#F5D5B8';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = '#5A4030';
      ctx.font = '12px "Segoe UI", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((line, i) => {
        ctx.fillText(line, x, y - bubbleH + padding + i * lineHeight + lineHeight / 2);
      });
      
      ctx.restore();
    }

    setTranslateCallback(callback) {
      this.config.onTranslate = callback;
    }

    destroy() {
      this.running = false;
      this.canvas.remove();
      const menu = document.getElementById('mochi-menu');
      if (menu) menu.remove();
      const btn = document.getElementById('mochi-revive');
      if (btn) btn.remove();
    }
  }

  // ==================== 初始化麻薯宠物 ====================
  const mochiPet = new MochiPet(document.body, {
    x: window.innerWidth - 180,
    y: window.innerHeight - 200,
    onTranslate: (text, onComplete) => {
      chrome.runtime.sendMessage({
        action: 'translate',
        text: text,
        targetLang: 'zh-CN',
        sourceLang: 'auto'
      }, (response) => {
        if (chrome.runtime.lastError) {
          onComplete('翻译服务未连接');
          return;
        }
        if (response && response.translated) {
          onComplete(response.translated);
        } else if (response && response.error) {
          onComplete('翻译失败: ' + response.error);
        } else {
          onComplete('翻译服务未响应');
        }
      });
    }
  });
  
  console.log('🟤 麻薯宠物已启动！');

  // ==================== 全文翻译功能 ====================
  
  // 检测页面语言
  function detectPageLang() {
    const htmlLang = document.documentElement.lang || '';
    if (htmlLang.startsWith('zh') || htmlLang.startsWith('ja')) return false;
    const text = document.body?.innerText?.substring(0, 2000) || '';
    const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const totalLetters = text.replace(/\s/g, '').length || 1;
    return chineseCount / totalLetters < 0.3; // 中文少于30%就认为是外语页面
  }

  // 小悬浮翻译按钮
  function createTranslateToggle() {
    if (document.getElementById('mochi-translate-toggle')) return;
    
    const toggle = document.createElement('div');
    toggle.id = 'mochi-translate-toggle';
    toggle.innerHTML = '译';
    toggle.title = '翻译全文';
    
    Object.assign(toggle.style, {
      position: 'fixed',
      top: '50%',
      right: '0',
      transform: 'translateY(-50%)',
      zIndex: '2147483646',
      width: '36px',
      height: '36px',
      borderRadius: '18px 0 0 18px',
      background: 'linear-gradient(135deg, #FF9800, #FF7043)',
      color: 'white',
      fontSize: '14px',
      fontWeight: 'bold',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '-2px 2px 10px rgba(0,0,0,0.15)',
      transition: 'all 0.3s ease',
      opacity: '0.7',
      border: 'none',
      lineHeight: '1',
      letterSpacing: '0',
    });
    
    // 鼠标悬停效果
    toggle.addEventListener('mouseenter', () => {
      toggle.style.opacity = '1';
      toggle.style.width = '42px';
      toggle.style.borderRadius = '21px 0 0 21px';
      if (toggle.classList.contains('translated')) {
        toggle.style.background = 'linear-gradient(135deg, #4CAF50, #43A047)';
      }
    });
    toggle.addEventListener('mouseleave', () => {
      toggle.style.opacity = '0.7';
      toggle.style.width = '36px';
      toggle.style.borderRadius = '18px 0 0 18px';
    });
    
    // 点击切换翻译
    toggle.addEventListener('click', async () => {
      if (toggle.classList.contains('translated')) {
        // 已翻译 → 恢复原文
        restoreOriginalPage();
        toggle.classList.remove('translated');
        toggle.textContent = '译';
        toggle.style.background = 'linear-gradient(135deg, #FF9800, #FF7043)';
        toggle.title = '翻译全文';
      } else {
        // 未翻译 → 翻译全文
        toggle.textContent = '...';
        toggle.title = '翻译中...';
        await translateFullPage(toggle);
      }
    });
    
    document.body.appendChild(toggle);
    return toggle;
  }

  // 存储原文
  let originalElements = [];
  let isTranslated = false;

  // 翻译全文
  async function translateFullPage(toggle) {
    if (isTranslated) return;
    
    // 收集需要翻译的文本节点
    originalElements = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // 跳过脚本、样式、隐藏元素
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'meta', 'link', 'br', 'hr', 'img', 'svg', 'canvas', 'input', 'textarea', 'select'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.offsetParent === null && getComputedStyle(parent).display === 'none') {
            return NodeFilter.FILTER_REJECT;
          }
          const text = node.textContent.trim();
          if (text.length < 2) return NodeFilter.FILTER_REJECT;
          // 跳过纯中文文本
          const chineseRatio = (text.match(/[\u4e00-\u9fff]/g) || []).length / text.replace(/\s/g, '').length;
          if (chineseRatio > 0.6) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    
    if (nodes.length === 0) {
      toggle.textContent = '译';
      return;
    }

    // 分批翻译
    const batchSize = 5;
    let translated = 0;
    
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      const combinedText = batch.map(n => n.textContent.trim()).filter(Boolean).join('\n|||\n');
      
      if (!combinedText.trim()) continue;
      
      try {
        const result = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'translate',
            text: combinedText,
            targetLang: 'zh-CN',
            sourceLang: 'auto'
          }, (response) => {
            if (chrome.runtime.lastError || !response?.translated) {
              resolve(null);
              return;
            }
            resolve(response.translated);
          });
        });
        
        if (result) {
          const parts = result.split('\n|||\n');
          batch.forEach((node, idx) => {
            if (parts[idx] && parts[idx].trim()) {
              originalElements.push({ node, originalText: node.textContent });
              node.textContent = parts[idx].trim();
            }
          });
        }
      } catch (e) {
        console.warn('[麻薯翻译] 批次翻译失败:', e);
      }
      
      translated += batch.length;
      // 更新按钮进度
      const progress = Math.round(translated / nodes.length * 100);
      toggle.textContent = progress + '%';
    }
    
    isTranslated = true;
    toggle.classList.add('translated');
    toggle.textContent = '原';
    toggle.style.background = 'linear-gradient(135deg, #4CAF50, #43A047)';
    toggle.title = '恢复原文';
  }

  // 恢复原文
  function restoreOriginalPage() {
    originalElements.forEach(({ node, originalText }) => {
      if (node && node.parentNode) {
        node.textContent = originalText;
      }
    });
    originalElements = [];
    isTranslated = false;
  }

  // 自动检测提示（仅外语页面显示一次）
  function showTranslatePrompt() {
    if (!detectPageLang()) return;
    if (window.__mochiTranslatePromptShown) return;
    window.__mochiTranslatePromptShown = true;
    
    const prompt = document.createElement('div');
    prompt.id = 'mochi-translate-prompt';
    prompt.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">🟤</span>
        <span>检测到外语页面，是否翻译为中文？</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button id="mochi-translate-yes" style="padding:5px 16px;border-radius:12px;border:none;background:linear-gradient(135deg,#FF9800,#FF7043);color:white;font-size:13px;cursor:pointer;font-weight:500;">翻译</button>
        <button id="mochi-translate-no" style="padding:5px 16px;border-radius:12px;border:1px solid #ddd;background:white;color:#666;font-size:13px;cursor:pointer;">不了</button>
      </div>
    `;
    
    Object.assign(prompt.style, {
      position: 'fixed',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      background: 'rgba(255,255,255,0.97)',
      padding: '14px 20px',
      borderRadius: '16px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '14px',
      color: '#333',
      maxWidth: '90vw',
      animation: 'mochiSlideDown 0.3s ease',
    });
    
    // 添加动画
    if (!document.getElementById('mochi-prompt-style')) {
      const style = document.createElement('style');
      style.id = 'mochi-prompt-style';
      style.textContent = `
        @keyframes mochiSlideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(prompt);
    
    // 按钮事件
    document.getElementById('mochi-translate-yes').addEventListener('click', () => {
      prompt.remove();
      const toggle = document.getElementById('mochi-translate-toggle');
      if (toggle) {
        toggle.textContent = '...';
        toggle.title = '翻译中...';
        translateFullPage(toggle);
      }
    });
    
    document.getElementById('mochi-translate-no').addEventListener('click', () => {
 prompt.style.transition = 'all 0.3s ease';
      prompt.style.opacity = '0';
      prompt.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => prompt.remove(), 300);
    });
    
    // 10秒自动消失
    setTimeout(() => {
      if (prompt.parentNode) {
        prompt.style.transition = 'all 0.3s ease';
        prompt.style.opacity = '0';
        prompt.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => prompt.remove(), 300);
      }
    }, 10000);
  }

  // ==================== 消息监听 ====================
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'settingsUpdated') {
      Object.assign(settings, request.settings);
    }
    if (request.action === 'translatePage') {
      const toggle = document.getElementById('mochi-translate-toggle');
      if (toggle && !isTranslated) {
        toggle.textContent = '...';
        translateFullPage(toggle);
      } else if (isTranslated) {
        restoreOriginalPage();
        const toggle = document.getElementById('mochi-translate-toggle');
        if (toggle) {
          toggle.classList.remove('translated');
          toggle.textContent = '译';
          toggle.style.background = 'linear-gradient(135deg, #FF9800, #FF7043)';
        }
      }
    }
  });

  // 启动
  setTimeout(() => {
    if (settings.selectionTranslateEnabled !== false) {
      createTranslateToggle();
      // 延迟1秒再提示，等页面加载完
      setTimeout(showTranslatePrompt, 1500);
    }
  }, 500);

})();
