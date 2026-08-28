/* 主控：状态机 / 输入 / 主循环 / 各模式流程 / 结算评分 */
(function (global) {
  'use strict';
  var SG = global.SG;
  var doc = global.document;

  // ================= 持久化 =================
  function loadJSON(key, def) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v === null || v === undefined ? def : v;
    } catch (e) { return def; }
  }
  function saveJSON(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  }

  function makeVersusSlot(name) {
    return { name: name, custom: Object.assign(SG.DATA.defaultCustom(), { name: name }) };
  }
  function cloneCustom(c) { return JSON.parse(JSON.stringify(c)); }

  var game = {
    state: 'menu',
    paused: false,
    canvas: null, ctx: null,
    profile: loadJSON('sga_profile', null),
    storyProgress: loadJSON('sga_progress', 0),
    storyStars: loadJSON('sga_stars', {}),
    settings: loadJSON('sga_settings', null),

    versus: { p1: makeVersusSlot('玩家1'), p2: makeVersusSlot('玩家2'), p2cpu: false, difficulty: 1 },
    tournament: { players: [], semis: [], final: null, champion: null, third: [], curIdx: 0 },
    casual: null,
    battle: null,
    battleMeta: null,
    lastReplayItem: null,
    _restartFn: null,
    _quitFn: null,
    menuT: 0,

    saveProfile: function () { saveJSON('sga_profile', this.profile); },
    saveProgress: function () {
      saveJSON('sga_progress', this.storyProgress);
      saveJSON('sga_stars', this.storyStars);
    },
    saveSettings: function () {
      saveJSON('sga_settings', SG.Audio.getVolumes());
    },

    aiByDifficulty: [
      { aggr: 0.3, block: 0.08, jump: 0.05, reaction: 0.55 },
      { aggr: 0.5, block: 0.22, jump: 0.1, reaction: 0.4 },
      { aggr: 0.72, block: 0.38, jump: 0.15, reaction: 0.28 }
    ]
  };

  // 初始化默认档案
  if (!game.profile) {
    game.profile = { name: '大侠', storyCustom: SG.DATA.defaultCustom() };
    game.profile.storyCustom.name = '大侠';
    game.saveProfile();
  }
  if (!game.settings) {
    game.settings = { master: 0.8, music: 0.55, sfx: 0.9 };
  }
  SG.Audio.setVolumes(game.settings);

  // ================= 输入 =================
  var keys = {};
  var P1_MAP = {
    KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
    KeyJ: 'punch', KeyK: 'kick', KeyI: 'dash', KeyL: 'charge', KeyU: 'ult', Space: 'charge'
  };
  var P2_MAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    Numpad1: 'punch', Numpad2: 'kick', Numpad3: 'dash', Numpad0: 'charge', NumpadEnter: 'ult',
    Comma: 'punch', Period: 'kick', Slash: 'dash', Semicolon: 'charge', Quote: 'ult'
  };
  var GAME_CODES = new Set(Object.keys(P1_MAP).concat(Object.keys(P2_MAP)));

  function readInputs() {
    function via(map) {
      var o = {};
      for (var code in map) if (keys[code]) o[map[code]] = true;
      return o;
    }
    return { p1: via(P1_MAP), p2: via(P2_MAP) };
  }
  function casualInputs() {
    var r = readInputs();
    return {
      left: r.p1.left || r.p2.left, right: r.p1.right || r.p2.right,
      up: r.p1.up || r.p2.up, down: r.p1.down || r.p2.down,
      punch: r.p1.punch, kick: r.p1.kick, dash: r.p1.dash,
      charge: r.p1.charge || r.p2.charge, ult: r.p1.ult
    };
  }

  // ================= 模式流程 =================
  function hideUI() { SG.UI.show(null); }

  game.enterStory = function () {
    if (!game.profile.storyCustom) {
      game.profile.storyCustom = SG.DATA.defaultCustom();
      game.profile.storyCustom.name = game.profile.name;
    }
    SG.UI.show('storyMap');
  };

  game.startStoryLevel = function (id) {
    var lv = SG.DATA.STORY.find(function (l) { return l.id === id; });
    var heroCustom = cloneCustom(game.profile.storyCustom);
    heroCustom.name = game.profile.name;
    var chars = { '主角': heroCustom };
    chars[lv.boss.name] = cloneCustom(lv.boss.custom);
    chars['长老'] = Object.assign(SG.DATA.defaultCustom(), { color: 'white', hair: 'long', hat: 'straw', clothes: 'cape' });

    hideUI();
    SG.Audio.music('menu');
    SG.UI.openDialogue(lv.intro, chars, 'linear-gradient(180deg,' + SG.DATA.stageById(lv.stage).sky[0] + ',#10131f)', function () {
      launchBattle({
        mode: 'story', stage: lv.stage, roundsToWin: 1, roundTime: 70,
        storyLevel: lv,
        p1: { name: game.profile.name, custom: heroCustom, ctrl: 'human' },
        p2: { name: lv.boss.name, custom: cloneCustom(lv.boss.custom), hp: lv.boss.hp, isBoss: true, ctrl: Object.assign({}, lv.boss.ai) },
        onEnd: function (battle, result) { storyEnd(lv, result); }
      });
    });
  };

  function storyEnd(lv, result) {
    var win = result.winner === 'p1';
    if (!win) {
      SG.Audio.music('menu');
      SG.UI.showResult({
        title: '挑战失败…', titleCls: 'lose',
        sub: lv.boss.name + ' 实力强大，回村修整再战！',
        lines: [['对手剩余血量', Math.round(result.p2.hpLeft / result.p2.maxHp * 100) + '%']],
        buttons: [
          { label: '🔄 再战', primary: true, cb: function () { game.startStoryLevel(lv.id); } },
          { label: '返回地图', cb: function () { SG.UI.show('storyMap'); } }
        ]
      });
      return;
    }
    // 胜利：星级 + 评分
    var hpPct = result.p1.hpLeft / result.p1.maxHp;
    var stars = hpPct > 0.7 ? 3 : hpPct > 0.4 ? 2 : 1;
    var firstClear = !(game.storyStars[lv.id] > 0);
    var score = lv.scoreBase + Math.round(hpPct * 800) + Math.max(0, Math.round((60 - result.time) * 5)) + (firstClear ? 300 : 0);
    game.storyStars[lv.id] = Math.max(game.storyStars[lv.id] || 0, stars);
    var wasProgress = game.storyProgress;
    game.storyProgress = Math.max(game.storyProgress, lv.id);
    game.saveProgress();
    SG.Board.add({ name: game.profile.name, mode: '故事', score: score, detail: '第' + lv.id + '关 · ' + stars + '星' });

    var rewards = [];
    if (game.storyProgress > wasProgress) {
      lv.rewards.forEach(function (r) {
        if (r.type === 'weapon') { var w = SG.DATA.weaponById(r.id); rewards.push('新武器：' + w.name + '（大招「' + w.ult.name + '」）'); }
        if (r.type === 'hat') rewards.push('新帽子：' + SG.DATA.HATS.find(function (x) { return x.id === r.id; }).name);
        if (r.type === 'clothes') rewards.push('新服装：' + SG.DATA.CLOTHES.find(function (x) { return x.id === r.id; }).name);
        if (r.type === 'gear') rewards.push('新装备：' + SG.DATA.gearById(r.id).name);
        if (r.type === 'color') rewards.push('新肤色：' + SG.DATA.colorById(r.id).name);
        if (r.type === 'title') rewards.push('称号：格斗界·武林盟主 👑');
      });
    }

    var heroCustom = cloneCustom(game.profile.storyCustom);
    heroCustom.name = game.profile.name;
    var chars = { '主角': heroCustom };
    chars[lv.boss.name] = cloneCustom(lv.boss.custom);
    chars['长老'] = Object.assign(SG.DATA.defaultCustom(), { color: 'white', hair: 'long', hat: 'straw', clothes: 'cape' });

    SG.Audio.music('menu');
    SG.UI.openDialogue(lv.outro, chars, 'linear-gradient(180deg,#2d4a2d,#10131f)', function () {
      var buttons = [];
      if (lv.id < SG.DATA.STORY.length) {
        buttons.push({ label: '下一关 ▶', primary: true, cb: function () { game.startStoryLevel(lv.id + 1); } });
      } else {
        buttons.push({ label: '🏆 参加武林大会', primary: true, cb: function () { game.enterTournament(); } });
      }
      buttons.push({ label: '返回地图', cb: function () { SG.UI.show('storyMap'); } });
      SG.UI.showResult({
        title: lv.finalBoss ? '🎉 通关！王国光复！' : '关卡通过！',
        titleCls: 'win',
        sub: lv.name + ' · ' + lv.boss.name + ' 被击败',
        grade: stars === 3 ? 'S' : stars === 2 ? 'A' : 'B',
        lines: [['剩余血量', Math.round(hpPct * 100) + '%'], ['用时', Math.round(result.time) + ' 秒']],
        score: score,
        rewards: rewards,
        buttons: buttons
      });
    });
  }

  // ---------- 双人对战 ----------
  game.enterVersus = function () { SG.UI.show('versusSetup'); };

  game.startVersusBattle = function () {
    var v = game.versus;
    launchBattle({
      mode: 'versus', stage: SG.DATA.STAGES[Math.floor(Math.random() * 6)].id,
      roundsToWin: 2, roundTime: 60,
      p1: { name: v.p1.name, custom: cloneCustom(v.p1.custom), ctrl: 'human' },
      p2: { name: v.p2.name, custom: cloneCustom(v.p2.custom),
            ctrl: v.p2cpu ? cloneCustom(game.aiByDifficulty[v.difficulty]) : 'human' },
      onEnd: function (battle, result) { versusEnd(result, battle); }
    });
  };

  function versusEnd(result, battle) {
    var winner = result.winner === 'p1' ? result.p1 : result.p2;
    var loser = result.winner === 'p1' ? result.p2 : result.p1;
    var hpPct = winner.hpLeft / winner.maxHp;
    var score = 600 + Math.round(hpPct * 600) + winner.maxCombo * 20;
    SG.Board.add({ name: winner.name, mode: '双人对战', score: score,
      detail: '胜' + winner.roundsWon + '回合 · 最高' + winner.maxCombo + '连击' });
    SG.Audio.music('menu');
    SG.UI.showResult({
      title: winner.name + ' 获胜！', titleCls: 'win',
      sub: '比分 ' + winner.roundsWon + ' : ' + loser.roundsWon + ' · 总用时 ' + Math.round(result.time) + ' 秒',
      lines: [['胜者最高连击', winner.maxCombo + ' 连击'], ['胜者剩余血量', Math.round(hpPct * 100) + '%']],
      score: score,
      buttons: [
        { label: '🔄 再来一局', primary: true, cb: function () { game.startVersusBattle(); } },
        { label: '观看回放', cb: function () { if (game.lastReplayItem) game.startReplay(game.lastReplayItem); } },
        { label: '返回设置', cb: function () { SG.UI.show('versusSetup'); } }
      ]
    });
  }

  // ---------- 武林大会 ----------
  game.enterTournament = function () {
    if (!game.tournament.players.length) game.setTournamentSize(4);
    SG.UI.show('tournamentSetup');
  };

  game.setTournamentSize = function (n) {
    var old = game.tournament.players;
    var players = [];
    for (var i = 0; i < n; i++) {
      if (old[i]) players.push(old[i]);
      else {
        var preset = SG.DATA.FAMILY_PRESETS[i];
        players.push({ name: preset.name, custom: cloneCustom(preset.custom), cpu: false });
      }
    }
    game.tournament = { players: players, semis: [], final: null, champion: null, third: [], curIdx: 0 };
  };

  game.beginTournament = function () {
    var t = game.tournament;
    t.champion = null; t.third = []; t.curIdx = 0;
    var ps = t.players;
    if (ps.length === 2) {
      t.semis = [];
      t.final = [ps[0], ps[1]];
    } else {
      var four = ps.slice();
      if (four.length === 3) {
        four.push({ name: '扫地僧', cpu: true, custom: Object.assign(SG.DATA.defaultCustom(), { color: 'brown', hair: 'long', hat: 'straw', clothes: 'cape', weapon: 'fist' }) });
      }
      t.semis = [[four[0], four[1]], [four[2], four[3]]];
      t.final = [null, null];
    }
    SG.UI.show('bracket');
  };

  game.currentMatch = function () {
    var t = game.tournament;
    if (t.semis.length) {
      for (var i = 0; i < t.semis.length; i++) if (!t.semis[i].done) return t.semis[i];
      if (t.final && t.final[0] && t.final[1] && !t.final.done) return t.final;
      return null;
    }
    return t.final && t.final[0] && t.final[1] && !t.final.done ? t.final : null;
  };

  game.startTournamentMatch = function () {
    var t = game.tournament;
    var m = game.currentMatch();
    if (!m) return;
    var a = m[0], b = m[1];
    launchBattle({
      mode: 'tournament', stage: 'dojo', roundsToWin: 2, roundTime: 60,
      p1: { name: a.name, custom: cloneCustom(a.custom), ctrl: 'human' },
      p2: { name: b.name, custom: cloneCustom(b.custom), ctrl: b.cpu ? cloneCustom(game.aiByDifficulty[1]) : 'human' },
      onEnd: function (battle, result) { tournamentMatchEnd(m, result); }
    });
  };

  function tournamentMatchEnd(m, result) {
    m.done = true;
    m.winnerIdx = result.winner === 'p1' ? 0 : 1;
    var t = game.tournament;
    var winner = m[m.winnerIdx];
    var loser = m[1 - m.winnerIdx];
    var scoreLine = (result.winner === 'p1' ? result.p1.roundsWon : result.p2.roundsWon) + ' : ' +
                    (result.winner === 'p1' ? result.p2.roundsWon : result.p1.roundsWon);
    // 决赛 → 产生冠军
    if (m === t.final) {
      t.champion = winner;
      // 2人参赛时没有季军（败者为亚军）
      t.third = t.semis.length ? t.semis.map(function (s) { return s[1 - s.winnerIdx]; }) : [];
      showCeremony();
      return;
    }
    // 半决赛 → 晋级
    if (t.final[0] === null) t.final[0] = winner;
    else t.final[1] = winner;
    SG.Audio.music('menu');
    SG.UI.showResult({
      title: winner.name + ' 晋级！', titleCls: 'win',
      sub: winner.name + ' 击败了 ' + loser.name,
      lines: [['比分', scoreLine]],
      buttons: [
        { label: '查看对阵图', primary: true, cb: function () { SG.UI.show('bracket'); } }
      ]
    });
  }

  function showCeremony() {
    var t = game.tournament;
    game.state = 'ceremony';
    hideUI();
    SG.Audio.music('ceremony');
    game.ceremony = {
      t: 0, champion: t.champion, players: t.players,
      second: t.final[1 - t.final.winnerIdx],
      thirds: t.third,
      done: false
    };
    var handler = function (e) {
      if (game.state !== 'ceremony') return;
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      doc.removeEventListener('keydown', handler);
      game.canvas.removeEventListener('click', handler);
      ceremonyEnd();
    };
    setTimeout(function () {
      doc.addEventListener('keydown', handler);
      game.canvas.addEventListener('click', handler);
    }, 1500);
  }

  function ceremonyEnd() {
    var t = game.tournament;
    var c = game.ceremony;
    var entries = [];
    entries.push({ name: c.champion.name, mode: '武林大会', score: 3000, detail: '总冠军 👑 格斗界武林盟主' });
    entries.push({ name: c.second.name, mode: '武林大会', score: 1500, detail: '亚军' });
    c.thirds.forEach(function (p) {
      entries.push({ name: p.name, mode: '武林大会', score: 800, detail: '季军' });
    });
    entries.forEach(function (e) { SG.Board.add(e); });
    SG.Audio.music('menu');
    SG.UI.showResult({
      title: '👑 ' + c.champion.name + ' 加冕！', titleCls: 'win',
      sub: '荣获「格斗界·武林盟主」称号',
      lines: c.players.map(function (p) {
        var title = p === c.champion ? '总冠军 · +3000' :
          p === c.second ? '亚军 · +1500' :
          c.thirds.indexOf(p) >= 0 ? '季军 · +800' : '参赛 · +200';
        return [p.name, title];
      }),
      buttons: [
        { label: '查看评分榜', primary: true, cb: function () { SG.UI.show('leaderboard'); } },
        { label: '返回主菜单', cb: function () { game.quitTournament(); } }
      ]
    });
  }

  game.quitTournament = function () {
    game.tournament = { players: game.tournament.players, semis: [], final: null, champion: null, third: [], curIdx: 0 };
    game.state = 'menu';
    SG.Audio.music('menu');
    SG.UI.show('title');
  };

  // ---------- 休闲 ----------
  game.enterCasual = function () { SG.UI.show('casualHub'); };

  game.startCasual = function (type, songId) {
    var custom = cloneCustom(game.profile.storyCustom);
    custom.name = game.profile.name;
    game.casual = SG.Casual.create(type, custom, songId);
    game.state = 'casual';
    game.paused = false;
    hideUI();
    SG.Audio.music(game.casual.musicTrack);
  };

  function casualEnd() {
    var c = game.casual;
    var r = c.result;
    SG.Board.add({ name: game.profile.name, mode: r.mode, score: r.score, detail: r.title });
    SG.Audio.music('menu');
    SG.UI.showResult({
      title: r.title, titleCls: 'win',
      grade: r.grade,
      lines: r.lines,
      score: r.score,
      buttons: [
        { label: '🔄 再玩一次', primary: true, cb: function () { game.startCasual(c.song ? 'dance' : (c.goal ? 'boat' : 'fly'), c.song ? c.song.id : undefined); } },
        { label: '休闲中心', cb: function () { game.state = 'menu'; SG.UI.show('casualHub'); } },
        { label: '主菜单', cb: function () { game.state = 'menu'; SG.UI.show('title'); } }
      ]
    });
  }

  // ---------- 回放 ----------
  game.startReplay = function (item) {
    var p = SG.Replay.beginPlayback(item);
    var battle = new SG.Battle({
      mode: 'replay',
      stage: item.stage, roundsToWin: item.roundsToWin || 2, roundTime: 99,
      p1: { name: p.p1.name, custom: p.p1.custom, ctrl: 'human' },
      p2: { name: p.p2.name, custom: p.p2.custom, ctrl: 'human' },
      onEvent: function () {}
    });
    battle.resultCb = null;
    game.battle = battle;
    game.state = 'replay';
    game.paused = false;
    hideUI();
    SG.Audio.music('menu');
  };

  function replayEnd() {
    SG.Replay.endPlayback();
    game.state = 'menu';
    SG.Audio.music('menu');
    SG.UI.showResult({
      title: '▶ 回放结束', titleCls: 'win',
      buttons: [{ label: '返回录像列表', primary: true, cb: function () { SG.UI.show('replays'); } }]
    });
  }

  // ---------- 战斗启动 ----------
  function launchBattle(cfg) {
    var battle = new SG.Battle({
      mode: cfg.mode, stage: cfg.stage, roundsToWin: cfg.roundsToWin,
      roundTime: cfg.roundTime, storyLevel: cfg.storyLevel,
      p1: cfg.p1, p2: cfg.p2,
      onEvent: function (type, data) {
        if (type === 'matchEnd') {
          battle.done = true;
          // 保存录像
          var modeLabels = { story: '故事模式', versus: '双人对战', tournament: '武林大会' };
          var r = data;
          game.lastReplayItem = SG.Replay.finalize(
            modeLabels[cfg.mode] + '：' + (r.winner === 'p1' ? r.p1.name : r.p2.name) + ' 胜'
          );
          if (cfg.onEnd) cfg.onEnd(battle, r);
        }
      }
    });
    game.battle = battle;
    game.battleMeta = cfg;
    game.state = 'battle';
    game.paused = false;
    hideUI();
    SG.Audio.music(cfg.mode === 'story' && cfg.storyLevel && cfg.storyLevel.finalBoss ? 'boss' :
      cfg.mode === 'story' ? 'boss' : 'battle');
    // 录制开始
    SG.Replay.start({
      modeLabel: { story: '故事·' + (cfg.storyLevel ? cfg.storyLevel.name : ''), versus: '双人对战', tournament: '武林大会' }[cfg.mode],
      p1: { name: cfg.p1.name, custom: cfg.p1.custom },
      p2: { name: cfg.p2.name, custom: cfg.p2.custom },
      stage: cfg.stage, roundsToWin: cfg.roundsToWin
    });
    // 重试 / 退出回调
    game._restartFn = cfg._restart || function () { if (cfg.onEnd) { /* 保留结果页入口 */ } };
    game._quitFn = cfg.quit || function () {
      game.state = 'menu';
      SG.Audio.music('menu');
      SG.UI.show('title');
    };
  }

  // ================= 暂停 =================
  function togglePause() {
    if (game.state !== 'battle' && game.state !== 'casual' && game.state !== 'replay') return;
    if (game.paused) { game.paused = false; SG.UI.show(null); return; }
    game.paused = true;
    var buttons = [{ label: '▶ 继续', primary: true, cb: function () { game.paused = false; SG.UI.show(null); } }];
    if (game.state === 'battle' && game.battleMeta) {
      buttons.push({ label: '🔄 重新开始', cb: function () {
        game.paused = false;
        var meta = game.battleMeta;
        var same = Object.assign({}, meta);
        launchBattle(same);
      } });
    }
    var quitLabels = { battle: '退出战斗', casual: '退出休闲', replay: '退出回放' };
    buttons.push({ label: quitLabels[game.state] + ' → 主菜单', danger: true, cb: function () {
      game.paused = false;
      if (game.state === 'replay') { SG.Replay.endPlayback(); }
      if (game.state === 'battle' && SG.Replay.recorder) SG.Replay.cancel();
      game.state = 'menu';
      SG.Audio.music('menu');
      SG.UI.show(game.battleMeta && game.battleMeta.mode === 'story' ? 'storyMap' :
        game.battleMeta && game.battleMeta.mode === 'tournament' ? 'bracket' :
        game.battleMeta && game.battleMeta.mode === 'versus' ? 'versusSetup' : 'title');
    } });
    SG.UI.showPause(buttons);
  }

  // ================= 主循环 =================
  var lastT = 0, acc = 0;
  var DT = 1 / 60;

  function frame(ts) {
    requestAnimationFrame(frame);
    if (!lastT) lastT = ts;
    var el = Math.min(0.25, (ts - lastT) / 1000);
    lastT = ts;

    if (!game.paused) {
      acc += el;
      while (acc >= DT) {
        update(DT);
        acc -= DT;
      }
    }
    render();
    SG.UI.tickPreviews(el);
  }

  function update(dt) {
    game.menuT += dt;
    if (game.state === 'battle') {
      var inp = readInputs();
      game.battle.update(dt, inp);
      // 记录实际生效的输入（CPU 输入由战斗内部生成）
      if (game.battle.lastInputs && SG.Replay.recorder) {
        SG.Replay.tick(game.battle.lastInputs.p1, game.battle.lastInputs.p2);
      }
    } else if (game.state === 'replay') {
      var frames = SG.Replay.nextInputs();
      if (frames === null) {
        // 帧放完后延长时间展示赛后庆祝画面
        game._replayTail = (game._replayTail || 0) + dt;
        if (game._replayTail > 2.5) { game._replayTail = 0; replayEnd(); return; }
        game.battle.update(dt, { p1: {}, p2: {} });
      } else {
        game._replayTail = 0;
        game.battle.update(dt, frames);
      }
    } else if (game.state === 'casual') {
      game.casual.update(dt, casualInputs());
      if (game.casual.over && !game.casual._ended) {
        game.casual._ended = true;
        setTimeout(casualEnd, 400);
      }
    }
  }

  function render() {
    var ctx = game.ctx;
    ctx.clearRect(0, 0, 1280, 720);
    if (game.state === 'battle' || game.state === 'replay') {
      game.battle.draw(ctx);
    } else if (game.state === 'casual') {
      game.casual.draw(ctx);
    } else if (game.state === 'ceremony') {
      drawCeremony(ctx);
    } else {
      drawMenuBg(ctx);
    }
  }

  // 菜单背景：两个火柴人切磋
  function drawMenuBg(ctx) {
    var t = game.menuT;
    var g = ctx.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, '#1c2237'); g.addColorStop(1, '#0b0b12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (var i = 0; i < 40; i++) {
      var x = (i * 137 + t * 12) % 1280, y = (i * 89) % 720;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.fillStyle = '#3a2f22';
    ctx.fillRect(0, 620, 1280, 100);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 620); ctx.lineTo(1280, 620); ctx.stroke();
    // 演武的两个火柴人
    var cyc = t % 6;
    var hero = Object.assign(SG.DATA.defaultCustom(), { color: 'blue', weapon: 'sword' });
    var foe = Object.assign(SG.DATA.defaultCustom(), { color: 'red', weapon: 'fist' });
    function act(x) {
      if (cyc < 1.2) return 'idle';
      if (cyc < 1.4) return 'punchX';
      if (cyc < 1.8) return 'punchW';
      if (cyc < 2.6) return 'idle';
      if (cyc < 2.8) return 'kickX';
      if (cyc < 3.2) return 'kickW';
      if (cyc < 4) return 'block';
      return 'idle';
    }
    var a1 = act(0), a2 = act(2.4);
    SG.Stick.draw(ctx, { x: 480, y: 620, facing: 1, pose: a1 === 'block' ? 'block' : a1, t: t, custom: hero, vx: 0 });
    SG.Stick.draw(ctx, { x: 800, y: 620, facing: -1, pose: a2 === 'block' ? 'block' : a2, t: t + 1, custom: foe, vx: 0 });
    if (cyc > 1.25 && cyc < 1.45) { ctx.fillStyle = '#ffe08a'; ctx.font = 'bold 26px system-ui'; ctx.fillText('✦', 640, 500); }
    if (cyc > 2.85 && cyc < 3.05) { ctx.fillStyle = '#ffe08a'; ctx.font = 'bold 30px system-ui'; ctx.fillText('✷', 640, 520); }
  }

  // 领奖台
  function drawCeremony(ctx) {
    var c = game.ceremony;
    c.t += 1 / 60;
    var t = c.t;
    var g = ctx.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, '#2a1a4a'); g.addColorStop(1, '#120a20');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
    // 彩带
    if (!c.confetti) {
      c.confetti = [];
      for (var i = 0; i < 120; i++) {
        c.confetti.push({ x: Math.random() * 1280, y: Math.random() * 720,
          vy: 60 + Math.random() * 120, vx: (Math.random() - 0.5) * 40,
          c: ['#ffd34d', '#ff7070', '#7fd0ff', '#8fe08f', '#e08fff'][i % 5], r: Math.random() * 6 });
      }
    }
    c.confetti.forEach(function (p) {
      p.y += p.vy / 60; p.x += p.vx / 60;
      if (p.y > 730) p.y = -10;
      ctx.fillStyle = p.c;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r + t);
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    });
    // 领奖台
    ctx.fillStyle = '#3a3060';
    ctx.fillRect(390, 430, 200, 190);   // 2nd
    ctx.fillRect(540, 360, 200, 260);   // 1st
    ctx.fillRect(690, 470, 200, 150);   // 3rd
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('1', 640, 420);
    ctx.fillStyle = '#cfd8ff';
    ctx.font = 'bold 34px system-ui';
    ctx.fillText('2', 490, 475);
    ctx.fillStyle = '#eda96a';
    ctx.fillText('3', 790, 515);
    // 冠军
    var champCustom = cloneCustom(c.champion.custom);
    champCustom.hat = 'crown';
    SG.Stick.draw(ctx, { x: 640, y: 355, facing: 1, pose: 'victory', t: t, custom: champCustom, glow: 0.5 });
    SG.Stick.draw(ctx, { x: 490, y: 425, facing: 1, pose: 'idle', t: t + 2, custom: c.second.custom });
    if (c.thirds[0]) SG.Stick.draw(ctx, { x: 790, y: 465, facing: -1, pose: 'idle', t: t + 4, custom: c.thirds[0].custom });
    // 文案
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px system-ui';
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 8;
    ctx.strokeText(c.champion.name + ' 加冕武林盟主！', 640, 150);
    ctx.fillText(c.champion.name + ' 加冕武林盟主！', 640, 150);
    ctx.font = '22px system-ui';
    ctx.fillStyle = '#ffd97a';
    ctx.fillText('🌟 格斗界·武林盟主 🌟', 640, 195);
    if (t > 1.5) {
      ctx.font = '18px system-ui';
      ctx.fillStyle = 'rgba(255,255,255,' + (Math.sin(t * 4) > 0 ? 0.9 : 0.3) + ')';
      ctx.fillText('按 回车 或点击 颁奖', 640, 680);
    }
    ctx.textAlign = 'left';
  }

  // ================= 启动 =================
  function showErr(msg) {
    var d = doc.getElementById('err-overlay');
    if (!d) return;
    d.classList.remove('hidden');
    d.textContent = (d.textContent + '\n' + msg).slice(-2000);
  }

  function boot() {
    game.canvas = doc.getElementById('game');
    game.ctx = game.canvas.getContext('2d');
    SG.UI.init(doc.getElementById('ui-root'));
    SG.UI.show('title');

    global.addEventListener('error', function (e) {
      showErr('脚本错误: ' + e.message + ' @ ' + (e.filename || '?').split('/').pop() + ':' + e.lineno);
    });
    global.addEventListener('unhandledrejection', function (e) {
      showErr('Promise错误: ' + (e.reason && e.reason.message || e.reason));
    });

    // 键盘
    doc.addEventListener('keydown', function (e) {
      if (GAME_CODES.has(e.code)) {
        keys[e.code] = true;
        e.preventDefault();
        SG.Audio.unlock();
      }
      if (e.code === 'KeyM') {
        var v = SG.Audio.getVolumes();
        var muted = v.master > 0;
        SG.Audio.setVolumes({ master: muted ? 0 : 0.8 });
        game.saveSettings();
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (game.state === 'battle' || game.state === 'casual' || game.state === 'replay') togglePause();
      }
    });
    doc.addEventListener('keyup', function (e) { keys[e.code] = false; });
    doc.addEventListener('pointerdown', function () { SG.Audio.unlock(); }, { once: false });

    // 首次任意点击 → 菜单音乐
    var musicStarted = false;
    doc.addEventListener('pointerdown', function () {
      if (!musicStarted) { musicStarted = true; SG.Audio.music('menu'); }
    });

    requestAnimationFrame(frame);
  }

  SG.game = game;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
