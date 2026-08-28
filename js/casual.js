/* 休闲模式：节奏跳舞 / 激流划船 / 滑翔飞行（复用火柴人形象） */
(function (global) {
  'use strict';
  var SG = global.SG = global.SG || {};
  var W = 1280, H = 720;

  function edges(inp, prev) {
    var e = {};
    for (var k in inp) e[k] = inp[k] && !prev[k];
    return e;
  }
  // 休闲模式不佩戴武器：统一收起，换成拳头
  function noWeapon(custom) { return Object.assign({}, custom, { weapon: 'fist' }); }
  // 计算划船姿势的前手坐标（与 stickman.js 前臂运动学一致，用于把桨锚在手上）
  function rowHand(pose) {
    var pelvis = [0, -70 + (pose.crouch || 0)];
    var neck = [pelvis[0] + Math.sin(pose.lean) * 50, pelvis[1] - Math.cos(pose.lean) * 50];
    var sh = [neck[0] + 4, neck[1] + 2];
    var elb = [sh[0] + Math.sin(pose.armF[0]) * 28, sh[1] + Math.cos(pose.armF[0]) * 28];
    var a = pose.armF[0] + pose.armF[1];
    return [elb[0] + Math.sin(a) * 26, elb[1] + Math.cos(a) * 26];
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fmtTime(s) {
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  var DANCE_SONGS = [
    { id: 'dance1', name: '欢快节拍', bpm: 120, dur: 60 },
    { id: 'dance2', name: '慢摇律动', bpm: 96, dur: 55 },
    { id: 'dance3', name: '疾速狂舞', bpm: 145, dur: 45 }
  ];

  // ============ 1. 节奏跳舞 ============
  function Dance(custom, song) {
    this.custom = custom;
    this.song = song;
    this.musicTrack = song.id;
    this.time = 0;
    this.score = 0;
    this.combo = 0; this.maxCombo = 0;
    this.counts = { perfect: 0, good: 0, miss: 0 };
    this.notes = this.makeChart();
    this.judgeLineY = 470;
    this.laneX = [430, 570, 710, 850];
    this.laneKeys = ['left', 'up', 'down', 'right'];
    this.laneGlyphs = ['←', '↑', '↓', '→'];
    this.prev = {};
    this.fx = [];
    this.stumble = 0;
    this.poseIdx = 0;
    this.over = false;
    this.resultShown = false;
  }

  Dance.prototype.makeChart = function () {
    var notes = [], beat = 60 / this.song.bpm;
    var nBeats = Math.floor(this.song.dur / beat);
    for (var i = 4; i < nBeats; i++) {
      var t = i * beat;
      if (i % 4 === 0 || Math.random() < 0.82) {
        notes.push({ t: t, lane: Math.floor(Math.random() * 4), state: 0 });
      }
      if (Math.random() < 0.28) {
        notes.push({ t: t + beat / 2, lane: Math.floor(Math.random() * 4), state: 0 });
      }
    }
    return notes;
  };

  Dance.prototype.aiInput = function (dt) {
    // 托管 AI：踩着判定点按下音符对应的方向键
    for (var i = 0; i < this.notes.length; i++) {
      var n = this.notes[i];
      if (n.state !== 0) continue;
      var diff = n.t - this.time;
      if (diff < -0.05) continue;
      if (diff <= 0.028) {
        var o = {};
        o[this.laneKeys[n.lane]] = true;
        return o;
      }
      return {};   // notes 按时间有序，最近的还没到点
    }
    return {};
  };

  Dance.prototype.update = function (dt, inp) {
    if (this.over) return;
    this.time += dt;
    if (SG.game && SG.game.autoPilot) inp = this.aiInput(dt);
    var e = edges(inp, this.prev);
    this.prev = Object.assign({}, inp);

    // 判定
    for (var i = 0; i < this.notes.length; i++) {
      var n = this.notes[i];
      if (n.state !== 0) continue;
      var lane = this.laneKeys.indexOf('');
      for (var l = 0; l < 4; l++) {
        if (e[this.laneKeys[l]]) {
          var diff = Math.abs(n.t - this.time);
          if (n.lane === l && diff < 0.2) {
            var perfect = diff < 0.09;
            n.state = perfect ? 2 : 3;
            this.counts[perfect ? 'perfect' : 'good']++;
            this.combo++;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            var mult = 1 + Math.min(1, this.combo / 25);
            this.score += Math.round((perfect ? 300 : 150) * mult);
            SG.Audio.sfx('danceHit');
            this.spawnFx(n.lane, perfect);
            this.poseIdx = (this.poseIdx + 1) % 4;
            break;
          }
        }
      }
    }
    // 未击中 → miss
    for (var j = 0; j < this.notes.length; j++) {
      var m = this.notes[j];
      if (m.state === 0 && this.time - m.t > 0.2) {
        m.state = 1;
        this.counts.miss++;
        this.combo = 0;
        this.stumble = 0.35;
        SG.Audio.sfx('danceMiss');
      }
    }

    this.stumble = Math.max(0, this.stumble - dt);
    for (var k = this.fx.length - 1; k >= 0; k--) {
      this.fx[k].t += dt;
      if (this.fx[k].t > 0.4) this.fx.splice(k, 1);
    }

    if (this.time > this.song.dur + 1.2) this.finish();
  };

  Dance.prototype.spawnFx = function (lane, perfect) {
    for (var i = 0; i < (perfect ? 12 : 7); i++) {
      this.fx.push({
        x: this.laneX[lane], y: this.judgeLineY,
        vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 320 - 60,
        t: 0, c: perfect ? '#ffd34d' : '#8fd0ff'
      });
    }
  };

  Dance.prototype.finish = function () {
    if (this.resultShown) return;
    this.resultShown = true;
    this.over = true;
    var total = this.counts.perfect + this.counts.good + this.counts.miss;
    var acc = total ? (this.counts.perfect + this.counts.good * 0.5) / total : 0;
    var grade = acc > 0.9 ? 'S' : acc > 0.75 ? 'A' : acc > 0.55 ? 'B' : 'C';
    this.score += this.maxCombo * 10;
    this.result = {
      title: '舞蹈结束！', score: this.score,
      lines: [
        'PERFECT × ' + this.counts.perfect,
        'GOOD × ' + this.counts.good,
        'MISS × ' + this.counts.miss,
        '最大连击 × ' + this.maxCombo,
        '准确率 ' + Math.round(acc * 100) + '%'
      ],
      grade: grade, mode: '休闲·跳舞'
    };
  };

  Dance.prototype.draw = function (ctx) {
    // 背景：舞台
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a1030'); g.addColorStop(1, '#0a0618');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 追光
    var t = this.time;
    for (var i = 0; i < 4; i++) {
      var lx = 200 + i * 300 + Math.sin(t * 0.7 + i * 2) * 100;
      var lg = ctx.createLinearGradient(lx, 0, lx, H);
      var hue = ['rgba(255,120,120,', 'rgba(120,255,160,', 'rgba(120,160,255,', 'rgba(255,220,120,'][i];
      lg.addColorStop(0, hue + '0.22)');
      lg.addColorStop(1, hue + '0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(lx - 30, 0); ctx.lineTo(lx + 30, 0);
      ctx.lineTo(lx + 150, H); ctx.lineTo(lx - 150, H);
      ctx.closePath(); ctx.fill();
    }
    // 舞台地板
    ctx.fillStyle = '#241a3a';
    ctx.beginPath(); ctx.ellipse(W / 2, 660, 420, 60, 0, 0, 7); ctx.fill();

    // 舞道
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(this.laneX[0] - 60, 0, 560, H);
    for (var l = 0; l < 4; l++) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(this.laneX[l], this.judgeLineY, 30, 0, 7); ctx.fill();
      ctx.font = 'bold 30px system-ui';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText(this.laneGlyphs[l], this.laneX[l], this.judgeLineY + 11);
    }

    // 音符
    var speed = 520;
    for (var n = 0; n < this.notes.length; n++) {
      var note = this.notes[n];
      if (note.state === 1) continue;             // miss 消失
      if (note.state >= 2) continue;              // 已击中
      var dy = (note.t - this.time) * speed;
      if (dy < -60 || dy > H) continue;
      var y = this.judgeLineY + dy;
      var cx = this.laneX[note.lane];
      ctx.save();
      ctx.translate(cx, y);
      ctx.rotate(this.time * 3);
      ctx.fillStyle = ['#ff7070', '#7fdc9a', '#7fa8ff', '#ffd34d'][note.lane];
      ctx.fillRect(-22, -22, 44, 44);
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(this.laneGlyphs[note.lane], cx, y + 9);
    }

    // 击中特效
    for (var f = 0; f < this.fx.length; f++) {
      var p = this.fx[f];
      p.x += 0; // 位置在 update 中未积分，这里简单随 t 缩放
      var tt = p.t / 0.4;
      ctx.globalAlpha = 1 - tt;
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x + p.vx * p.t - 3, p.y + p.vy * p.t - 3, 6, 6);
      ctx.globalAlpha = 1;
    }

    // 舞者
    var beat = 60 / this.song.bpm;
    var beatIdx = Math.floor(this.time / beat);
    var poseName = this.stumble > 0 ? 'hurt'
      : 'dance' + ((this.poseIdx % 4) + 1);
    var pose = SG.Stick.getPose(poseName, this.time);
    // 每拍换姿势
    if (this.stumble <= 0 && poseName !== 'hurt') pose = SG.Stick.getPose('dance' + ((beatIdx % 4) + 1), this.time);
    var bob = this.stumble > 0 ? 0 : Math.abs(Math.sin(beatIdx * Math.PI)) * 0;
    SG.Stick.draw(ctx, {
      x: W / 2, y: 640 + bob, facing: 1, params: pose, t: this.time,
      custom: noWeapon(this.custom), vx: 0, glow: 0.3,
      eye: this.stumble > 0 ? 'ko' : 'normal'
    });

    // HUD
    ctx.textAlign = 'left';
    ctx.font = 'bold 30px system-ui';
    ctx.fillStyle = '#ffd34d';
    ctx.fillText('♪ ' + this.song.name, 40, 54);
    ctx.font = 'bold 22px system-ui';
    ctx.fillStyle = '#fff';
    ctx.fillText('分数 ' + this.score, 40, 92);
    if (this.combo > 2) {
      ctx.font = 'bold 34px system-ui';
      ctx.fillStyle = '#8fe08f';
      ctx.textAlign = 'center';
      ctx.fillText(this.combo + ' COMBO', W / 2, 130);
    }
    ctx.textAlign = 'right';
    ctx.font = '18px system-ui';
    ctx.fillStyle = '#9fb0d8';
    ctx.fillText('进度 ' + Math.min(100, Math.round(this.time / this.song.dur * 100)) + '%', W - 40, 54);
    ctx.fillText('方向键 或 WASD 踩点', W - 40, 80);
    ctx.textAlign = 'left';
  };

  // ============ 2. 激流划船 ============
  var BOAT_LANES = [468, 522, 576];   // 三条水道

  function Boat(custom) {
    this.custom = custom;
    this.musicTrack = 'boat';
    this.scrollX = 0; this.speed = 120;
    this.dist = 0; this.goal = 600;            // 米
    this.rowPhase = 0; this.lastRowKey = null; this.strokeAnim = 0;
    this.hearts = 3; this.invuln = 0;
    this.lane = 1; this.boatY = BOAT_LANES[1];
    this.coins = []; this.obstacles = [];
    this.spawnX = 800;
    this.bobT = 0;
    this.score = 0; this.coinCount = 0;
    this.over = false; this.resultShown = false;
    this.prev = {};
    this.success = null;
    for (var i = 0; i < 14; i++) this.spawnChunk();
  }

  Boat.prototype.spawnChunk = function () {
    var x = this.spawnX;
    var laneY = BOAT_LANES[Math.floor(Math.random() * 3)];
    var r = Math.random();
    if (r < 0.45) this.obstacles.push({ x: x, y: laneY, type: 'rock', w: 60 + Math.random() * 40, hit: false });
    else if (r < 0.7) this.obstacles.push({ x: x, y: laneY, type: 'log', w: 90 + Math.random() * 50, hit: false });
    else if (r < 0.9) this.coins.push({ x: x, y: laneY - 46, got: false });
    else this.obstacles.push({ x: x, y: laneY, type: 'whirl', w: 70, hit: false });
    this.spawnX += 320 + Math.random() * 260;
  };

  Boat.prototype.aiBoat = function (dt) {
    var inp = {};
    var boatWX = this.scrollX + W / 2;
    var myLaneY = BOAT_LANES[this.lane];
    // 前方本水道有威胁 → 换到安全水道（按目标水道判定，避免平滑坐标误判相邻道）
    this._aiMoveT = (this._aiMoveT === undefined ? 0 : this._aiMoveT) - dt;
    var danger = null, bestD = 1e9;
    for (var i = 0; i < this.obstacles.length; i++) {
      var o = this.obstacles[i];
      if (o.hit) continue;
      var d = o.x - boatWX;
      if (d > -20 && d < 560 && Math.abs(o.y - myLaneY) < 40 && d < bestD) { danger = o; bestD = d; }
    }
    var canRow = true;
    if (danger && this._aiMoveT <= 0) {
      var cands = [];
      if (this.lane > 0) cands.push(this.lane - 1);
      if (this.lane < 2) cands.push(this.lane + 1);
      var self = this;
      var safe = cands.filter(function (l) {
        return !this.obstacles.some(function (o) {
          return !o.hit && Math.abs(o.y - BOAT_LANES[l]) < 40 &&
                 o.x - boatWX > -20 && o.x - boatWX < 560;
        });
      }, this);
      var target;
      if (safe.length) {
        target = safe[0];
      } else if (bestD < 320) {
        canRow = false;   // 三道全堵 → 松桨减速，等错开
        target = this.lane;
      } else {
        target = this.lane === 0 ? 1 : this.lane === 2 ? 1 : (danger.y > myLaneY ? this.lane - 1 : this.lane + 1);
      }
      if (target !== this.lane) {
        if (target < this.lane) inp.up = true; else inp.down = true;
        this._aiMoveT = 0.24;
      }
    }
    // 固定节奏交替划桨（避障需要时可暂停划桨减速）
    this._aiRowT = (this._aiRowT === undefined ? 0 : this._aiRowT) - dt;
    if (canRow && this._aiRowT <= 0) {
      this._aiRowKey = this._aiRowKey === 'left' ? 'right' : 'left';
      inp[this._aiRowKey] = true;
      this._aiRowT = 0.24;
    }
    return inp;
  };

  Boat.prototype.update = function (dt, inp) {
    if (this.over) return;
    if (SG.game && SG.game.autoPilot) inp = this.aiBoat(dt);
    var e = edges(inp, this.prev);
    this.prev = Object.assign({}, inp);
    this.bobT += dt;

    // 变道
    if (e.up && this.lane > 0) { this.lane--; SG.Audio.sfx('countTick'); }
    if (e.down && this.lane < 2) { this.lane++; SG.Audio.sfx('countTick'); }
    this.boatY += (BOAT_LANES[this.lane] - this.boatY) * Math.min(1, dt * 10);

    // 交替划桨：与上次不同的方向键才有效
    var rowKey = null;
    if (e.left) rowKey = 'left';
    if (e.right) rowKey = 'right';
    if (rowKey && rowKey !== this.lastRowKey) {
      this.lastRowKey = rowKey;
      this.speed = Math.min(560, this.speed + 85);
      this.strokeAnim = 0.35;
      SG.Audio.sfx('splash');
      this.rowPhase = 1 - this.rowPhase;
    }
    this.strokeAnim = Math.max(0, this.strokeAnim - dt);
    this.speed = Math.max(60, this.speed - 60 * dt);
    this.scrollX += this.speed * dt;
    this.dist = this.scrollX / 22;

    // 持续生成
    while (this.spawnX < this.scrollX + W + 400) this.spawnChunk();

    // 碰撞（同水道且距离接近才命中）
    var boatX = W / 2, boatY = this.boatY;
    if (this.invuln > 0) this.invuln -= dt;
    var self = this;
    this.obstacles.forEach(function (o) {
      if (o.hit || Math.abs(o.x - self.scrollX - boatX) > 80) return;
      if (Math.abs(o.y - boatY) > 42) return;
      if (self.invuln <= 0) {
        o.hit = true;
        self.hearts--;
        self.invuln = 1.2;
        self.speed *= 0.4;
        SG.Audio.sfx('hitHeavy');
        if (self.hearts <= 0) { self.success = false; self.finish(); }
      }
    });
    this.coins.forEach(function (c) {
      if (!c.got && Math.abs(c.x - self.scrollX - boatX) < 50 && Math.abs(c.y + 46 - boatY) < 45) {
        c.got = true; self.coinCount++;
        self.score += 50;
        SG.Audio.sfx('coin');
      }
    });

    if (this.dist >= this.goal && this.success === null) { this.success = true; this.finish(); }
  };

  Boat.prototype.finish = function () {
    if (this.resultShown) return;
    this.resultShown = true;
    this.over = true;
    var secs = this.dist / 22 / Math.max(60, this.speed) * 60;
    var timeBonus = this.success ? Math.max(0, Math.round((150 - this.dist / 22 * 0.6) * 5)) : 0;
    this.score += this.coinCount * 0 + this.hearts * 150 + timeBonus;
    this.result = {
      title: this.success ? '顺利靠岸！' : '小船翻了……',
      score: this.score,
      lines: [
        '航程 ' + Math.min(this.goal, Math.round(this.dist)) + ' / ' + this.goal + ' 米',
        '金币 × ' + this.coinCount,
        '剩余船体 ' + this.hearts + ' / 3',
        '时间加分 +' + timeBonus
      ],
      grade: this.success ? (this.score > 900 ? 'S' : this.score > 600 ? 'A' : 'B') : 'C',
      mode: '休闲·划船'
    };
  };

  Boat.prototype.draw = function (ctx) {
    // 天空与远山
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7ec8e8'); g.addColorStop(1, '#cfeef8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(120,180,140,0.6)';
    for (var m = 0; m < 6; m++) {
      var mx = ((m * 400 - this.scrollX * 0.15) % (W + 600) + W + 600) % (W + 600) - 300;
      ctx.beginPath(); ctx.arc(mx, 470, 200 + (m % 3) * 60, Math.PI, 0); ctx.fill();
    }
    // 水面
    var wg = ctx.createLinearGradient(0, 480, 0, H);
    wg.addColorStop(0, '#3a8ac8'); wg.addColorStop(1, '#1a4a80');
    ctx.fillStyle = wg; ctx.fillRect(0, 480, W, H - 480);
    // 波浪
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
    for (var wv = 0; wv < 3; wv++) {
      ctx.beginPath();
      for (var px = 0; px <= W; px += 24) {
        var wy = 500 + wv * 46 + Math.sin(px * 0.02 + this.bobT * 2 + wv * 2 + this.scrollX * 0.01) * 7;
        if (px === 0) ctx.moveTo(px, wy); else ctx.lineTo(px, wy);
      }
      ctx.stroke();
    }

    // 障碍与金币
    var self = this;
    this.obstacles.forEach(function (o) {
      var x = o.x - self.scrollX;
      if (x < -150 || x > W + 150) return;
      if (o.type === 'rock') {
        ctx.fillStyle = '#6a6a72';
        ctx.beginPath(); ctx.arc(x, o.y + 8, o.w / 2, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#8a8a92';
        ctx.beginPath(); ctx.arc(x - 8, o.y + 5, o.w / 3, Math.PI, 0); ctx.fill();
      } else if (o.type === 'log') {
        ctx.fillStyle = '#7a5230';
        ctx.fillRect(x - o.w / 2, o.y - 12, o.w, 22);
        ctx.fillStyle = '#5a3a20';
        ctx.fillRect(x - o.w / 2, o.y - 12, o.w, 6);
      } else {
        ctx.strokeStyle = 'rgba(60,140,200,0.8)'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(x, o.y, o.w / 2, self.bobT * 3, self.bobT * 3 + 5); ctx.stroke();
      }
    });
    this.coins.forEach(function (c) {
      if (c.got) return;
      var x = c.x - self.scrollX;
      if (x < -40 || x > W + 40) return;
      var bob = Math.sin(self.bobT * 3 + c.x) * 5;
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.ellipse(x, c.y + bob, 13, 15, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e0a020';
      ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('¥', x, c.y + bob + 6);
    });

    // 船 + 划船火柴人（人船合一：坐在舱内）
    var boatX = W / 2, boatY = this.boatY + Math.sin(this.bobT * 2.4) * 6;
    var tilt = Math.sin(this.bobT * 2.4 + 1) * 0.05;
    ctx.save();
    ctx.translate(boatX, boatY);
    ctx.rotate(tilt);
    if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.4;
    // 船体（远舷 + 舱内）
    ctx.fillStyle = '#8a5a30';
    ctx.beginPath();
    ctx.moveTo(-95, -18); ctx.lineTo(95, -18);
    ctx.lineTo(70, 26); ctx.lineTo(-70, 26);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a421e';
    ctx.fillRect(-95, -18, 190, 8);
    // 人（盆骨落在船舷高度，坐进舱里）
    var rowPose = this.rowPhase > 0 ? 'rowB' : 'rowA';
    var pose = SG.Stick.getPose(rowPose, this.bobT);
    SG.Stick.draw(ctx, { x: 2, y: 54, facing: 1, params: pose, t: this.bobT, custom: noWeapon(this.custom) });
    // 近舷船板（盖住小腿，形成坐进船里的层次）
    ctx.fillStyle = '#9a6838';
    ctx.beginPath();
    ctx.moveTo(-97, -4); ctx.lineTo(97, -4);
    ctx.lineTo(80, 26); ctx.lineTo(-80, 26);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a4e26';
    ctx.fillRect(-97, -6, 194, 5);
    // 桨（握在前手中，随划桨节奏摆动：前伸入水 ↔ 后拉出水）
    var grip = rowHand(pose);
    var gx = 2 + grip[0], gy = 54 + grip[1];
    var prog = this.strokeAnim > 0 ? 1 - this.strokeAnim / 0.35 : 1;
    var oarAng = this.rowPhase > 0 ? 0.75 + prog * 0.5 : 1.25 - prog * 0.5;
    var dx = Math.cos(oarAng), dy = Math.sin(oarAng);
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(gx - dx * 22, gy - dy * 22);
    ctx.lineTo(gx + dx * 95, gy + dy * 95);
    ctx.stroke();
    ctx.save();
    ctx.translate(gx + dx * 95, gy + dy * 95);
    ctx.rotate(oarAng);
    ctx.fillStyle = '#8a6238';
    ctx.beginPath(); ctx.ellipse(4, 0, 16, 8, 0, 0, 7); ctx.fill();
    ctx.restore();
    ctx.restore();
    // 船尾浪花
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    var sx2 = boatX - 90;
    for (var s = 0; s < 4; s++) {
      ctx.beginPath();
      ctx.arc(sx2 - this.speed * 0.04 * s - s * 8, boatY + 18 + Math.sin(this.bobT * 6 + s) * 4, 6 - s, 0, 7);
      ctx.fill();
    }

    // HUD
    ctx.textAlign = 'left';
    ctx.font = 'bold 24px system-ui';
    ctx.fillStyle = '#1a4a80';
    ctx.fillText('航程 ' + Math.min(this.goal, Math.round(this.dist)) + ' / ' + this.goal + ' 米', 40, 54);
    ctx.font = '20px system-ui';
    ctx.fillText('金币 ' + this.coinCount + ' · 分数 ' + this.score, 40, 88);
    ctx.textAlign = 'right';
    ctx.font = '24px system-ui';
    ctx.fillStyle = '#e04040';
    var heartsStr = '';
    for (var h = 0; h < 3; h++) heartsStr += h < this.hearts ? '❤' : '🖤';
    ctx.fillText(heartsStr, W - 40, 54);
    ctx.font = '16px system-ui';
    ctx.fillStyle = '#3a6a9a';
    ctx.fillText('交替按 ←/→（或 A/D）划桨 · ↑/↓ 变道躲避', W - 40, 88);
    ctx.textAlign = 'left';
  };

  // ============ 3. 滑翔飞行 ============
  function Fly(custom) {
    this.custom = custom;
    this.musicTrack = 'fly';
    this.x = 300; this.y = 340; this.vy = 0;
    this.scrollX = 0; this.speed = 300;
    this.hearts = 3; this.invuln = 0;
    this.stars = 0; this.score = 0;
    this.items = [];
    this.spawnX = 900;
    this.t = 0;
    this.over = false; this.resultShown = false;
    this.prev = {};
    while (this.spawnX < 2600) this.spawnItem();
  }

  Fly.prototype.spawnItem = function () {
    var r = Math.random();
    var y = 90 + Math.random() * 430;
    if (r < 0.4) this.items.push({ x: this.spawnX, y: y, type: 'star', got: false });
    else if (r < 0.75) this.items.push({ x: this.spawnX, y: y, type: 'balloon', got: false });
    else this.items.push({ x: this.spawnX, y: y, type: 'bird', got: false, ph: Math.random() * 6 });
    this.spawnX += 240 + Math.random() * 220;
  };

  Fly.prototype.aiFly = function (dt) {
    // 托管 AI：躲避气球/小鸟，顺路捡星星
    var threat = null, threatD = 1e9, star = null, starD = 1e9;
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      if (it.got) continue;
      var sx = it.x - this.scrollX + 300;
      var d = sx - this.x;
      if (d < -20 || d > 420) continue;
      var iy = it.y + (it.type === 'bird' ? Math.sin(this.t * 4 + it.ph) * 30 : 0);
      if (it.type === 'star') {
        if (d < starD) { star = it; star.y = iy; starD = d; }
      } else if (Math.abs(iy - this.y) < 92 && d < threatD) {
        threat = it; threat.y = iy; threatD = d;
      }
    }
    var targetY = 340;
    if (threat) targetY = threat.y > this.y ? this.y - 95 : this.y + 95;   // 从反方向绕开
    else if (star) targetY = star.y;
    targetY = clamp(targetY, 235, 585);
    return { up: this.y > targetY + 14 };   // 低于目标高度 → 喷气
  };

  Fly.prototype.update = function (dt, inp) {
    if (this.over) return;
    this.t += dt;
    if (SG.game && SG.game.autoPilot) inp = this.aiFly(dt);
    var e = edges(inp, this.prev);
    this.prev = Object.assign({}, inp);

    // 飞行物理
    var thrust = inp.up || inp.charge;   // ↑/W/空格(蓄力键)
    this.vy += (thrust ? -1500 : 1100) * dt;
    this.vy = clamp(this.vy, -420, 460);
    this.y += this.vy * dt;
    this.y = clamp(this.y, 235, 585);   // 顶部给伞翼留出空间
    if (this.y >= 585 || this.y <= 235) this.vy *= 0.2;

    this.speed = Math.min(560, this.speed + dt * 6);
    this.scrollX += this.speed * dt;
    while (this.spawnX < this.scrollX + W + 300) this.spawnItem();

    if (this.invuln > 0) this.invuln -= dt;
    var self = this;
    this.items.forEach(function (it) {
      var sx = it.x - self.scrollX + 300;
      if (sx < -80 || sx > W + 80) return;
      var iy = it.y + (it.type === 'bird' ? Math.sin(self.t * 4 + it.ph) * 30 : 0);
      var dd = (sx - self.x) * (sx - self.x) + (iy - self.y) * (iy - self.y);
      if (it.type === 'star' && !it.got && dd < 46 * 46) {
        it.got = true; self.stars++; self.score += 30;
        SG.Audio.sfx('coin');
      } else if (it.type !== 'star' && !it.got && self.invuln <= 0 && dd < 52 * 52) {
        it.got = true;
        self.hearts--; self.invuln = 1.2;
        SG.Audio.sfx('hitHeavy');
        if (self.hearts <= 0) self.finish();
      }
    });

    this.score = Math.floor(this.scrollX / 20) + this.stars * 30 + this.hearts * 100;
  };

  Fly.prototype.finish = function () {
    if (this.resultShown) return;
    this.resultShown = true;
    this.over = true;
    var dist = Math.floor(this.scrollX / 20);
    this.result = {
      title: this.hearts > 0 ? '平安着陆！' : '坠落了……',
      score: this.score,
      lines: [
        '飞行距离 ' + dist + ' 米',
        '收集星星 × ' + this.stars,
        '剩余生命 ' + this.hearts + ' / 3'
      ],
      grade: dist > 3000 ? 'S' : dist > 1800 ? 'A' : dist > 800 ? 'B' : 'C',
      mode: '休闲·飞行'
    };
  };

  Fly.prototype.draw = function (ctx) {
    // 天空
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a6ad0'); g.addColorStop(0.6, '#7ec8f0'); g.addColorStop(1, '#d8f0ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 云
    var self = this;
    for (var c = 0; c < 7; c++) {
      var cx = (((c * 337 - this.scrollX * 0.25) % (W + 500)) + W + 500) % (W + 500) - 250;
      var cy = 80 + (c * 97) % 480;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, 7); ctx.arc(cx + 30, cy - 12, 26, 0, 7); ctx.arc(cx + 58, cy, 30, 0, 7);
      ctx.fill();
    }
    // 海面
    ctx.fillStyle = '#2a7ab0';
    ctx.fillRect(0, 620, W, H - 620);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (var px = 0; px <= W; px += 30) {
      var wy = 630 + Math.sin(px * 0.02 + this.t * 2) * 6;
      if (px === 0) ctx.moveTo(px, wy); else ctx.lineTo(px, wy);
    }
    ctx.stroke();

    // 物件
    this.items.forEach(function (it) {
      var x = it.x - self.scrollX + 300;
      if (x < -80 || x > W + 80) return;
      var y = it.y + (it.type === 'bird' ? Math.sin(self.t * 4 + it.ph) * 30 : Math.sin(self.t * 2 + it.x) * 6);
      if (it.type === 'star' && !it.got) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(self.t * 2);
        ctx.fillStyle = '#ffd34d';
        ctx.beginPath();
        for (var i = 0; i < 5; i++) {
          var a = i * 4 * Math.PI / 5 - Math.PI / 2;
          ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
        }
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (it.type === 'balloon' && !it.got) {
        ctx.fillStyle = '#ff7070';
        ctx.beginPath(); ctx.ellipse(x, y, 26, 32, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#a04040'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y + 32); ctx.quadraticCurveTo(x + 6, y + 46, x, y + 58); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.ellipse(x - 8, y - 10, 7, 10, 0.4, 0, 7); ctx.fill();
      } else if (it.type === 'bird' && !it.got) {
        var flap = Math.sin(self.t * 10 + it.ph) * 12;
        ctx.strokeStyle = '#3a3a4a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 24, y - flap); ctx.lineTo(x, y); ctx.lineTo(x + 24, y - flap);
        ctx.stroke();
      }
    });

    // 飞行火柴人 + 滑翔伞（人伞合一，伞随人一起倾斜）
    var pose = SG.Stick.getPose('fly', this.t);
    var tilt = clamp(this.vy / 900, -0.3, 0.3);
    var bodyHex = SG.DATA.colorById(this.custom.color).hex;
    var lean = clamp(-this.vy * 0.05, -18, 18);   // 上升时伞向前倾
    var cx = this.x + lean, cy = this.y - 190;
    var glideCustom = noWeapon(this.custom);  // 滑翔时收起武器
    ctx.save();
    if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.translate(this.x, this.y);
    ctx.rotate(tilt);
    ctx.translate(-this.x, -this.y);
    // 伞绳（连到双手）
    ctx.strokeStyle = 'rgba(70,70,84,0.9)'; ctx.lineWidth = 2;
    [[-72, -8], [-26, -2], [26, -2], [72, -8]].forEach(function (p) {
      ctx.beginPath();
      ctx.moveTo(cx + p[0], cy + p[1]);
      ctx.lineTo(this.x + p[0] * 0.08, this.y - 168);
      ctx.stroke();
    }, this);
    // 伞翼（条纹滑翔伞）
    var canopyPath = function () {
      ctx.beginPath();
      ctx.moveTo(cx - 92, cy + 4);
      ctx.quadraticCurveTo(cx, cy - 46, cx + 92, cy + 4);
      ctx.quadraticCurveTo(cx, cy - 16, cx - 92, cy + 4);
      ctx.closePath();
    };
    canopyPath();
    ctx.fillStyle = bodyHex; ctx.fill();
    ctx.save();
    canopyPath(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (var s = -2; s <= 2; s += 2) ctx.fillRect(cx + s * 38 - 14, cy - 50, 28, 60);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    canopyPath(); ctx.stroke();
    // 上升时的风痕
    if (this.vy < -60) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (var w = 0; w < 3; w++) {
        var wy = this.y - 40 + w * 30;
        ctx.beginPath();
        ctx.moveTo(this.x - 34 - w * 9, wy);
        ctx.lineTo(this.x - 60 - w * 12, wy);
        ctx.stroke();
      }
    }
    SG.Stick.draw(ctx, { x: this.x, y: this.y, facing: 1, params: pose, t: this.t, custom: glideCustom });
    ctx.restore();

    // HUD
    ctx.textAlign = 'left';
    ctx.font = 'bold 24px system-ui';
    ctx.fillStyle = '#1a4a80';
    ctx.fillText('距离 ' + Math.floor(this.scrollX / 20) + ' 米 · 分数 ' + this.score, 40, 54);
    ctx.fillText('★ × ' + this.stars, 40, 88);
    ctx.textAlign = 'right';
    ctx.font = '24px system-ui';
    ctx.fillStyle = '#e04040';
    var hs = '';
    for (var h = 0; h < 3; h++) hs += h < this.hearts ? '❤' : '🖤';
    ctx.fillText(hs, W - 40, 54);
    ctx.font = '16px system-ui';
    ctx.fillStyle = '#3a6a9a';
    ctx.fillText('按住 ↑/W 操伞上升，松开滑翔', W - 40, 88);
    ctx.textAlign = 'left';
  };

  SG.Casual = {
    DANCE_SONGS: DANCE_SONGS,
    create: function (type, custom, songId) {
      if (type === 'dance') {
        var song = DANCE_SONGS.find(function (s) { return s.id === songId; }) || DANCE_SONGS[0];
        return new Dance(custom, song);
      }
      if (type === 'boat') return new Boat(custom);
      if (type === 'fly') return new Fly(custom);
      return null;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
