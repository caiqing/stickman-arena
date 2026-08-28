/* 移动端虚拟按键：战斗 / 跳舞 / 划船 / 飞行 各自的触控布局 */
(function (global) {
  'use strict';
  var SG = global.SG = global.SG || {};
  var doc = global.document;

  var container = null;
  var flags = {};        // 当前按下的虚拟键集合
  var mode = null;       // 'battle' | 'dance' | 'boat' | 'fly' | null
  var rendered = null;   // 已渲染的布局标识
  var visible = false;   // 当前是否显示
  var autoBtnEl = null;  // 托管状态按钮（每帧同步高亮）
  var muteBtnEl = null;  // 静音按钮（同步图标）

  function isTouchDevice() {
    return ('ontouchstart' in global) || (global.navigator && global.navigator.maxTouchPoints > 0);
  }

  function shouldShow() {
    var pref = (SG.game && SG.game.settings && SG.game.settings.touch) || 'auto';
    if (pref === 'off') return false;
    if (pref === 'on') return true;
    return isTouchDevice();
  }

  function press(key, down) {
    flags[key] = down;
    if (down && SG.Audio) SG.Audio.unlock();
  }

  function bind(el, key) {
    function down(e) {
      e.preventDefault();
      el.classList.add('active');
      // 特殊动作键：静音 / 暂停 / 托管开关
      if (key === '__mute') { if (SG.game) SG.game.toggleMute(); return; }
      if (key === '__pause') { if (SG.game) SG.game.togglePause(); return; }
      if (key === '__auto') { if (SG.game) SG.game.toggleAutoPilot(); return; }
      press(key, true);
    }
    function up(e) {
      el.classList.remove('active');
      if (key.indexOf('__') === 0) return;
      press(key, false);
    }
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
  }

  function btn(label, key, cls) {
    var b = doc.createElement('div');
    b.className = 'vbtn' + (cls ? ' ' + cls : '');
    b.textContent = label;
    bind(b, key);
    return b;
  }
  function div(cls) {
    var d = doc.createElement('div');
    d.className = cls || '';
    return d;
  }

  // 顶部常驻：静音 / 暂停 / AI 托管开关（触屏无键盘时的入口）
  function buildTop(root) {
    var top = div('vtop');
    muteBtnEl = btn('🔊', '__mute', 'vsys');
    top.appendChild(muteBtnEl);
    top.appendChild(btn('⏸', '__pause', 'vsys'));
    autoBtnEl = btn('🤖', '__auto', 'vsys vauto');
    top.appendChild(autoBtnEl);
    root.appendChild(top);
  }

  // ---------- 各模式布局 ----------
  function buildBattle(root) {
    buildTop(root);
    var left = div('vcluster vleft');
    var col = div('vcol');
    col.appendChild(btn('跳', 'up', 'vsmall'));
    var row = div('vrow');
    row.appendChild(btn('◀', 'left'));
    row.appendChild(btn('▶', 'right'));
    col.appendChild(row);
    left.appendChild(col);
    root.appendChild(left);

    var right = div('vcluster vright');
    var r1 = div('vrow');
    r1.appendChild(btn('拳', 'punch'));
    r1.appendChild(btn('腿', 'kick'));
    r1.appendChild(btn('防', 'down'));
    var r2 = div('vrow');
    r2.appendChild(btn('冲', 'dash', 'vsmall'));
    r2.appendChild(btn('蓄', 'charge', 'vsmall'));
    r2.appendChild(btn('必', 'ult', 'vbig'));
    right.appendChild(r1);
    right.appendChild(r2);
    root.appendChild(right);
  }

  function buildDance(root) {
    buildTop(root);
    var row = div('vhcenter vrow');
    ['left', 'up', 'down', 'right'].forEach(function (k) {
      var g = { left: '←', up: '↑', down: '↓', right: '→' }[k];
      row.appendChild(btn(g, k, 'vdance'));
    });
    root.appendChild(row);
  }

  function buildBoat(root) {
    buildTop(root);
    var l = btn('划桨 ←', 'left', 'vhalf vhalf-l');
    var r = btn('划桨 →', 'right', 'vhalf vhalf-r');
    root.appendChild(l);
    root.appendChild(r);
    var lanes = div('vcluster vlanes');
    lanes.appendChild(btn('▲', 'up', 'vsmall'));
    lanes.appendChild(btn('▼', 'down', 'vsmall'));
    root.appendChild(lanes);
  }

  function buildFly(root) {
    buildTop(root);
    root.appendChild(btn('▲ 按住上升', 'up', 'vfly'));
  }

  var BUILDERS = { battle: buildBattle, dance: buildDance, boat: buildBoat, fly: buildFly };

  function render() {
    if (!container) return;
    var want = visible && mode && BUILDERS[mode] ? mode : null;
    var sig = want || 'off';
    if (rendered === sig) return;
    rendered = sig;
    autoBtnEl = null;
    muteBtnEl = null;
    container.innerHTML = '';
    container.style.display = want ? 'block' : 'none';
    if (want) BUILDERS[want](container);
  }

  SG.Touch = {
    init: function () {
      container = doc.getElementById('vpad');
      if (!container) {
        container = doc.createElement('div');
        container.id = 'vpad';
        doc.body.appendChild(container);
      }
      // 页面失焦时清空按键，避免卡键
      global.addEventListener('blur', function () { flags = {}; });
    },
    sync: function (m) {
      if (mode !== m || rendered === null) { mode = m; rendered = null; }
      visible = shouldShow();
      render();
      // 托管按钮实时高亮 / 静音图标同步
      if (autoBtnEl) autoBtnEl.classList.toggle('active', !!(SG.game && SG.game.autoPilot));
      if (muteBtnEl && SG.Audio) {
        muteBtnEl.textContent = SG.Audio.getVolumes().master > 0 ? '🔊' : '🔇';
      }
    },
    input: function () {
      return visible ? Object.assign({}, flags) : {};
    },
    isTouchDevice: isTouchDevice,
    isVisible: function () { return visible; },
    refresh: function () { visible = shouldShow(); rendered = null; render(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
