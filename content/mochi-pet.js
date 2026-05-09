/**
 * 🟤 MochiPet - 可交互麻薯角色组件
 * 
 * 可嵌入任何环境：浏览器插件、网页、WPS 等
 * 功能：
 *   - 呼吸/眨眼动画
 *   - 眼神跟随鼠标
 *   - 触摸/抚摸反应
 *   - 喂食系统
 *   - 拖拽移动
 *   - 右键菜单（翻译、喂食、换表情）
 *   - 选中文字拖入翻译
 */

class MochiPet {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' 
      ? document.querySelector(container) : container;
    
    // 配置
    this.config = {
      size: 160,
      x: options.x || window.innerWidth - 200,
      y: options.y || window.innerHeight - 220,
      onTranslate: options.onTranslate || null,  // 翻译回调
      ...options
    };

    // 状态
    this.state = {
      expression: 'normal',    // normal | happy | eating | surprised | sleeping
      mood: 100,               // 心情值 0-100
      hunger: 0,               // 饥饿值 0-100
      petting: false,          // 是否正在被摸
      petTimer: 0,             // 摸头计时
      blinkTimer: 0,           // 眨眼计时
      isBlinking: false,       // 是否在眨眼
      breathPhase: 0,          // 呼吸相位
      jumpVelocity: 0,         // 跳跃速度
      jumpY: 0,                // 跳跃偏移
      scale: 1,                // 缩放
      targetScale: 1,
      rotation: 0,             // 旋转
      particles: [],           // 粒子特效
      speechBubble: null,      // 对话气泡
      menuOpen: false,         // 菜单状态
      dragging: false,         // 拖拽状态
      dragOffsetX: 0,
      dragOffsetY: 0,
      mouseX: 0,
      mouseY: 0,
      fedCount: 0,             // 喂食次数
      idleTime: 0,             // 空闲时间
      lastInteraction: Date.now(),
      selectedText: null,      // 选中的文字
    };

    // 创建 DOM
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.config.size + 100;
    this.canvas.height = this.config.size + 120;
    this.canvas.style.cssText = `
      position: fixed;
      z-index: 2147483646;
      cursor: grab;
      pointer-events: auto;
      image-rendering: auto;
      filter: drop-shadow(0 4px 12px rgba(139, 90, 43, 0.2));
      transition: filter 0.3s;
    `;
    this.canvas.id = 'mochi-pet-canvas';
    this.canvas.style.left = this.config.x + 'px';
    this.canvas.style.top = this.config.y + 'px';

    this.ctx = this.canvas.getContext('2d');

    if (this.container && this.container.appendChild) {
      this.container.appendChild(this.canvas);
    } else {
      document.body.appendChild(this.canvas);
    }

    // 事件绑定
    this.bindEvents();

    // 启动动画循环
    this.running = true;
    this.lastTime = performance.now();
    this.animate(this.lastTime);

    // 定时检查空闲
    this.idleCheckInterval = setInterval(() => {
      const idle = (Date.now() - this.state.lastInteraction) / 1000;
      if (idle > 30 && this.state.expression !== 'sleeping') {
        this.setExpression('sleeping');
      } else if (idle < 5 && this.state.expression === 'sleeping') {
        this.setExpression('normal');
      }
    }, 3000);
  }

  // ===== 事件绑定 =====
  bindEvents() {
    // 鼠标移动（眼神跟随）
    document.addEventListener('mousemove', (e) => {
      this.state.mouseX = e.clientX;
      this.state.mouseY = e.clientY;
    });

    // 点击/触摸
    this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.onPointerDown(e.touches[0]);
    }, { passive: false });

    document.addEventListener('mousemove', (e) => this.onPointerMove(e));
    document.addEventListener('touchmove', (e) => {
      if (this.state.dragging) this.onPointerMove(e.touches[0]);
    }, { passive: false });

    document.addEventListener('mouseup', () => this.onPointerUp());
    document.addEventListener('touchend', () => this.onPointerUp());

    // 右键菜单
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.toggleMenu();
    });

    // 监听文字选择
    document.addEventListener('mouseup', () => {
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel.toString().trim();
        if (text && text.length < 500) {
          this.state.selectedText = text;
        } else {
          this.state.selectedText = null;
        }
      }, 200);
    });

    // 点击其他地方关闭菜单
    document.addEventListener('click', (e) => {
      if (this.state.menuOpen && !e.target.closest('#mochi-menu')) {
        this.state.menuOpen = false;
      }
    });
  }

  getCanvasCenter() {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + this.canvas.width / 2,
      y: rect.top + this.canvas.height / 2 - 20
    };
  }

  getHitArea(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2 - 20;
    const dx = x - cx;
    const dy = y - cy;

    // 身体范围
    if (dx * dx / (70 * 70) + dy * dy / (65 * 65) <= 1) {
      if (dy < -20) return 'head';
      if (dx < -25) return 'body_left';
      if (dx > 25) return 'body_right';
      return 'body';
    }
    return null;
  }

  onPointerDown(e) {
    this.state.lastInteraction = Date.now();
    
    if (this.state.menuOpen) {
      // 检查菜单点击
      const menu = document.getElementById('mochi-menu');
      if (menu && e.target.closest('#mochi-menu')) return;
      this.state.menuOpen = false;
    }

    const hit = this.getHitArea(e);
    
    if (hit === 'head') {
      // 摸头！
      this.state.petting = true;
      this.state.petTimer = 0;
      this.setExpression('happy');
      this.addParticles('heart', 3);
      this.showSpeech('好舒服~ 🥰');
    } else if (hit) {
      // 点身体
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

  // ===== 表情系统 =====
  setExpression(expr) {
    this.state.expression = expr;
    this.state.lastInteraction = Date.now();
  }

  // ===== 菜单 =====
  toggleMenu() {
    this.state.menuOpen = !this.state.menuOpen;
    
    let menu = document.getElementById('mochi-menu');
    if (this.state.menuOpen) {
      if (!menu) {
        menu = document.createElement('div');
        menu.id = 'mochi-menu';
        menu.innerHTML = `
          <div class="mochi-menu-item" data-action="translate">📝 翻译选中文字</div>
          <div class="mochi-menu-item" data-action="feed">🍣 喂食</div>
          <div class="mochi-menu-item" data-action="happy">😄 开心</div>
          <div class="mochi-menu-item" data-action="surprised">😲 惊讶</div>
          <div class="mochi-menu-item" data-action="sleeping">😴 睡觉</div>
          <div class="mochi-menu-item" data-action="status">📊 状态</div>
          <div class="mochi-menu-sep"></div>
          <div class="mochi-menu-item" data-action="hide">🙈 隐藏</div>
        `;
        
        // 菜单样式
        const style = document.createElement('style');
        style.textContent = `
          #mochi-menu {
            position: fixed;
            z-index: 2147483647;
            background: linear-gradient(135deg, #fff8f0, #fff0e6);
            border: 3px solid #f5d5b8;
            border-radius: 16px;
            padding: 8px 0;
            box-shadow: 0 8px 32px rgba(139, 90, 43, 0.2);
            font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            min-width: 150px;
            animation: mochiMenuIn 0.25s ease;
          }
          @keyframes mochiMenuIn {
            from { opacity: 0; transform: scale(0.8) translateY(5px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
          .mochi-menu-item {
            padding: 8px 16px;
            font-size: 13px;
            color: #5a4030;
            cursor: pointer;
            transition: background 0.15s;
            user-select: none;
          }
          .mochi-menu-item:hover {
            background: rgba(245, 213, 184, 0.5);
          }
          .mochi-menu-sep {
            height: 2px;
            margin: 4px 12px;
            background: #e8c4a8;
            border-radius: 1px;
          }
        `;
        document.head.appendChild(style);
        document.body.appendChild(menu);
      }
      
      // 定位菜单
      const rect = this.canvas.getBoundingClientRect();
      menu.style.left = (rect.left + rect.width / 2 - 75) + 'px';
      menu.style.top = (rect.top - 10) + 'px';
      menu.style.transform = 'translateY(-100%)';
      menu.style.display = 'block';

      // 菜单事件
      menu.querySelectorAll('.mochi-menu-item').forEach(item => {
        item.onclick = () => {
          const action = item.dataset.action;
          this.handleMenuAction(action);
          this.state.menuOpen = false;
          menu.style.display = 'none';
        };
      });
    } else if (menu) {
      menu.style.display = 'none';
    }
  }

  handleMenuAction(action) {
    this.state.lastInteraction = Date.now();
    
    switch (action) {
      case 'translate':
        if (this.state.selectedText) {
          this.showSpeech('翻译中... 🔍');
          this.setExpression('surprised');
          if (this.config.onTranslate) {
            this.config.onTranslate(this.state.selectedText, (result) => {
              this.showSpeech(result, 5000);
              this.setExpression('happy');
              setTimeout(() => this.setExpression('normal'), 3000);
            });
          } else {
            setTimeout(() => {
              this.showSpeech('翻译功能未连接 😅', 2000);
              this.setExpression('normal');
            }, 1000);
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
      
      case 'status':
        const moodEmoji = this.state.mood > 80 ? '😊' : this.state.mood > 50 ? '🙂' : '😐';
        const hungerEmoji = this.state.hunger < 30 ? '🍚' : this.state.hunger < 60 ? '😋' : '😫';
        this.showSpeech(
          `心情: ${moodEmoji} ${this.state.mood}%\n` +
          `饥饿: ${hungerEmoji} ${this.state.hunger}%\n` +
          `被喂: ${this.state.fedCount} 次`,
          4000
        );
        this.setExpression('happy');
        setTimeout(() => this.setExpression('normal'), 4000);
        break;
      
      case 'hide':
        this.hide();
        break;
    }
  }

  // ===== 喂食 =====
  feed() {
    if (this.state.hunger >= 100) {
      this.showSpeech('吃不下了... 🤢');
      this.setExpression('surprised');
      this.addParticles('sweat', 3);
      setTimeout(() => this.setExpression('normal'), 2000);
      return;
    }
    
    this.state.fedCount++;
    this.state.hunger = Math.min(100, this.state.hunger + 15);
    this.state.mood = Math.min(100, this.state.mood + 10);
    
    this.setExpression('eating');
    this.addParticles('food', 3);
    this.showSpeech(['好吃！', '谢谢！', '嗯嗯~', '还想吃！'][Math.floor(Math.random() * 4)]);
    
    setTimeout(() => {
      if (this.state.hunger >= 80) {
        this.showSpeech('吃饱了~ 😋');
      }
      this.setExpression('normal');
    }, 2000);
  }

  // ===== 气泡 =====
  showSpeech(text, duration = 2500) {
    this.state.speechBubble = { text, timer: duration, opacity: 1 };
  }

  // ===== 粒子系统 =====
  addParticles(type, count) {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2 - 30;
    
    for (let i = 0; i < count; i++) {
      this.state.particles.push({
        type,
        x: cx + (Math.random() - 0.5) * 60,
        y: cy + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2 - 1,
        life: 1,
        decay: 0.01 + Math.random() * 0.015,
        size: 8 + Math.random() * 8,
        rotation: Math.random() * Math.PI * 2,
      });
    }
  }

  // ===== 隐藏/显示 =====
  hide() {
    this.state.targetScale = 0;
    setTimeout(() => {
      this.canvas.style.display = 'none';
      // 显示一个小图标用于恢复
      this.showReviveButton();
    }, 300);
  }

  show() {
    this.canvas.style.display = 'block';
    this.state.targetScale = 1;
    const btn = document.getElementById('mochi-revive');
    if (btn) btn.remove();
  }

  showReviveButton() {
    let btn = document.getElementById('mochi-revive');
    if (!btn) {
      btn = document.createElement('div');
      btn.id = 'mochi-revive';
      btn.textContent = '🟤';
      btn.title = '点击唤醒麻薯';
      btn.style.cssText = `
        position: fixed;
        z-index: 2147483646;
        bottom: 20px;
        right: 20px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #FFE0B2, #FFCC80);
        border: 2px solid #F5A623;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        box-shadow: 0 4px 12px rgba(139, 90, 43, 0.2);
        transition: transform 0.2s;
        animation: mochiBounce 2s infinite;
      `;
      btn.style.animation = 'mochiBounce 2s ease-in-out infinite';
      
      const style = document.createElement('style');
      style.textContent = `
        @keyframes mochiBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(btn);
    }
    btn.style.display = 'flex';
    btn.onclick = () => {
      this.show();
      this.setExpression('surprised');
      this.showSpeech('我回来了！');
      setTimeout(() => this.setExpression('normal'), 2000);
    };
  }

  // ===== 动画循环 =====
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
    
    // 呼吸
    s.breathPhase += dt * 2;
    
    // 眨眼
    s.blinkTimer += dt;
    if (s.blinkTimer > 3 + Math.random() * 2) {
      s.isBlinking = true;
      s.blinkTimer = 0;
      setTimeout(() => { s.isBlinking = false; }, 150);
    }
    
    // 跳跃物理
    if (s.jumpVelocity !== 0) {
      s.jumpY += s.jumpVelocity;
      s.jumpVelocity += 0.5; // 重力
      if (s.jumpY >= 0) {
        s.jumpY = 0;
        s.jumpVelocity = 0;
      }
    }
    
    // 缩放动画
    s.scale += (s.targetScale - s.scale) * 0.15;
    
    // 饥饿自然增长
    s.hunger = Math.max(0, s.hunger - dt * 0.3);
    
    // 更新粒子
    s.particles = s.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.02;
      p.life -= p.decay;
      p.rotation += 0.02;
      return p.life > 0;
    });
    
    // 更新气泡
    if (s.speechBubble) {
      s.speechBubble.timer -= dt * 1000;
      if (s.speechBubble.timer < 500) {
        s.speechBubble.opacity = s.speechBubble.timer / 500;
      }
      if (s.speechBubble.timer <= 0) {
        s.speechBubble = null;
      }
    }
  }

  // ===== 绘制 =====
  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const s = this.state;
    
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    
    // 整体变换
    const cx = w / 2;
    const cy = h / 2;
    ctx.translate(cx, cy);
    ctx.scale(s.scale, s.scale);
    ctx.translate(-cx, -cy);
    
    // 呼吸偏移
    const breathOffset = Math.sin(s.breathPhase) * 2;
    const bodyY = cy - 10 + s.jumpY + breathOffset;
    
    // ===== 阴影 =====
    ctx.fillStyle = 'rgba(139, 90, 43, 0.1)';
    ctx.beginPath();
    ctx.ellipse(cx, bodyY + 62, 45 - Math.abs(s.jumpY) * 0.5, 10 - Math.abs(s.jumpY) * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== 小脚 =====
    const footSpread = 18;
    const footBounce = Math.sin(s.breathPhase * 2) * 1;
    ctx.fillStyle = '#C49050';
    ctx.beginPath();
    ctx.ellipse(cx - footSpread, bodyY + 55 + footBounce, 15, 9, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + footSpread, bodyY + 55 - footBounce, 15, 9, 0.1, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== 小手 =====
    const handWave = s.petting ? Math.sin(s.breathPhase * 8) * 8 : Math.sin(s.breathPhase) * 2;
    ctx.fillStyle = '#D4A860';
    // 左手
    ctx.beginPath();
    ctx.ellipse(cx - 52, bodyY + 5 - handWave, 11, 9, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // 右手
    ctx.beginPath();
    ctx.ellipse(cx + 52, bodyY + 5 + handWave, 11, 9, 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== 身体 =====
    // 身体阴影
    ctx.fillStyle = '#C49050';
    ctx.beginPath();
    ctx.ellipse(cx + 2, bodyY + 3, 56, 52, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 身体主体
    const bodyGrad = ctx.createRadialGradient(cx - 10, bodyY - 15, 5, cx, bodyY, 55);
    bodyGrad.addColorStop(0, '#F0D898');
    bodyGrad.addColorStop(0.5, '#E0C070');
    bodyGrad.addColorStop(1, '#C8A050');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(cx, bodyY, 55, 52, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 身体高光
    ctx.fillStyle = 'rgba(255, 240, 200, 0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - 15, bodyY - 22, 25, 20, -0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // ===== 表情 =====
    const eyeY = bodyY - 8;
    const eyeSpacing = 18;
    
    // 眼神跟随
    const center = this.getCanvasCenter();
    const dx = s.mouseX - center.x;
    const dy = s.mouseY - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const lookX = (dx / dist) * Math.min(4, dist * 0.02);
    const lookY = (dy / dist) * Math.min(3, dist * 0.015);
    
    if (s.expression === 'sleeping') {
      // 睡觉 - 闭眼线
      ctx.strokeStyle = '#6B4C30';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx - eyeSpacing, eyeY, 7, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + eyeSpacing, eyeY, 7, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      
      // Zzz
      ctx.fillStyle = 'rgba(139, 90, 43, 0.5)';
      ctx.font = `${12 + Math.sin(s.breathPhase) * 2}px sans-serif`;
      ctx.fillText('z', cx + 40, bodyY - 30 + Math.sin(s.breathPhase) * 5);
      ctx.font = `${10 + Math.sin(s.breathPhase + 1) * 2}px sans-serif`;
      ctx.fillText('z', cx + 52, bodyY - 42 + Math.sin(s.breathPhase + 1) * 5);
      ctx.font = `${8 + Math.sin(s.breathPhase + 2) * 2}px sans-serif`;
      ctx.fillText('z', cx + 60, bodyY - 52 + Math.sin(s.breathPhase + 2) * 5);
      
    } else if (s.expression === 'happy' || s.isBlinking) {
      // 开心/眨眼 - 眯眯眼
      ctx.strokeStyle = '#5A3C20';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx - eyeSpacing, eyeY, 8, Math.PI, 2 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + eyeSpacing, eyeY, 8, Math.PI, 2 * Math.PI);
      ctx.stroke();
      
    } else if (s.expression === 'eating') {
      // 吃东西 - 享受闭眼
      ctx.strokeStyle = '#5A3C20';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx - eyeSpacing, eyeY, 7, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + eyeSpacing, eyeY, 7, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      
      // 食物
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(cx + 30, bodyY + 25, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2A2A2A';
      ctx.beginPath();
      ctx.moveTo(cx + 30, bodyY + 17);
      ctx.lineTo(cx + 24, bodyY + 27);
      ctx.lineTo(cx + 36, bodyY + 27);
      ctx.closePath();
      ctx.fill();
      
      // 嘴巴（吃东西的圆形嘴）
      ctx.fillStyle = '#E07050';
      ctx.beginPath();
      ctx.ellipse(cx, bodyY + 12, 6, 7 + Math.sin(s.breathPhase * 6) * 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#C05040';
      ctx.beginPath();
      ctx.ellipse(cx, bodyY + 14, 4, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      
    } else if (s.expression === 'surprised') {
      // 惊讶 - 大圆眼
      // 眼白
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(cx - eyeSpacing, eyeY, 10, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + eyeSpacing, eyeY, 10, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      // 瞳孔
      ctx.fillStyle = '#3A2510';
      ctx.beginPath();
      ctx.arc(cx - eyeSpacing + lookX, eyeY + lookY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + eyeSpacing + lookX, eyeY + lookY, 5, 0, Math.PI * 2);
      ctx.fill();
      // 高光
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx - eyeSpacing + 2, eyeY - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + eyeSpacing + 2, eyeY - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // O 嘴
      ctx.fillStyle = '#E07050';
      ctx.beginPath();
      ctx.ellipse(cx, bodyY + 12, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#C05040';
      ctx.beginPath();
      ctx.ellipse(cx, bodyY + 14, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      
    } else {
      // 正常表情
      // 眼白
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(cx - eyeSpacing, eyeY, 8, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + eyeSpacing, eyeY, 8, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      // 瞳孔
      ctx.fillStyle = '#3A2510';
      ctx.beginPath();
      ctx.arc(cx - eyeSpacing + lookX, eyeY + lookY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + eyeSpacing + lookX, eyeY + lookY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      // 高光
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx - eyeSpacing + 2, eyeY - 2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + eyeSpacing + 2, eyeY - 2, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // 微笑
      ctx.strokeStyle = '#5A3C20';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, bodyY + 10, 10, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    
    // 腮红（所有表情都有）
    ctx.fillStyle = 'rgba(255, 150, 140, 0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - 32, eyeY + 12, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 32, eyeY + 12, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 被摸头时的特效
    if (s.petting) {
      ctx.fillStyle = 'rgba(255, 150, 200, 0.6)';
      ctx.font = '14px sans-serif';
      const sparkleX = Math.sin(s.breathPhase * 5) * 20;
      ctx.fillText('✨', cx + sparkleX, bodyY - 50);
      ctx.fillText('✨', cx - sparkleX - 10, bodyY - 55);
    }
    
    // ===== 粒子 =====
    s.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      
      if (p.type === 'heart') {
        this.drawHeart(ctx, 0, 0, p.size, '#FF6B8A');
      } else if (p.type === 'star') {
        this.drawStar(ctx, 0, 0, p.size, '#FFD700');
      } else if (p.type === 'sparkle') {
        ctx.fillStyle = '#FFD700';
        ctx.font = `${p.size}px sans-serif`;
        ctx.fillText('✦', 0, 0);
      } else if (p.type === 'food') {
        ctx.fillStyle = '#FF8C00';
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'sweat') {
        ctx.fillStyle = '#87CEEB';
        ctx.font = `${p.size}px sans-serif`;
        ctx.fillText('💧', 0, 0);
      }
      
      ctx.restore();
    });
    
    // ===== 气泡 =====
    if (s.speechBubble) {
      this.drawSpeechBubble(ctx, cx, bodyY - 60, s.speechBubble);
    }
    
    ctx.restore();
  }

  drawHeart(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const s = size / 16;
    ctx.moveTo(x, y + 4 * s);
    ctx.bezierCurveTo(x, y, x - 8 * s, y, x - 8 * s, y + 4 * s);
    ctx.bezierCurveTo(x - 8 * s, y + 10 * s, x, y + 14 * s, x, y + 16 * s);
    ctx.bezierCurveTo(x, y + 14 * s, x + 8 * s, y + 10 * s, x + 8 * s, y + 4 * s);
    ctx.bezierCurveTo(x + 8 * s, y, x, y, x, y + 4 * s);
    ctx.fill();
  }

  drawStar(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const px = x + Math.cos(angle) * size / 2;
      const py = y + Math.sin(angle) * size / 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  drawSpeechBubble(ctx, x, y, bubble) {
    ctx.save();
    ctx.globalAlpha = bubble.opacity;
    
    const text = bubble.text;
    const lines = text.split('\n');
    const lineHeight = 18;
    const padding = 12;
    const maxWidth = Math.max(...lines.map(l => l.length)) * 8 + padding * 2;
    const bubbleH = lines.length * lineHeight + padding * 2;
    
    const bx = x - maxWidth / 2;
    const by = y - bubbleH;
    
    // 气泡背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.roundRect(bx, by, maxWidth, bubbleH, 12);
    ctx.fill();
    
    // 气泡边框
    ctx.strokeStyle = '#F5D5B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, maxWidth, bubbleH, 12);
    ctx.stroke();
    
    // 小三角
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.moveTo(x - 6, by + bubbleH);
    ctx.lineTo(x, by + bubbleH + 8);
    ctx.lineTo(x + 6, by + bubbleH);
    ctx.fill();
    
    // 文字
    ctx.fillStyle = '#5A4030';
    ctx.font = '13px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => {
      ctx.fillText(line, x, by + padding + i * lineHeight + lineHeight / 2);
    });
    
    ctx.restore();
  }

  // ===== 公共方法 =====
  
  /**
   * 设置翻译回调
   * @param {function} callback - (text, onComplete) => void
   */
  setTranslateCallback(callback) {
    this.config.onTranslate = callback;
  }

  /**
   * 手动触发喂食
   */
  feed() {
    this.state.lastInteraction = Date.now();
    if (this.state.hunger >= 100) {
      this.showSpeech('吃不下了... 🤢');
      this.setExpression('surprised');
      this.addParticles('sweat', 3);
      setTimeout(() => this.setExpression('normal'), 2000);
      return;
    }
    
    this.state.fedCount++;
    this.state.hunger = Math.min(100, this.state.hunger + 15);
    this.state.mood = Math.min(100, this.state.mood + 10);
    this.setExpression('eating');
    this.addParticles('food', 3);
    this.showSpeech(['好吃！', '谢谢！', '嗯嗯~', '还想吃！'][Math.floor(Math.random() * 4)]);
    setTimeout(() => {
      if (this.state.hunger >= 80) {
        this.showSpeech('吃饱了~ 😋');
      }
      this.setExpression('normal');
    }, 2000);
  }

  /**
   * 销毁
   */
  destroy() {
    this.running = false;
    clearInterval(this.idleCheckInterval);
    this.canvas.remove();
    const menu = document.getElementById('mochi-menu');
    if (menu) menu.remove();
    const btn = document.getElementById('mochi-revive');
    if (btn) btn.remove();
    const style = document.querySelector('style[data-mochi]');
    if (style) style.remove();
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MochiPet;
}
if (typeof window !== 'undefined') {
  window.MochiPet = MochiPet;
}
