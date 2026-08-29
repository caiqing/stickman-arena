/* 全部界面：菜单 / 自定义 / 剧情 / 地图 / 大会 / 榜单 / 回放 / 设置 / 结算 */
(function (global) {
  'use strict';
  var SG = global.SG = global.SG || {};
  var doc = global.document;

  function el(tag, cls, html) {
    var d = doc.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }
  function btn(label, cb, cls) {
    var b = el('button', 'btn ' + (cls || ''), label);
    b.addEventListener('click', function () { SG.Audio.sfx('click'); cb(); });
    return b;
  }
  function lockText(item) {
    return item.locked ? '（通关故事模式第 ' + item.locked + ' 关解锁）' : '';
  }
  function unlocked(item) { return !item.locked || (SG.game.storyProgress || 0) >= item.locked; }

  // 场景缩略图：借用战斗场景绘制器离屏渲染
  function stageThumbCv(stageId, w, h) {
    var cv = el('canvas'); cv.width = w; cv.height = h;
    try {
      var b = new SG.Battle({ mode: 'versus', stage: stageId, roundsToWin: 9, roundTime: 9, silent: true,
        p1: { name: 'a', custom: SG.DATA.defaultCustom(), ctrl: 'human' },
        p2: { name: 'b', custom: SG.DATA.defaultCustom(), ctrl: 'human' }, onEvent: function () {} });
      b.drawStage(cv.getContext('2d'));
    } catch (e) {}
    return cv;
  }

  // 轻提示
  var toastTimer = null;
  function toast(msg) {
    var t = doc.getElementById('sga-toast');
    if (!t) {
      t = el('div');
      t.id = 'sga-toast';
      t.style.cssText = 'position:fixed;left:50%;top:12%;transform:translateX(-50%);' +
        'background:rgba(20,24,40,.96);border:1px solid #ffd97a;color:#ffe9a8;' +
        'padding:10px 22px;border-radius:10px;font-size:15px;z-index:98;letter-spacing:1px;';
      doc.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.display = 'none'; }, 2000);
  }

  // 复制文本框内容（剪贴板 API + execCommand 兜底）
  function copyText(ta) {
    ta.focus(); ta.select();
    var ok = false;
    try { ok = doc.execCommand('copy'); } catch (e) {}
    if (global.navigator.clipboard) {
      global.navigator.clipboard.writeText(ta.value).catch(function () {});
      ok = true;
    }
    SG.Audio.sfx('unlock');
    toast(ok ? '已复制，去微信粘贴发送即可' : '请手动全选复制');
  }

  // 可循环选择的选项组
  function optionRow(label, list, getId, getName, get, set, previewTick) {
    var row = el('div', 'opt-row');
    row.appendChild(el('div', 'opt-label', label));
    var val = el('div', 'opt-value');
    var hint = el('div', 'opt-hint');
    var left = el('button', 'opt-btn', '‹');
    var right = el('button', 'opt-btn', '›');
    function refresh() {
      var curId = get();
      var idx = list.findIndex(function (it) { return it.id === curId; });
      if (idx < 0) idx = 0;
      var item = list[idx];
      val.textContent = getName(item) + (unlocked(item) ? '' : ' 🔒');
      val.className = 'opt-value' + (unlocked(item) ? '' : ' locked');
      hint.textContent = unlocked(item) ? (item.desc || '') : '通关故事第 ' + item.locked + ' 关解锁';
    }
    function cycle(dir) {
      var curId = get();
      var idx = Math.max(0, list.findIndex(function (it) { return it.id === curId; }));
      for (var step = 0; step < list.length; step++) {
        idx = (idx + dir + list.length) % list.length;
        if (unlocked(list[idx])) break;
      }
      set(list[idx].id);
      SG.Audio.sfx('click');
      refresh();
      if (previewTick) previewTick();
    }
    left.addEventListener('click', function () { cycle(-1); });
    right.addEventListener('click', function () { cycle(1); });
    row.appendChild(left); row.appendChild(val); row.appendChild(right);
    var wrap = el('div');
    wrap.appendChild(row); wrap.appendChild(hint);
    wrap.refresh = refresh;
    return wrap;
  }

  var UI = {
    screens: {}, previews: [], activeName: null,

    init: function (root) {
      this.root = root;
      var names = ['title', 'roster', 'picker', 'stageDesigner', 'training', 'custom', 'storyMap', 'dialogue', 'versusSetup',
        'tournamentSetup', 'bracket', 'casualHub', 'leaderboard', 'replays', 'share',
        'settings', 'help', 'result', 'pause'];
      var self = this;
      names.forEach(function (n) {
        var d = el('div', 'screen');
        d.id = 'screen-' + n;
        root.appendChild(d);
        self.screens[n] = d;
      });
      this.buildTitle();
      this.buildCustom();
      this.buildStoryMap();
      this.buildDialogue();
      this.buildVersusSetup();
      this.buildTournamentSetup();
      this.buildBracket();
      this.buildCasualHub();
      this.buildLeaderboard();
      this.buildReplays();
      this.buildSettings();
      this.buildHelp();
      this.buildResult();
      this.buildPause();
    },

    show: function (name) {
      this.activeName = name;
      this._shownAt = performance.now();
      this.previews = [];
      for (var k in this.screens) this.screens[k].classList.remove('active');
      if (name && this.screens[name]) {
        var refresher = this['refresh_' + name];
        if (refresher) refresher.call(this);
        this.screens[name].classList.add('active');
      }
      this.root.classList.toggle('hidden', !name);
    },

    // ================= 主菜单 =================
    buildTitle: function () {
      var s = this.screens.title;
      s.className = 'screen';
      var panel = el('div', 'panel title-panel');
      panel.style.textAlign = 'center';
      panel.appendChild(el('h1', 'logo', '火柴人武林大会'));
      panel.appendChild(el('div', 'subtitle', 'STICKMAN KUNGFU ARENA · 墨水大陆武林传奇'));
      panel.appendChild(el('div', 'author', '👨‍👦 出品：Jawen & Papa'));
      var menu = el('div', 'menu-list');
      menu.style.margin = '0 auto';
      var g = SG.game;
      menu.appendChild(btn('📖 故事模式 · 暗影危机', function () { g.enterStory(); }, 'primary'));
      menu.appendChild(btn('⚔️ 双人对战', function () { g.enterVersus(); }));
      menu.appendChild(btn('🏆 武林大会 · 家庭争霸赛', function () { g.enterTournament(); }));
      menu.appendChild(btn('🎮 休闲中心', function () { g.enterCasual(); }));
      menu.appendChild(btn('🧘 修炼模式', function () { g.enterTraining(); }));
      menu.appendChild(btn('🎭 人物设定', function () { g.enterRoster(); }));
      menu.appendChild(btn('🎬 录像回放', function () { UI.show('replays'); }));
      menu.appendChild(btn('🏅 评分榜', function () { UI.show('leaderboard'); }));
      var row2 = el('div', 'btn-row');
      row2.appendChild(btn('操作说明', function () { UI.show('help'); }, 'small'));
      row2.appendChild(btn('设置', function () { UI.show('settings'); }, 'small'));
      menu.appendChild(row2);
      panel.appendChild(menu);
      var hint = el('div', 'tiny', '首次进入请点击任意按钮以开启声音 · M 静音');
      hint.style.marginTop = '22px';
      panel.appendChild(hint);
      panel.style.marginTop = '20px';
      s.appendChild(panel);
    },

    // ================= 角色自定义 =================
    buildCustom: function () {
      var s = this.screens.custom;
      s.className = 'screen dim';
    },

    openCustom: function (cfg) {
      // cfg: {title, name, custom, allowGear, onDone(custom), allowCancel}
      var s = this.screens.custom;
      s.innerHTML = '';
      var custom = cfg.custom;
      var self = this;
      var panel = el('div', 'panel');
      panel.appendChild(el('h2', 'title', cfg.title || '角色自定义'));

      var wrap = el('div', 'custom-wrap');
      // 预览
      var prevBox = el('div', 'preview-box');
      var cv = el('canvas'); cv.width = 260; cv.height = 340;
      prevBox.appendChild(cv);
      var pname = el('div', 'preview-name');
      prevBox.appendChild(pname);
      wrap.appendChild(prevBox);

      var opts = el('div');
      // 名字
      if (cfg.name !== undefined) {
        var nrow = el('div', 'opt-row');
        nrow.appendChild(el('div', 'opt-label', '名字'));
        var input = el('input', 'txt');
        input.value = cfg.name;
        input.maxLength = 8;
        input.placeholder = '输入名字';
        input.addEventListener('input', function () {
          custom.name = input.value;
          pname.textContent = custom.name || '战士';
        });
        nrow.appendChild(input);
        opts.appendChild(nrow);
      }
      // 颜色
      var cwrap = el('div', 'opt-row');
      cwrap.appendChild(el('div', 'opt-label', '颜色'));
      var dots = el('div', 'color-dots');
      function refreshDots() {
        dots.innerHTML = '';
        SG.DATA.COLORS.forEach(function (c) {
          var d = el('div', 'color-dot');
          d.style.background = c.hex;
          if (custom.color === c.id) d.classList.add('sel');
          if (!unlocked(c)) {
            d.classList.add('locked');
            d.title = lockText(c);
          } else {
            d.addEventListener('click', function () {
              custom.color = c.id;
              SG.Audio.sfx('click');
              refreshDots();
            });
          }
          dots.appendChild(d);
        });
      }
      refreshDots();
      cwrap.appendChild(dots);
      opts.appendChild(cwrap);

      function tickPreview() {
        pname.textContent = (custom.name || '战士') + ' · ' + SG.DATA.weaponById(custom.weapon).name;
        refreshWinfo();
      }
      var rows = [
        optionRow('发型', SG.DATA.HAIRS, null, function (i) { return i.name; },
          function () { return custom.hair; }, function (v) { custom.hair = v; }, tickPreview),
        optionRow('帽子', SG.DATA.HATS, null, function (i) { return i.name; },
          function () { return custom.hat; }, function (v) { custom.hat = v; }, tickPreview),
        optionRow('服装', SG.DATA.CLOTHES, null, function (i) { return i.name; },
          function () { return custom.clothes; }, function (v) { custom.clothes = v; }, tickPreview),
        optionRow('武器', SG.DATA.WEAPONS, null,
          function (i) { return i.name; },
          function () { return custom.weapon; }, function (v) { custom.weapon = v; }, tickPreview),
        optionRow('装备', SG.DATA.GEARS, null, function (i) { return i.name; },
          function () { return custom.gear; }, function (v) { custom.gear = v; }, tickPreview)
      ];
      rows.forEach(function (r) { opts.appendChild(r); });
      var winfo = el('div', 'tiny');
      function refreshWinfo() {
        var w = SG.DATA.weaponById(custom.weapon);
        var gr = SG.DATA.gearById(custom.gear || 'none');
        winfo.innerHTML = '⚡ 武器技能大招：<b>「' + w.ult.name + (w.ult2 ? ' / ' + w.ult2.name : '') + '」</b> · ' + w.desc +
          (w.id === 'fist' ? '<br>🥋 拳法双奥义：远距「升龙拳」，近身自动改出「咏春快拳」（可修炼解锁）' : '') +
          (w.id === 'fist' || w.ult2 ? '' : '') +
          (gr && gr.desc ? '<br>🎁 装备效果：' + gr.desc : '');
      }
      refreshWinfo();
      opts.appendChild(winfo);
      wrap.appendChild(opts);
      panel.appendChild(wrap);

      var brow = el('div', 'btn-row');
      brow.appendChild(btn('🎲 随机搭配', function () {
        var r = SG.DATA.randomCustom(true);
        custom.color = r.color; custom.hair = r.hair; custom.hat = r.hat;
        custom.clothes = r.clothes; custom.weapon = r.weapon; custom.gear = r.gear;
        rows.forEach(function (r2) { r2.refresh(); });
        refreshDots(); refreshWinfo(); tickPreview();
        SG.Audio.sfx('unlock');
      }));
      brow.appendChild(btn('🎬 招式演练', function () {
        if (cfg.name !== undefined) custom.name = (custom.name || '').trim() || cfg.name;
        UI._lastCustomCfg = cfg;           // 演示结束回到编辑器，保留编辑内容
        SG.game.startUltDemo(custom);
      }, 'small'));
      brow.appendChild(btn('✔ 确定', function () {
        if (cfg.name !== undefined) custom.name = (custom.name || '').trim() || cfg.name;
        SG.Audio.sfx('unlock');
        cfg.onDone(custom);
      }, 'primary'));
      // 返回：优先回调用方指定页面（修复返回后首页空白的 Bug）
      brow.appendChild(btn('返回', function () {
        SG.Audio.sfx('click');
        if (cfg.onCancel) { cfg.onCancel(); return; }
        UI.show(cfg.returnScreen || 'title');
      }));
      panel.appendChild(brow);
      s.appendChild(panel);

      // 预览动画注册（先 show 重置预览列表，再注册）
      this.show('custom');
      this.previews.push({ canvas: cv, custom: custom, t: 0 });
      tickPreview();
    },

    tickPreviews: function (dt) {
      for (var i = 0; i < this.previews.length; i++) {
        var p = this.previews[i];
        var ctx = p.canvas.getContext('2d');
        p.t += dt;
        if (p.canvas.width <= 100) {
          // 小画布：只画头像
          SG.Stick.drawPortrait(ctx, p.custom, p.canvas.width, p.canvas.height, p.t);
        } else {
          ctx.clearRect(0, 0, p.canvas.width, p.canvas.height);   // 清屏防残影
          SG.Stick.draw(ctx, {
            x: 130, y: 300, facing: 1, pose: 'idle', t: p.t,
            custom: p.custom, scale: 1.55
          });
        }
      }
    },

    // ================= 故事地图 =================
    buildStoryMap: function () { },
    refresh_storyMap: function () {
      var s = this.screens.storyMap;
      s.className = 'screen solid';
      s.innerHTML = '';
      var g = SG.game;
      var panel = el('div', 'panel');
      panel.appendChild(el('h2', 'title', '📖 故事模式 · 暗影危机'));
      panel.appendChild(el('div', 'tiny', '暗影军团入侵墨水大陆，夺走圣火令。闯过六关，击败暗影武帝，夺回圣火令，加冕武林盟主！'));
      var heroRow = el('div', 'pslot');
      var heroCv = el('canvas'); heroCv.width = 64; heroCv.height = 84;
      heroRow.appendChild(heroCv);
      var heroInfo = el('div', 'pinfo');
      heroInfo.appendChild(el('div', 'pname', g.profile.name));
      var hc = g.profile.storyCustom;
      heroInfo.appendChild(el('div', 'pcustom',
        SG.DATA.weaponById(hc.weapon).name + ' · ' +
        (SG.DATA.HAIRS.find(function (x) { return x.id === hc.hair; }) || {}).name + ' · ' +
        (SG.DATA.HATS.find(function (x) { return x.id === hc.hat; }) || {}).name));
      heroRow.appendChild(heroInfo);
      heroRow.appendChild(btn('更换造型', function () {
        UI.openCustom({
          title: '主角造型', custom: g.profile.storyCustom, name: g.profile.name,
          onDone: function (c) {
            g.profile.name = c.name || g.profile.name;
            g.saveProfile();
            UI.refresh_storyMap();
            UI.show('storyMap');
          },
          allowCancel: function () { }
        });
      }, 'small'));
      panel.appendChild(heroRow);

      var map = el('div', 'story-map');
      SG.DATA.STORY.forEach(function (lv) {
        var cleared = g.storyProgress >= lv.id;
        var open = g.storyProgress >= lv.id - 1;
        var node = el('div', 'story-node' + (open ? '' : ' locked') + (cleared ? ' done' : ''));
        node.appendChild(el('div', 'num', open ? lv.id : '🔒'));
        var info = el('div', 'info');
        info.appendChild(el('div', 'nm', lv.name));
        info.appendChild(el('div', 'boss', '⚔ BOSS：' + lv.boss.name + (lv.finalBoss ? '（最终BOSS）' : '')));
        info.appendChild(el('div', 'desc', lv.desc));
        node.appendChild(info);
        var stars = g.storyStars[lv.id] || 0;
        node.appendChild(el('div', 'stars', cleared ? '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars) : (open ? '可挑战' : '')));
        if (open) node.appendChild(btn(cleared ? '再战' : '出发', function () { g.startStoryLevel(lv.id); }, 'small primary'));
        map.appendChild(node);
      });
      panel.appendChild(map);
      var br = el('div', 'btn-row');
      br.appendChild(btn('返回主菜单', function () { UI.show('title'); }));
      panel.appendChild(br);
      s.appendChild(panel);
      this.previews.push({ canvas: heroCv, custom: g.profile.storyCustom, t: 0, portrait: true });
    },

    // ================= 剧情对话 =================
    buildDialogue: function () { },

    openDialogue: function (lines, chars, bg, onDone) {
      // chars: {主角: custom, BOSS名: custom, 长老: custom...}
      var s = this.screens.dialogue;
      s.className = 'screen dim';
      s.innerHTML = '';
      var panel = el('div', 'panel dialogue-box');
      var stage = el('div', 'dlg-stage');
      if (bg) stage.style.background = bg;
      var left = el('canvas'); left.width = 260; left.height = 280;
      var right = el('canvas'); right.width = 260; right.height = 280;
      stage.appendChild(left);
      stage.appendChild(right);
      panel.appendChild(stage);
      var box = el('div', 'dlg-text');
      var speaker = el('div', 'dlg-speaker');
      var line = el('div', 'dlg-line');
      box.appendChild(speaker);
      box.appendChild(line);
      var next = el('div', 'dlg-next', '点击继续 ▼');
      box.appendChild(next);
      panel.appendChild(box);
      s.appendChild(panel);

      var idx = 0, shown = '', full = '', typeTimer = null;
      // 固定左右头像：左边主角，右边当前对手
      var leftChar = chars['主角'];
      var rightChar = null;
      Object.keys(chars).forEach(function (k) {
        if (k !== '主角' && !rightChar) rightChar = chars[k];
      });

      function drawPortraits() {
        [left, right].forEach(function (cv, i) {
          var ctx = cv.getContext('2d');
          ctx.clearRect(0, 0, cv.width, cv.height);
          var ch = i === 0 ? leftChar : rightChar;
          var isSpeaking = curLine() && curLine().who === (i === 0 ? '主角' : otherName());
          SG.Stick.drawPortrait(ctx, ch || SG.DATA.defaultCustom(), cv.width, cv.height, performance.now() / 1000);
          cv.style.opacity = ch ? (isSpeaking ? 1 : 0.45) : 0.12;
          cv.style.filter = isSpeaking ? 'none' : 'grayscale(40%)';
        });
      }
      function otherName() {
        var keys = Object.keys(chars).filter(function (k) { return k !== '主角'; });
        return keys[0] || '';
      }
      function curLine() { return lines[idx]; }

      function play() {
        var ln = curLine();
        speaker.textContent = ln.who === '旁白' ? '' : ln.who;
        full = ln.text; shown = '';
        line.textContent = '';
        next.style.visibility = 'hidden';
        drawPortraits();
        clearInterval(typeTimer);
        typeTimer = setInterval(function () {
          shown = full.slice(0, shown.length + 1);
          line.textContent = shown;
          if (shown.length >= full.length) {
            clearInterval(typeTimer);
            next.style.visibility = 'visible';
          }
        }, 28);
      }
      function advance() {
        SG.Audio.sfx('click');
        if (shown.length < full.length) {   // 快进
          shown = full; line.textContent = full;
          clearInterval(typeTimer);
          next.style.visibility = 'visible';
          return;
        }
        idx++;
        if (idx >= lines.length) {
          doc.removeEventListener('keydown', keyHandler);
          s.classList.remove('active');
          UI.activeName = null;
          onDone();
        } else play();
      }
      panel.addEventListener('click', advance);
      var keyHandler = function (e) {
        if (UI.activeName !== 'dialogue') return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
      };
      doc.addEventListener('keydown', keyHandler);
      play();
      this.show('dialogue');
    },

    // ================= 双人对战设置 =================
    buildVersusSetup: function () { },
    refresh_versusSetup: function () {
      var s = this.screens.versusSetup;
      s.className = 'screen dim';
      s.innerHTML = '';
      var g = SG.game;
      var panel = el('div', 'panel');
      panel.appendChild(el('h2', 'title', '⚔️ 双人对战'));

      // 双方列：角色卡 + 操控方式（一一对应网格）
      var vsGrid = el('div', 'grid cols2 vs-grid');
      var sides = [
        { key: 'p1', baseName: g.versus.p1.name, nmEl: null, btns: [],
          opts: [['human', '🙋 真人'], ['auto', '🤖 AI托管']],
          get: function () { return g.versus.p1auto ? 'auto' : 'human'; },
          set: function (v) { g.versus.p1auto = v === 'auto'; } },
        { key: 'p2', baseName: g.versus.p2.name, nmEl: null, btns: [],
          opts: [['human', '🙋 真人'], ['cpu', '🤖 电脑']],
          get: function () { return g.versus.p2cpu ? 'cpu' : 'human'; },
          set: function (v) { g.versus.p2cpu = v === 'cpu'; } }
      ];
      var diffBtns = [];
      function hasAI() { return g.versus.p1auto || g.versus.p2cpu; }
      function syncCtrlUI() {
        sides.forEach(function (sd) {
          sd.btns.forEach(function (b) { b.classList.toggle('primary', b.dataset.v === sd.get()); });
          if (sd.nmEl) sd.nmEl.textContent = sd.baseName + ((sd.key === 'p1' && g.versus.p1auto) || (sd.key === 'p2' && g.versus.p2cpu) ? ' 🤖' : '');
        });
        diffBtns.forEach(function (x) { x.disabled = !hasAI(); });   // 双方都真人时难度无意义，置灰
      }
      ['p1', 'p2'].forEach(function (side, i) {
        var v = g.versus[side];
        var sd = sides[i];
        var cell = el('div', 'vs-col');
        var box = el('div', 'pslot');
        var cv = el('canvas'); cv.width = 64; cv.height = 84;
        box.appendChild(cv);
        var info = el('div', 'pinfo');
        var nm = el('div', 'pname');
        var desc = el('div', 'pcustom');
        info.appendChild(nm); info.appendChild(desc);
        box.appendChild(info);
        var btns = el('div', 'pbtns');
        btns.appendChild(btn('选角色', function () {
          UI.openRosterPicker({
            title: (i === 0 ? '玩家1' : '玩家2') + ' · 从角色库选择',
            returnScreen: 'versusSetup',
            onPick: function (c) {
              v.custom = JSON.parse(JSON.stringify(c));
              if (c.name) v.name = c.name;
              sd.baseName = v.name;
              UI.refresh_versusSetup(); UI.show('versusSetup');
            }
          });
        }, 'small'));
        btns.appendChild(btn('随机', function () {
          var r = SG.DATA.randomCustom(true);
          Object.assign(v.custom, r);
          if (r.name) v.name = r.name;
          sd.baseName = v.name;
          SG.Audio.sfx('unlock');
          UI.refresh_versusSetup(); UI.show('versusSetup');
        }, 'small'));
        box.appendChild(btns);
        cell.appendChild(box);
        // 操控子面板
        var ctrl = el('div', 'vs-ctrl');
        ctrl.appendChild(el('div', 'vs-ctrl-label', '操控'));
        var crow = el('div', 'vrow2');
        sd.opts.forEach(function (o) {
          var b = btn(o[1], function () {
            sd.set(o[0]);
            SG.Audio.sfx('click');
            syncCtrlUI();
          }, 'small');
          b.dataset.v = o[0];
          sd.btns.push(b);
          crow.appendChild(b);
        });
        ctrl.appendChild(crow);
        cell.appendChild(ctrl);
        vsGrid.appendChild(cell);
        sd.nmEl = nm;
        box.refresh = function () {
          var badge = (i === 0 && g.versus.p1auto) || (i === 1 && g.versus.p2cpu) ? ' 🤖' : '';
          nm.textContent = v.name + badge;
          var w = SG.DATA.weaponById(v.custom.weapon);
          desc.textContent = w.name + ' · 大招「' + w.ult.name + '」';
          UI.previews.push({ canvas: cv, custom: v.custom, t: Math.random() * 3 });
        };
        box.refresh();
      });
      panel.appendChild(vsGrid);

      // AI 难度
      var diffRow = el('div', 'opt-row');
      diffRow.appendChild(el('div', 'opt-label', 'AI 难度'));
      ['简单', '普通', '困难'].forEach(function (d, i) {
        var b = btn(d, function () {
          g.versus.difficulty = i;
          diffBtns.forEach(function (x, j) { x.classList.toggle('primary', j === i); });
          SG.Audio.sfx('click');
        }, 'small');
        b.classList.toggle('primary', g.versus.difficulty === i);
        diffBtns.push(b);
        diffRow.appendChild(b);
      });
      panel.appendChild(diffRow);
      syncCtrlUI();

      // 场景选择（6 大故事场景 + 自定义场景 + 设计新场景 + 随机）
      var stageRow = el('div', 'opt-row');
      stageRow.appendChild(el('div', 'opt-label', '场景'));
      stageRow.appendChild(UI.buildStagePicker(
        g.versus.stage || 'random',
        function (id) { g.versus.stage = id; UI.refresh_versusSetup(); UI.show('versusSetup'); },
        'versusSetup'
      ));
      panel.appendChild(stageRow);

      panel.appendChild(el('div', 'tiny', 'P1：A/D移动 W跳 S格挡 J拳 K腿 I冲刺 L蓄力 U大招 ｜ P2：方向键 + 数字键盘1拳2腿3冲刺0蓄力回车大招（无小键盘可用 , . / ; \' ）｜ 双方可各自选 AI：人机混战，或托管看 AI 表演赛'));

      var br = el('div', 'btn-row');
      br.appendChild(btn('开战！', function () { g.startVersusBattle(); }, 'primary'));
      br.appendChild(btn('返回', function () { UI.show('title'); }));
      panel.appendChild(br);
      s.appendChild(panel);
    },

    // ================= 武林大会设置 =================
    buildTournamentSetup: function () { },
    refresh_tournamentSetup: function () {
      var s = this.screens.tournamentSetup;
      s.className = 'screen dim';
      s.innerHTML = '';
      var g = SG.game;
      var panel = el('div', 'panel');
      panel.appendChild(el('h2', 'title', '🏆 武林大会 · 家庭争霸赛'));
      panel.appendChild(el('div', 'tiny', '2-8名家人各自选择角色（爷爷奶奶外公外婆叔叔阿姨哥哥姐姐弟弟妹妹都在列），捉对厮杀，胜者晋级，决出总冠军"格斗界武林盟主"！'));

      var list = el('div', 'plist');
      g.tournament.players.forEach(function (p, i) {
        var row = el('div', 'pslot');
        var cv = el('canvas'); cv.width = 64; cv.height = 84;
        row.appendChild(cv);
        var info = el('div', 'pinfo');
        var nm = el('div', 'pname');
        var desc = el('div', 'pcustom');
        info.appendChild(nm); info.appendChild(desc);
        row.appendChild(info);
        var btns = el('div', 'pbtns');
        btns.appendChild(btn('选角色', function () {
          UI.openCustom({
            title: p.name + ' 的角色', custom: p.custom, name: p.name,
            onDone: function (c) {
              p.name = c.name || p.name; p.custom = c;
              UI.refresh_tournamentSetup(); UI.show('tournamentSetup');
            },
            allowCancel: function () { UI.refresh_tournamentSetup(); UI.show('tournamentSetup'); }
          });
        }, 'small'));
        btns.appendChild(btn('随机', function () {
          Object.assign(p.custom, SG.DATA.randomCustom(true));
          SG.Audio.sfx('unlock');
          UI.refresh_tournamentSetup(); UI.show('tournamentSetup');
        }, 'small'));
        row.appendChild(btns);
        list.appendChild(row);
        row.refresh = function () {
          nm.textContent = p.name + (p.cpu ? ' 🤖' : '');
          desc.textContent = SG.DATA.weaponById(p.custom.weapon).name;
          UI.previews.push({ canvas: cv, custom: p.custom, t: Math.random() * 3 });
        };
        row.refresh();
      });

      var cntRow = el('div', 'opt-row');
      cntRow.appendChild(el('div', 'opt-label', '参赛人数'));
      [2, 3, 4, 5, 6, 7, 8].forEach(function (n) {
        var b = btn(n + ' 人', function () { g.setTournamentSize(n); UI.refresh_tournamentSetup(); UI.show('tournamentSetup'); }, 'small');
        if (g.tournament.players.length === n) b.classList.add('primary');
        cntRow.appendChild(b);
      });
      panel.appendChild(cntRow);
      panel.appendChild(list);

      // 大会场景选择（全部场次通用）
      var stageRow = el('div', 'opt-row');
      stageRow.appendChild(el('div', 'opt-label', '大会场景'));
      stageRow.appendChild(UI.buildStagePicker(
        g.tournament.stage || 'random',
        function (id) { g.tournament.stage = id; UI.refresh_tournamentSetup(); UI.show('tournamentSetup'); },
        'tournamentSetup'
      ));
      panel.appendChild(stageRow);

      var br = el('div', 'btn-row');
      br.appendChild(btn('🔥 开始大会', function () { g.beginTournament(); }, 'primary'));
      br.appendChild(btn('返回', function () { UI.show('title'); }));
      panel.appendChild(br);
      s.appendChild(panel);
    },

    // ================= 对阵图 =================
    buildBracket: function () { },
    refresh_bracket: function () {
      var s = this.screens.bracket;
      s.className = 'screen dim';
      s.innerHTML = '';
      var g = SG.game, t = g.tournament;
      var panel = el('div', 'panel');
      panel.appendChild(el('h2', 'title', '🏆 对阵图'));
      var bk = el('div', 'bracket');

      function matchCard(m, label) {
        var card = el('div', 'match-card' + (m === g.currentMatch() ? ' now' : ''));
        card.appendChild(el('div', 'vs-badge', label));
        [m.a, m.b].forEach(function (p, i) {
          var row = el('div', 'mrow');
          if (!p) {
            row.appendChild(el('span', 'tiny', (m.done && m.bye && i === 1) ? '（轮空）' : '待定'));
          } else {
            row.appendChild(el('span', '', p.name + (p.cpu ? ' 🤖' : '')));
            if (m.done) row.classList.add(m.winnerIdx === i ? 'win' : 'lose');
          }
          card.appendChild(row);
        });
        if (m.done && m.winnerIdx >= 0) {
          var w = m.winnerIdx === 0 ? m.a : m.b;
          if (w) card.appendChild(el('div', 'tiny', '胜者：' + w.name));
        }
        return card;
      }

      var R = t.rounds.length;
      for (var r = 0; r < R; r++) {
        var col = el('div', 'bracket-col');
        var remain = R - r;
        var colLabel = remain === 1 ? '决赛' : remain === 2 ? '半决赛' : remain === 3 ? '1/4 决赛' : '第 ' + (r + 1) + ' 轮';
        t.rounds[r].forEach(function (m) { col.appendChild(matchCard(m, colLabel)); });
        bk.appendChild(col);
      }
      var champCard = el('div', 'match-card');
      champCard.style.textAlign = 'center';
      champCard.style.padding = '20px';
      if (t.champion) {
        champCard.appendChild(el('div', '', '👑'));
        champCard.appendChild(el('div', 'pname', t.champion.name));
        champCard.appendChild(el('div', 'tiny', '格斗界·武林盟主'));
      } else {
        champCard.appendChild(el('div', 'tiny', '冠军？'));
        champCard.appendChild(el('div', '', '🏆'));
      }
      bk.appendChild(champCard);
      panel.appendChild(bk);

      var br = el('div', 'btn-row');
      var next = g.currentMatch();
      if (next && !t.champion) {
        br.appendChild(btn('▶ 进行：' + next.a.name + ' vs ' + next.b.name,
          function () { g.startTournamentMatch(); }, 'primary'));
      }
      br.appendChild(btn('返回主菜单', function () { g.quitTournament(); }));
      panel.appendChild(br);
      s.appendChild(panel);
    },

    // ================= 修炼模式 =================
    refresh_training: function () {
      var s = this.screens.training;
      s.className = 'screen solid';
      s.innerHTML = '';
      var g = SG.game;
      var panel = el('div', 'panel');
      panel.appendChild(el('h2', 'title', '🧘 修炼模式'));
      panel.appendChild(el('div', 'tiny',
        '打不赢强敌？回村修炼！在这里开发连招、参悟弹反，学会的武学实战中永久生效。'));

      var list = el('div', 'plist');
      SG.DATA.TRAININGS.forEach(function (tr) {
        var learned = g.hasSkill(tr.id);
        var item = el('div', 'story-node' + (learned ? ' done' : ''));
        item.appendChild(el('div', 'num', tr.icon));
        var info = el('div', 'info');
        info.appendChild(el('div', 'nm', tr.name + (learned ? ' ✅ 已学会' : '')));
        info.appendChild(el('div', 'desc', tr.desc));
        item.appendChild(info);
        item.appendChild(btn(learned ? '🔄 温故' : '开始修炼', function () {
          g.startTraining(tr.id);
        }, 'small primary'));
        list.appendChild(item);
      });
      panel.appendChild(list);
      panel.appendChild(el('div', 'tiny', '修炼在道场进行：按指引完成课题即可学会对应武学，学会后全模式生效。'));

      var br = el('div', 'btn-row');
      br.appendChild(btn('返回主菜单', function () { UI.show('title'); }));
      panel.appendChild(br);
      s.appendChild(panel);
    },

    // ================= 休闲中心 =================
    buildCasualHub: function () { },
    refresh_casualHub: function () {
      var s = this.screens.casualHub;
      s.className = 'screen dim';
      s.innerHTML = '';
      var g = SG.game;
      var panel = el('div', 'panel');
      panel.appendChild(el('h2', 'title', '🎮 休闲中心'));
      var grid = el('div', 'grid cols3');
      var cards = [
        { type: 'dance', icon: '💃', nm: '节奏跳舞', desc: '随着音乐翩翩起舞，方向键踩点，追求全 PERFECT！三首舞曲任选。' },
        { type: 'boat', icon: '🚣', nm: '激流划船', desc: '交替按键划桨，↑/↓ 三水道变道，绕开礁石漩涡，收集金币冲向600米终点！' },
        { type: 'fly', icon: '🪂', nm: '滑翔飞行', desc: '人伞合一！按住上升键操控滑翔伞，收集星星，小心气球和小鸟！' }
      ];
      cards.forEach(function (c) {
        var card = el('div', 'casual-card');
        card.appendChild(el('div', 'icon', c.icon));
        card.appendChild(el('div', 'nm', c.nm));
        card.appendChild(el('div', 'desc', c.desc));
        if (c.type === 'dance') {
          var songs = el('div', 'btn-row');
          SG.Casual.DANCE_SONGS.forEach(function (song) {
            songs.appendChild(btn(song.name, function () { g.startCasual('dance', song.id); }, 'small'));
          });
          card.appendChild(songs);
        } else {
          var br = el('div', 'btn-row');
          br.appendChild(btn('开始', function () { g.startCasual(c.type); }, 'small primary'));
          card.appendChild(br);
        }
        grid.appendChild(card);
      });
      panel.appendChild(grid);
      var br = el('div', 'btn-row');
      br.appendChild(btn('返回主菜单', function () { UI.show('title'); }));
      panel.appendChild(br);
      s.appendChild(panel);
    },

    // ================= 评分榜 =================
    buildLeaderboard: function () { },
    refresh_leaderboard: function () {
      var s = this.screens.leaderboard;
      s.className = 'screen dim';
      s.innerHTML = '';
      var panel = el('div', 'panel');
      panel.appendChild(el('h2', 'title', '🏅 武林评分榜'));
      var list = SG.Board.top(12);
      if (!list.length) {
        panel.appendChild(el('div', 'muted-note', '暂无记录——去打一场吧！'));
      } else {
        var tbl = el('table', 'lb');
        tbl.innerHTML = '<tr><th>#</th><th>名字</th><th>模式</th><th>战绩</th><th>分数</th><th>日期</th></tr>';
        list.forEach(function (e, i) {
          var tr = el('tr', i < 3 ? 'top' + (i + 1) : '');
          var d = new Date(e.date);
          tr.innerHTML = '<td>' + (i + 1) + '</td><td></td><td>' +
            '<span class="rank-tag">' + e.mode + '</span></td><td>' + e.detail +
            '</td><td><b>' + e.score + '</b></td><td>' +
            (d.getMonth() + 1) + '/' + d.getDate() + '</td>';
          tr.children[1].textContent = e.name;
          tbl.appendChild(tr);
        });
        panel.appendChild(tbl);
      }
      var br = el('div', 'btn-row');
      br.appendChild(btn('清空榜单', function () {
        if (confirm('确定清空所有评分记录？')) { SG.Board.clear(); UI.refresh_leaderboard(); UI.show('leaderboard'); }
      }, 'danger small'));
      br.appendChild(btn('返回', function () { UI.show('title'); }));
      panel.appendChild(br);
      s.appendChild(panel);
    },

    // ================= 录像回放 =================
    buildReplays: function () { },
    refresh_replays: function () {
      var s = this.screens.replays;
      s.className = 'screen dim';
      s.innerHTML = '';
      var g = SG.game;
      var panel = el('div', 'panel');
      panel.appendChild(el('h2', 'title', '🎬 录像回放'));

      // 导入分享码 / 分享链接
      var impRow = el('div', 'opt-row');
      impRow.appendChild(el('div', 'opt-label', '导入'));
      var impTa = el('textarea', 'txt');
      impTa.rows = 2;
      impTa.placeholder = '粘贴微信收到的分享链接或分享码';
      impTa.style.flex = '1';
      impTa.addEventListener('focus', function () { impTa.select(); });
      impRow.appendChild(impTa);
      impRow.appendChild(btn('导入', function () {
        var raw = impTa.value.trim();
        if (!raw) return;
        var item = SG.Replay.decode(raw);
        if (!item) { toast('分享码无法识别，请确认复制完整'); return; }
        SG.Replay.importItem(item);
        g.startReplay(item);
      }, 'primary'));
      panel.appendChild(impRow);
      panel.appendChild(el('div', 'tiny', '家人把分享链接/分享码通过微信发给你，粘贴到这里即可观看他的对局。'));

      var list = SG.Replay.list();
      if (!list.length) {
        panel.appendChild(el('div', 'muted-note', '暂无本地录像。每次对战结束后会自动保存最近 12 场比赛录像。'));
      }
      list.forEach(function (r) {
        var item = el('div', 'replay-item');
        var info = el('div', 'rinfo');
        info.appendChild(el('div', 'rname', r.name));
        info.appendChild(el('div', 'rmeta',
          r.modeLabel + ' · ' + r.p1.name + ' vs ' + r.p2.name +
          ' · ' + (r.result || '') + ' · 时长 ' + Math.round(r.duration) + ' 秒'));
        item.appendChild(info);
        item.appendChild(btn('▶ 回放', function () { g.startReplay(r); }, 'small primary'));
        item.appendChild(btn('📤 分享', function () { UI.openShare(r); }, 'small'));
        item.appendChild(btn('删除', function () {
          if (confirm('删除这条录像？')) { SG.Replay.remove(r.id); UI.refresh_replays(); UI.show('replays'); }
        }, 'small danger'));
        panel.appendChild(item);
      });
      var br = el('div', 'btn-row');
      if (list.length) br.appendChild(btn('清空全部录像', function () {
        if (confirm('确定清空全部录像？')) { SG.Replay.clear(); UI.refresh_replays(); UI.show('replays'); }
      }, 'danger small'));
      br.appendChild(btn('返回', function () { UI.show('title'); }));
      panel.appendChild(br);
      s.appendChild(panel);
    },

    // ================= 分享面板 =================
    openShare: function (item) {
      var s = this.screens.share;
      s.className = 'screen dim';
      s.innerHTML = '';
      var link = SG.Replay.shareLink(item);
      var code = SG.Replay.encode(item);
      var panel = el('div', 'panel');
      panel.style.maxWidth = '760px';
      panel.appendChild(el('h2', 'title', '📤 分享录像 · ' + item.p1.name + ' vs ' + item.p2.name));
      panel.appendChild(el('div', 'tiny',
        '三种方式发到微信，任选其一：① 家人扫二维码直接看；② 点开分享链接直接看；③ 复制分享码发过去，家人在「录像回放 → 导入」粘贴观看。'));

      panel.appendChild(el('h3', 'sect', '方式一 · 微信扫码（最方便）'));
      var qrBox = el('div');
      qrBox.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;margin:6px 0;';
      var isLocal = /localhost|127\.0\.0\.1/.test(global.location.hostname);
      try {
        if (typeof global.qrcode !== 'function') throw new Error('no qr lib');
        var qr = global.qrcode(0, 'L');
        qr.addData(link);
        qr.make();
        qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2 });
        var qrSvg = qrBox.querySelector('svg');
        if (qrSvg) { qrSvg.style.width = '180px'; qrSvg.style.height = '180px'; qrSvg.style.background = '#fff'; qrSvg.style.borderRadius = '8px'; }
        panel.appendChild(qrBox);
        panel.appendChild(el('div', 'tiny', isLocal
          ? '⚠ 当前游戏运行在本机（localhost），手机扫码打不开。把游戏部署上线后（如 GitHub Pages），扫码即可直接观看。'
          : '微信「扫一扫」扫描上方二维码，即可直接观看这场对局。'));
      } catch (e) {
        panel.appendChild(el('div', 'opt-hint', '这场对局太长、二维码装不下，请使用下面的分享码方式。'));
      }

      panel.appendChild(el('h3', 'sect', '方式二 · 分享链接（点开即看）'));
      var lt = el('textarea', 'txt');
      lt.rows = 3;
      lt.readOnly = true;
      lt.value = link;
      lt.addEventListener('focus', function () { lt.select(); });
      panel.appendChild(lt);
      panel.appendChild(btn('📋 复制链接', function () { copyText(lt); }, 'small primary'));

      panel.appendChild(el('h3', 'sect', '方式三 · 分享码（对方粘贴导入）'));
      var ct = el('textarea', 'txt');
      ct.rows = 4;
      ct.readOnly = true;
      ct.value = code;
      ct.addEventListener('focus', function () { ct.select(); });
      panel.appendChild(ct);
      panel.appendChild(btn('📋 复制分享码', function () { copyText(ct); }, 'small primary'));

      if (link.length > 20000) {
        panel.appendChild(el('div', 'opt-hint', '⚠ 这场对局较长、链接偏大，若微信里打不开请改用分享码方式。'));
      }
      var br = el('div', 'btn-row');
      br.appendChild(btn('返回', function () { UI.show('replays'); }));
      panel.appendChild(br);
      s.appendChild(panel);
      this.show('share');
    },

    // ================= 人物设定（花名册） =================
    refresh_roster: function () {
      var s = this.screens.roster;
      s.className = 'screen solid';
      s.innerHTML = '';
      var g = SG.game;
      var panel = el('div', 'panel');
      panel.appendChild(el('h2', 'title', '🎭 人物设定'));
      panel.appendChild(el('div', 'tiny', '创建并管理你的角色库。双人对战、武林大会、故事模式里都可以直接选用，无需重复捏人。'));

      var grid = el('div', 'roster-grid');
      g.roster.forEach(function (item) {
        var card = el('div', 'roster-card');
        var cv = el('canvas'); cv.width = 84; cv.height = 104;
        card.appendChild(cv);
        card.appendChild(el('div', 'rname2', item.name));
        var w = SG.DATA.weaponById(item.custom.weapon);
        card.appendChild(el('div', 'rweapon', w.name + ' · 大招「' + w.ult.name + '」'));
        var ops = el('div', 'roster-ops');
        ops.appendChild(btn('✏️ 编辑', function () {
          UI.openCustom({
            title: '编辑角色 · ' + item.name, custom: item.custom, name: item.name,
            returnScreen: 'roster',
            onDone: function (c) {
              item.name = c.name || item.name;
              item.custom = JSON.parse(JSON.stringify(c));
              SG.game.rosterSave(item);
              UI.show('roster');
            }
          });
        }, 'vs'));
        ops.appendChild(btn('🎬 演练', function () {
          UI._lastCustomCfg = null;
          SG.game.startUltDemo(item.custom);
        }, 'vs'));
        ops.appendChild(btn('⭐ 主角', function () {
          g.profile.storyCustom = JSON.parse(JSON.stringify(item.custom));
          g.saveProfile();
          if (SG.UI.toast) SG.UI.toast('已设为故事模式主角');
        }, 'vs'));
        ops.appendChild(btn('🗑', function () {
          if (confirm('删除角色「' + item.name + '」？')) { SG.game.rosterDelete(item.id); UI.refresh_roster(); UI.show('roster'); }
        }, 'vs danger'));
        card.appendChild(ops);
        grid.appendChild(card);
        UI.previews.push({ canvas: cv, custom: item.custom, t: Math.random() * 3 });
      });
      panel.appendChild(grid);

      var br = el('div', 'btn-row');
      br.appendChild(btn('＋ 新建角色', function () {
        UI.openCustom({
          title: '新建角色', custom: SG.DATA.defaultCustom(), name: '', returnScreen: 'roster',
          onDone: function (c) {
            SG.game.rosterSave({ name: c.name || '新角色', custom: JSON.parse(JSON.stringify(c)) });
            UI.show('roster');
          }
        });
      }, 'primary'));
      br.appendChild(btn('返回主菜单', function () { UI.show('title'); }));
      panel.appendChild(br);
      s.appendChild(panel);
    },

    // 角色选择器：从花名册挑一个（对战/大会/故事模式共用）
    openRosterPicker: function (cfg) {
      var s = this.screens.picker;
      s.className = 'screen dim';
      s.innerHTML = '';
      var panel = el('div', 'panel');
      panel.appendChild(el('h2', 'title', cfg.title || '选择角色'));
      var grid = el('div', 'roster-grid');
      SG.game.roster.forEach(function (item) {
        var card = el('div', 'roster-card pick');
        var cv = el('canvas'); cv.width = 84; cv.height = 104;
        card.appendChild(cv);
        card.appendChild(el('div', 'rname2', item.name));
        var w = SG.DATA.weaponById(item.custom.weapon);
        card.appendChild(el('div', 'rweapon', w.name + ' · 「' + w.ult.name + '」'));
        card.addEventListener('click', function () {
          SG.Audio.sfx('unlock');
          UI.show(null);
          cfg.onPick(JSON.parse(JSON.stringify(item.custom)), item);
        });
        grid.appendChild(card);
      });
      panel.appendChild(grid);
      panel.appendChild(el('div', 'tiny', '想新建或修改角色？去「🎭 人物设定」页操作。'));
      var br = el('div', 'btn-row');
      br.appendChild(btn('🎭 前往人物设定', function () { UI.show('roster'); }));
      br.appendChild(btn('返回', function () { UI.show(cfg.returnScreen || 'title'); }));
      panel.appendChild(br);
      s.appendChild(panel);
      this.show('picker');
    },

    // ================= 场景选择器 / 场景设计器 =================
    buildStagePicker: function (selId, onPick, returnScreen) {
      var g = SG.game;
      var wrap = el('div', 'stage-pick');
      function card(id, nm, thumb, deletable) {
        var c = el('div', 'stage-card' + (selId === id ? ' sel' : ''));
        if (thumb) c.appendChild(thumb);
        else c.appendChild(el('div', 'stage-rand', '🎲'));
        c.appendChild(el('div', 'stage-nm', nm));
        var mid = SG.Audio.musicForStage(id);
        var meta = null;
        SG.Audio.trackList().forEach(function (t2) { if (t2.id === mid) meta = t2; });
        if (meta) c.appendChild(el('div', 'stage-bgm', '🎵 ' + meta.name));
        if (deletable) {
          var x = el('div', 'stage-del', '✕');
          x.title = '删除该场景';
          x.addEventListener('click', function (e) {
            e.stopPropagation();
            if (confirm('删除场景「' + nm + '」？')) {
              g.removeCustomStage(id);
              if (selId === id) onPick('random');
              UI.show(returnScreen);
            }
          });
          c.appendChild(x);
        }
        c.addEventListener('click', function () { SG.Audio.sfx('click'); onPick(id); });
        return c;
      }
      wrap.appendChild(card('random', '🎲 随机'));
      SG.DATA.STAGES.forEach(function (st) {
        wrap.appendChild(card(st.id, st.name, stageThumbCv(st.id, 116, 64), !!st.custom));
      });
      var add = el('div', 'stage-card stage-add');
      add.innerHTML = '🎨<br>设计新场景';
      add.addEventListener('click', function () {
        UI.openStageDesigner({
          returnScreen: returnScreen,
          onDone: function (st) { g.addCustomStage(st); UI.show(returnScreen); }
        });
      });
      wrap.appendChild(add);
      return wrap;
    },

    openStageDesigner: function (cfg) {
      var s = this.screens.stageDesigner;
      s.className = 'screen dim';
      s.innerHTML = '';
      var st = { id: 'c' + Date.now().toString(36), name: '我的场景',
        sky: ['#2b3358', '#151a2e'], ground: '#4a3b2a', deco: 'dojo', custom: true };
      var panel = el('div', 'panel');
      panel.appendChild(el('h2', 'title', '🎨 设计新场景'));
      panel.appendChild(el('div', 'tiny', '给场景起个响亮的名字，搭配天空与地面颜色，选一种装饰主题，保存后即可在对战与大会中选用。'));

      var nrow = el('div', 'opt-row');
      nrow.appendChild(el('div', 'opt-label', '名称'));
      var nameIn = el('input', 'txt');
      nameIn.value = st.name; nameIn.maxLength = 6;
      nameIn.addEventListener('input', function () { st.name = nameIn.value; draw(); });
      nrow.appendChild(nameIn);
      panel.appendChild(nrow);

      var PAL = ['#2b3358', '#151a2e', '#c9863f', '#5a3418', '#7fa8d8', '#2a3c58',
                 '#4a1414', '#1a0a0a', '#2a1a4a', '#0d0a1a', '#2e5d46', '#12241c',
                 '#7ec8e8', '#123456', '#3a2f22', '#241a38'];
      function colorRow(label, get, set) {
        var row = el('div', 'opt-row');
        row.appendChild(el('div', 'opt-label', label));
        var dots = el('div', 'color-dots');
        PAL.forEach(function (c) {
          var d = el('div', 'color-dot' + (get() === c ? ' sel' : ''));
          d.style.background = c;
          d.addEventListener('click', function () {
            set(c);
            [...dots.children].forEach(function (x) { x.classList.remove('sel'); });
            d.classList.add('sel');
            draw();
          });
          dots.appendChild(d);
        });
        row.appendChild(dots);
        return row;
      }
      panel.appendChild(colorRow('天空 · 上', function () { return st.sky[0]; }, function (c) { st.sky[0] = c; }));
      panel.appendChild(colorRow('天空 · 下', function () { return st.sky[1]; }, function (c) { st.sky[1] = c; }));
      panel.appendChild(colorRow('地面颜色', function () { return st.ground; }, function (c) { st.ground = c; }));

      var drow = el('div', 'opt-row');
      drow.appendChild(el('div', 'opt-label', '装饰'));
      var decoBtns = [];
      [['dojo', '🏮 灯笼'], ['bamboo', '🎋 竹林'], ['desert', '🏜 沙丘'],
       ['snow', '🏔 雪峰'], ['volcano', '🌋 火山'], ['castle', '🏰 王城']].forEach(function (p) {
        var b = btn(p[1], function () {
          st.deco = p[0];
          decoBtns.forEach(function (x) { x.classList.remove('primary'); });
          b.classList.add('primary');
          SG.Audio.sfx('click');
          draw();
        }, 'small');
        if (st.deco === p[0]) b.classList.add('primary');
        decoBtns.push(b);
        drow.appendChild(b);
      });
      panel.appendChild(drow);

      var prevWrap = el('div');
      prevWrap.style.cssText = 'display:flex;justify-content:center;margin:10px 0;';
      var prev = el('canvas'); prev.width = 480; prev.height = 270;
      prev.style.cssText = 'width:480px;max-width:100%;border-radius:10px;border:1px solid #3a4266;';
      prevWrap.appendChild(prev);
      panel.appendChild(prevWrap);

      function draw() {
        try {
          var tmp = { id: st.id, name: st.name, sky: st.sky.slice(), ground: st.ground, deco: st.deco };
          var b = new SG.Battle({ mode: 'versus', stage: 'dojo', roundsToWin: 9, roundTime: 9, silent: true,
            p1: { name: 'a', custom: SG.DATA.defaultCustom(), ctrl: 'human' },
            p2: { name: 'b', custom: SG.DATA.defaultCustom(), ctrl: 'human' }, onEvent: function () {} });
          b.stage = tmp;
          b.bamboos = [];
          if (tmp.deco === 'bamboo') {
            var seed = 999;
            var rr = function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t2 = Math.imul(seed ^ seed >>> 15, 1 | seed); t2 = t2 + Math.imul(t2 ^ t2 >>> 7, 61 | t2) ^ t2; return ((t2 ^ t2 >>> 14) >>> 0) / 4294967296; };
            for (var i = 0; i < 18; i++) b.bamboos.push({ x: rr() * 1280, w: 14 + rr() * 12, shade: rr() });
          }
          b.drawStage(prev.getContext('2d'));
        } catch (e) {}
      }
      draw();

      var br = el('div', 'btn-row');
      br.appendChild(btn('💾 保存场景', function () {
        st.name = (st.name || '').trim() || '我的场景';
        SG.Audio.sfx('unlock');
        cfg.onDone(st);
      }, 'primary'));
      br.appendChild(btn('返回', function () { UI.show(cfg.returnScreen || 'title'); }));
      panel.appendChild(br);
      s.appendChild(panel);
      this.show('stageDesigner');
    },

    // ================= 设置 =================
    buildSettings: function () { },
    refresh_settings: function () {
      var s = this.screens.settings;
      s.className = 'screen dim';
      s.innerHTML = '';
      var g = SG.game;
      var panel = el('div', 'panel');
      panel.appendChild(el('h2', 'title', '⚙️ 设置'));

      // 背景音乐：自动按场景 / 任选曲目（点击即试听）/ 关闭
      var bgmLabel = el('div', 'opt-label', '背景音乐');
      var bgmRow = el('div');
      bgmRow.style.marginBottom = '10px';
      bgmRow.appendChild(bgmLabel);
      var bgmWrap = el('div', 'bgm-list');
      var bgmBtns = [];
      var curBgm = g.settings.bgm || 'auto';
      var bgmOpts = [['auto', '🎵 自动（按场景配乐）']]
        .concat(SG.Audio.trackList().map(function (t2) { return [t2.id, '🎵 ' + t2.name + '（' + t2.mood + '）']; }))
        .concat([['off', '🔇 关闭']]);
      bgmOpts.forEach(function (o) {
        var b = btn(o[1], function () {
          g.settings.bgm = o[0];
          g.saveSettings();
          bgmBtns.forEach(function (x) { x.classList.remove('primary'); });
          b.classList.add('primary');
          if (o[0] === 'off') SG.Audio.stopMusic(); else SG.Audio.music(o[0]);   // 即时试听
          SG.Audio.sfx('click');
        }, 'small');
        b.classList.toggle('primary', curBgm === o[0]);
        bgmBtns.push(b);
        bgmWrap.appendChild(b);
      });
      bgmRow.appendChild(bgmWrap);
      panel.appendChild(bgmRow);
      panel.appendChild(el('div', 'tiny', '「自动」会依据场景氛围切换：竹林武侠、王城恐怖、雪山紧张、大漠史诗…休闲小游戏使用各自专属乐曲。'));
      var vols = SG.Audio.getVolumes();
      [['master', '总音量'], ['music', '音乐音量'], ['sfx', '音效音量']].forEach(function (row) {
        var r = el('div', 'opt-row');
        r.appendChild(el('div', 'opt-label', row[1]));
        var slider = doc.createElement('input');
        slider.type = 'range'; slider.min = 0; slider.max = 100;
        slider.value = Math.round(vols[row[0]] * 100);
        slider.addEventListener('input', function () {
          var v = {};
          v[row[0]] = slider.value / 100;
          SG.Audio.setVolumes(v);
          g.saveSettings();
        });
        r.appendChild(slider);
        panel.appendChild(r);
      });
      // 虚拟按键（触屏设备）
      var trow = el('div', 'opt-row');
      trow.appendChild(el('div', 'opt-label', '虚拟按键'));
      var touchBtns = [];
      [['auto', '自动'], ['on', '常开'], ['off', '关闭']].forEach(function (p2) {
        var b = btn(p2[1], function () {
          g.settings.touch = p2[0];
          g.saveSettings();
          if (SG.Touch) SG.Touch.refresh();
          touchBtns.forEach(function (x) { x.classList.remove('primary'); });
          b.classList.add('primary');
          SG.Audio.sfx('click');
        }, 'small');
        if ((g.settings.touch || 'auto') === p2[0]) b.classList.add('primary');
        touchBtns.push(b);
        trow.appendChild(b);
      });
      panel.appendChild(trow);
      panel.appendChild(el('div', 'tiny', '虚拟按键：触屏设备上的屏幕按钮（战斗/休闲通用）。「自动」为检测到触屏时显示。'));

      // 自动继续：对话/结算超时自动点击（配合托管挂机观赏）
      var acRow = el('div', 'opt-row');
      acRow.appendChild(el('div', 'opt-label', '自动继续'));
      var acBtns = [];
      [[0, '关'], [3, '3 秒'], [5, '5 秒'], [8, '8 秒']].forEach(function (p3) {
        var b = btn(p3[1], function () {
          g.settings.autoContinue = p3[0];
          g.saveSettings();
          acBtns.forEach(function (x) { x.classList.remove('primary'); });
          b.classList.add('primary');
          SG.Audio.sfx('click');
        }, 'small');
        if ((g.settings.autoContinue || 0) === p3[0]) b.classList.add('primary');
        acBtns.push(b);
        acRow.appendChild(b);
      });
      panel.appendChild(acRow);
      panel.appendChild(el('div', 'tiny', '自动继续：剧情对话与结算面板超时后自动点击继续——配合托管模式挂机观赏 AI 大战更佳。'));

      var br = el('div', 'btn-row');
      br.appendChild(btn('返回', function () { UI.show('title'); }));
      panel.appendChild(br);
      s.appendChild(panel);
    },
    buildHelp: function () {
      var s = this.screens.help;
      s.className = 'screen dim';
      var panel = el('div', 'panel');
      panel.appendChild(el('h2', 'title', '❓ 操作说明'));
      var cols = el('div', 'help-cols');
      cols.appendChild(el('div', '',
        '<h3 class="sect">玩家1（P1）</h3>' +
        '<table class="ctl-tbl">' +
        '<tr><td>移动</td><td><kbd>A</kbd><kbd>D</kbd></td></tr>' +
        '<tr><td>跳跃</td><td><kbd>W</kbd></td></tr>' +
        '<tr><td>格挡</td><td><kbd>S</kbd>（按住）</td></tr>' +
        '<tr><td>快攻·拳</td><td><kbd>J</kbd></td></tr>' +
        '<tr><td>重击·腿</td><td><kbd>K</kbd></td></tr>' +
        '<tr><td>冲刺</td><td><kbd>I</kbd></td></tr>' +
        '<tr><td>蓄力</td><td><kbd>L</kbd>（按住）</td></tr>' +
        '<tr><td>释放大招</td><td><kbd>U</kbd>（蓄力条满后）</td></tr>' +
        '</table>'));
      cols.appendChild(el('div', '',
        '<h3 class="sect">玩家2（P2）</h3>' +
        '<table class="ctl-tbl">' +
        '<tr><td>移动</td><td><kbd>←</kbd><kbd>→</kbd></td></tr>' +
        '<tr><td>跳跃</td><td><kbd>↑</kbd></td></tr>' +
        '<tr><td>格挡</td><td><kbd>↓</kbd>（按住）</td></tr>' +
        '<tr><td>快攻·拳</td><td><kbd>数字1</kbd> 或 <kbd>,</kbd></td></tr>' +
        '<tr><td>重击·腿</td><td><kbd>数字2</kbd> 或 <kbd>.</kbd></td></tr>' +
        '<tr><td>冲刺</td><td><kbd>数字3</kbd> 或 <kbd>/</kbd></td></tr>' +
        '<tr><td>蓄力</td><td><kbd>数字0</kbd> 或 <kbd>;</kbd>（按住）</td></tr>' +
        '<tr><td>释放大招</td><td><kbd>回车</kbd> 或 <kbd>\'</kbd></td></tr>' +
        '</table>'));
      panel.appendChild(cols);
      panel.appendChild(el('div', '',
        '<h3 class="sect">战斗规则</h3>' +
        '<div class="tiny" style="line-height:2">' +
        '· 3局2胜制，每回合60秒，时间到按血量百分比判胜<br>' +
        '· 命中对手/被命中都会积累<b style="color:#ffd34d">蓄力条</b>，按住蓄力键可以快速蓄力（但会被打断）<br>' +
        '· 蓄力条满后按大招键释放<b style="color:#ff9040">武器专属大招</b>，各有奇效：升龙拳/旋风斩/破空突刺/崩地震/烈焰火球/影连击<br>' +
        '· 格挡可减免85%伤害；跳跃中也可以出拳踢腿（跳踢）<br>' +
        '· <b style="color:#8fe08f">连招系统</b>：同类攻击 0.4 秒内连续按键自动衔接连段——拳链「直拳→后手拳→上勾拳」、腿链「扫踢→回旋踢」，段位越高伤害与击退越强，段3 主动前冲追击<br>' +
        '· 懒人托管：战斗与休闲玩法中按 <kbd>G</kbd> 或在暂停菜单开启「🤖 托管」，由 AI 代打；托管成绩入榜会标注（托管）<br>' +
        '· 触屏设备会自动显示虚拟按键（可在设置中常开/关闭），手机建议横屏<br>' +
        '· 通用：<kbd>P</kbd>/<kbd>Esc</kbd> 暂停 · <kbd>M</kbd> 静音<br>' +
        '· 休闲模式：方向键与 WASD 通用' +
        '</div>'));
      var br = el('div', 'btn-row');
      br.appendChild(btn('返回', function () { UI.show('title'); }));
      panel.appendChild(br);
      s.appendChild(panel);
    },

    // ================= 通用结算 =================
    buildResult: function () { },
    showResult: function (cfg) {
      // cfg: {title, titleCls, sub, lines[], grade, rewards[], buttons[{label,cb,primary,danger}], mode, score}
      var s = this.screens.result;
      s.className = 'screen dim';
      s.innerHTML = '';
      var panel = el('div', 'panel');
      panel.style.maxWidth = '560px';
      panel.appendChild(el('div', 'result-title ' + (cfg.titleCls || ''), cfg.title));
      if (cfg.sub) panel.appendChild(el('div', 'result-sub', cfg.sub));
      if (cfg.grade) {
        var g = el('div', 'grade grade-' + cfg.grade, cfg.grade);
        panel.appendChild(g);
      }
      (cfg.lines || []).forEach(function (l) {
        var d = el('div', 'stat-line');
        if (typeof l === 'string') { d.innerHTML = '<span>' + l + '</span>'; }
        else { d.innerHTML = '<span>' + l[0] + '</span><b>' + l[1] + '</b>'; }
        panel.appendChild(d);
      });
      if (cfg.score !== undefined) {
        var sc = el('div', 'stat-line');
        sc.innerHTML = '<span>获得评分</span><b style="font-size:22px">+' + cfg.score + '</b>';
        panel.appendChild(sc);
      }
      if (cfg.rewards && cfg.rewards.length) {
        var rl = el('div', 'reward-list');
        cfg.rewards.forEach(function (r) { rl.appendChild(el('div', 'reward-item', '🎉 ' + r)); });
        panel.appendChild(rl);
      }
      var br = el('div', 'btn-row');
      (cfg.buttons || []).forEach(function (b) {
        br.appendChild(btn(b.label, b.cb, b.primary ? 'primary' : (b.danger ? 'danger' : '')));
      });
      panel.appendChild(br);
      s.appendChild(panel);
      this.show('result');
    },

    // ================= 暂停 =================
    buildPause: function () { },
    showPause: function (buttons) {
      var s = this.screens.pause;
      s.className = 'screen dim';
      s.innerHTML = '';
      var panel = el('div', 'panel');
      panel.style.textAlign = 'center';
      panel.style.maxWidth = '420px';
      panel.appendChild(el('h2', 'title', '⏸ 暂停'));
      var menu = el('div', 'menu-list');
      (buttons || []).forEach(function (b) {
        menu.appendChild(btn(b.label, b.cb, b.primary ? 'primary' : ''));
      });
      panel.appendChild(menu);
      s.appendChild(panel);
      this.show('pause');
    }
  };

  SG.UI = UI;
  UI.toast = toast;
})(typeof window !== 'undefined' ? window : globalThis);
