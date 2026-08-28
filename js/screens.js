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
      var names = ['title', 'custom', 'storyMap', 'dialogue', 'versusSetup',
        'tournamentSetup', 'bracket', 'casualHub', 'leaderboard', 'replays',
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
      var panel = el('div', '');
      panel.style.textAlign = 'center';
      panel.appendChild(el('h1', 'logo', '火柴人武林大会'));
      panel.appendChild(el('div', 'subtitle', 'STICKMAN KUNGFU ARENA · 墨水大陆武林传奇'));
      var menu = el('div', 'menu-list');
      menu.style.margin = '0 auto';
      var g = SG.game;
      menu.appendChild(btn('📖 故事模式 · 暗影危机', function () { g.enterStory(); }, 'primary'));
      menu.appendChild(btn('⚔️ 双人对战', function () { g.enterVersus(); }));
      menu.appendChild(btn('🏆 武林大会 · 家庭争霸赛', function () { g.enterTournament(); }));
      menu.appendChild(btn('🎮 休闲中心', function () { g.enterCasual(); }));
      menu.appendChild(btn('🎬 录像回放', function () { UI.show('replays'); }));
      menu.appendChild(btn('🏅 评分榜', function () { UI.show('leaderboard'); }));
      var row2 = el('div', 'btn-row');
      row2.appendChild(btn('操作说明', function () { UI.show('help'); }, 'small'));
      row2.appendChild(btn('设置', function () { UI.show('settings'); }, 'small'));
      menu.appendChild(row2);
      panel.appendChild(menu);
      panel.appendChild(el('div', 'tiny', '首次进入请点击任意按钮以开启声音 · M 静音'));
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
        winfo.innerHTML = '⚡ 武器技能大招：<b>「' + w.ult.name + '」</b> · ' + w.desc +
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
      brow.appendChild(btn('✔ 确定', function () {
        if (cfg.name !== undefined) custom.name = (custom.name || '').trim() || cfg.name;
        SG.Audio.sfx('unlock');
        self.show(null);
        cfg.onDone(custom);
      }, 'primary'));
      if (cfg.allowCancel) {
        brow.appendChild(btn('返回', function () { self.show(null); cfg.onCancel && cfg.onCancel(); }));
      }
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

      var grid = el('div', 'grid cols2');
      ['p1', 'p2'].forEach(function (side, i) {
        var v = g.versus[side];
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
          UI.openCustom({
            title: (i === 0 ? '玩家1' : '玩家2') + '造型', custom: v.custom, name: v.name,
            onDone: function (c) {
              v.name = c.name || v.name; v.custom = c;
              UI.refresh_versusSetup(); UI.show('versusSetup');
            },
            allowCancel: function () { UI.refresh_versusSetup(); UI.show('versusSetup'); }
          });
        }, 'small'));
        btns.appendChild(btn('随机', function () {
          var r = SG.DATA.randomCustom(true);
          Object.assign(v.custom, r);
          SG.Audio.sfx('unlock');
          UI.refresh_versusSetup(); UI.show('versusSetup');
        }, 'small'));
        box.appendChild(btns);
        grid.appendChild(box);
        box.refresh = function () {
          nm.textContent = v.name;
          var w = SG.DATA.weaponById(v.custom.weapon);
          desc.textContent = w.name + ' · 大招「' + w.ult.name + '」';
          UI.previews.push({ canvas: cv, custom: v.custom, t: Math.random() * 3 });
        };
        box.refresh();
      });
      panel.appendChild(grid);

      // P2 电脑开关
      var cpuRow = el('div', 'opt-row');
      cpuRow.appendChild(el('div', 'opt-label', '玩家2'));
      var cpuBtn = btn('', function () {
        g.versus.p2cpu = !g.versus.p2cpu;
        cpuBtn.textContent = g.versus.p2cpu ? '🤖 电脑操控' : '🙋 真人操控';
        SG.Audio.sfx('click');
      });
      cpuBtn.textContent = g.versus.p2cpu ? '🤖 电脑操控' : '🙋 真人操控';
      cpuRow.appendChild(cpuBtn);
      var dwrap = el('div', 'opt-label');
      dwrap.style.width = 'auto';
      dwrap.textContent = '电脑难度';
      cpuRow.appendChild(dwrap);
      // 用按钮组代替原生 select（原生下拉在部分内核里弹窗错位/过大）
      var diffBtns = [];
      ['简单', '普通', '困难'].forEach(function (d, i) {
        var b = btn(d, function () {
          g.versus.difficulty = i;
          diffBtns.forEach(function (x, j) { x.classList.toggle('primary', j === i); });
          SG.Audio.sfx('click');
        }, 'small');
        if (g.versus.difficulty === i) b.classList.add('primary');
        diffBtns.push(b);
        cpuRow.appendChild(b);
      });
      panel.appendChild(cpuRow);
      panel.appendChild(el('div', 'tiny', 'P1：A/D移动 W跳 S格挡 J拳 K腿 I冲刺 L蓄力 U大招 ｜ P2：方向键 + 数字键盘1拳2腿3冲刺0蓄力回车大招（无小键盘可用 , . / ; \' ）'));

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

      var list = el('div');
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
      var list = SG.Board.top(20);
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
      var list = SG.Replay.list();
      if (!list.length) {
        panel.appendChild(el('div', 'muted-note', '暂无录像。每次对战结束后会自动保存最近 12 场比赛录像。'));
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

    // ================= 设置 =================
    buildSettings: function () { },
    refresh_settings: function () {
      var s = this.screens.settings;
      s.className = 'screen dim';
      s.innerHTML = '';
      var g = SG.game;
      var panel = el('div', 'panel');
      panel.appendChild(el('h2', 'title', '⚙️ 设置'));
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
      var br = el('div', 'btn-row');
      br.appendChild(btn('返回', function () { UI.show('title'); }));
      panel.appendChild(br);
      s.appendChild(panel);
    },

    // ================= 帮助 =================
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
})(typeof window !== 'undefined' ? window : globalThis);
