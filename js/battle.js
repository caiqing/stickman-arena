/* 战斗管理：回合流程 / 场景绘制 / 特效 / HUD / 判定结算 */
(function (global) {
  'use strict';
  var SG = global.SG = global.SG || {};

  var W = 1280, H = 720, FLOOR = 620;

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function Battle(opts) {
    this.mode = opts.mode || 'versus';         // versus story tournament replay
    this.stage = SG.DATA.stageById(opts.stage || 'dojo');
    this.roundsToWin = opts.roundsToWin !== undefined ? opts.roundsToWin : 2;
    this.roundTime = opts.roundTime || 60;
    this.storyLevel = opts.storyLevel || null;
    this.onEvent = opts.onEvent || function () {};
    this.round = 1;
    this.phase = 'intro';                       // intro fight ko roundend matchend
    this.phaseT = 0;
    this.timer = this.roundTime;
    this.rounds = [];

    this.p1 = new SG.Fighter(opts.p1.custom, { x: 380, facing: 1, hp: opts.p1.hp, isBoss: false });
    this.p1.name = opts.p1.name || this.p1.name;
    var p2opts = { x: 900, facing: -1, hp: opts.p2.hp, isBoss: !!opts.p2.isBoss };
    this.p2 = new SG.Fighter(opts.p2.custom, p2opts);
    this.p2.name = opts.p2.name || this.p2.name;
    this.p1.ctrl = opts.p1.ctrl || 'human';     // 'human' / 'dummy' 或 AI参数对象
    this.p2.ctrl = opts.p2.ctrl || 'human';
    this.demoLoop = !!opts.demoLoop;            // 大招演示模式：木桩自动回位回血，P1 循环放招

    this.floorY = FLOOR; this.minX = 40; this.maxX = W - 40;
    this.particles = []; this.dmgNums = []; this.projectiles = []; this.afterimages = [];
    this.slashes = [];   // 剑气/刀气弧光特效
    // 灵宠
    this.petP1 = opts.p1.pet ? new SG.PetEntity(opts.p1.pet, this.p1, 1) : null;
    this.petP2 = opts.p2.pet ? new SG.PetEntity(opts.p2.pet, this.p2, -1) : null;
    this.shakeT = 0; this.shakeAmp = 0;
    this.hitstop = 0; this.slowmo = 0; this.flash = 0;
    this.banner_ = null;
    this.announce_ = null;
    this.combo = { p1: 0, p2: 0, t1: 0, t2: 0, max1: 0, max2: 0 };
    this.dmgDealt = { p1: 0, p2: 0 };
    this.enraged = false;
    this.time = 0;
    this.winner = null;

    this.stageSeed = mulberry32(1234 + SG.DATA.STAGES.indexOf(this.stage) * 77);
    this.bamboos = [];
    if (this.stage.deco === 'bamboo') {
      for (var bi = 0; bi < 18; bi++) {
        this.bamboos.push({ x: this.stageSeed() * W, w: 14 + this.stageSeed() * 12, shade: this.stageSeed() });
      }
    }
    this.ambient = [];
    this.lightning = 0;
    this.setAnnounce(this.mode === 'story' ? ('第 ' + (this.storyLevel ? this.storyLevel.id : '?') + ' 关 · ' + (this.storyLevel ? this.storyLevel.name : '')) : 'Round 1', 1.4);
    if (!opts.silent) this.sfx('bell');
  }

  Battle.prototype = {
    // ---------- 主更新 ----------
    update: function (dt, inputs) {
      inputs = inputs || {};
      var i1 = inputs.p1 || {}, i2 = inputs.p2 || {};
      this.time += dt;

      // 阶段推进
      this.phaseT += dt;
      if (this.phase === 'intro') {
        if (this.phaseT > 1.5) {
          this.phase = 'fight'; this.phaseT = 0;
          this.setAnnounce('开战！', 0.7);
          this.sfx('bell');
        }
      } else if (this.phase === 'fight') {
        this.timer -= dt;
        if (this.timer <= 0) { this.timer = 0; this.timeUp(); }
      } else if (this.phase === 'ko') {
        this.slowmo = Math.max(0, this.slowmo - dt);
        if (this.phaseT > 1.9) this.afterKo();
      } else if (this.phase === 'roundend') {
        if (this.phaseT > 1.6) this.nextRound();
      }

      var active = this.phase === 'fight';
      var scale = this.slowmo > 0 ? 0.35 : 1;
      var sdt = dt * scale;

      if (this.hitstop > 0) {
        this.hitstop -= dt;
      } else if (active || this.phase === 'ko' || this.phase === 'roundend' || this.phase === 'matchend') {
        // 陪练 AI（修炼模式）：有节奏地出招，供练习弹反/连招
        if (this.p2.ctrl === 'dummyai') {
          this.p2.facing = this.p1.x > this.p2.x ? 1 : -1;
          this.p2._atkCd = (this.p2._atkCd === undefined ? 80 : this.p2._atkCd) - 1;
          if (this.p2._atkCd <= 0 && this.p2.canAct() && Math.abs(this.p1.x - this.p2.x) < 160) {
            this.p2.startAttack(Math.random() < 0.6 ? 'light' : 'heavy');
            this.p2._atkCd = 75 + Math.floor(Math.random() * 45);
          }
          i2 = {};
        } else {
          if (this.p1.ctrl !== 'human' && this.p1.ctrl !== 'dummy') i1 = SG.AI.think(this.p1, this.p2, sdt, this.p1.ctrl, this);
          if (this.p2.ctrl !== 'human' && this.p2.ctrl !== 'dummy') i2 = SG.AI.think(this.p2, this.p1, sdt, this.p2.ctrl, this);
        }
        if (!active) { i1 = {}; i2 = {}; }   // 非战斗阶段锁操作
        this.lastInputs = { p1: i1, p2: i2 };  // 实际生效输入（录像用）
        this.p1.update(sdt, i1, this.p2, this);
        this.p2.update(sdt, i2, this.p1, this);

        // Boss 狂暴
        if (!this.enraged && this.p2.isBoss && this.p2.hp < this.p2.maxHp * 0.5 && this.p2.state !== 'ko') {
          var ai = this.p2.ctrl;
          if (ai && ai.final) {
            this.enraged = true;
            this.p2.spdMult *= 1.25; this.p2.dmgMult *= 1.18;
            this.banner('武帝狂暴！');
            this.sfx('ultReady');
            this.shake(10, 0.4);
            this.flash = 0.4;
          }
        }
      }

      // 被击倒后进入 ko 阶段
      if (active && (this.p1.hp <= 0 || this.p2.hp <= 0)) {
        this.phase = 'ko'; this.phaseT = 0;
        this.slowmo = 1.2;
        this.setAnnounce('K.O.！', 1.6);
        this.shake(12, 0.5);
      }

      this.updateProjectiles(sdt);
      this.updateFx(sdt);
      this.updateAmbient(sdt);
      // 灵宠更新
      try {
        if (this.petP1) this.petP1.update(sdt, this.p2, this.petP2, this);
        if (this.petP2) this.petP2.update(sdt, this.p1, this.petP1, this);
      } catch (e) {}
      // 灵宠替主人挡投射物
      if (this.petP1 && this.petP1.hp > 0 && this.petP1.hurtT <= 0) this.interceptPet(this.petP1, this.p1);
      if (this.petP2 && this.petP2.hp > 0 && this.petP2.hurtT <= 0) this.interceptPet(this.petP2, this.p2);

      // 大招演示模式：木桩回位回血、主角循环放招
      if (this.demoLoop) {
        var home = function (f, tx) { f.x += (tx - f.x) * Math.min(1, dt * 2.5); };
        home(this.p1, 380);
        home(this.p2, 900);
        this.p2.hp = this.p2.maxHp;
        this.p2.eye = 'normal';
        if (this.p2.state === 'hurt' && this.hurtHold === undefined) { /* 保持受击姿态自然恢复 */ }
        this.demoT = (this.demoT || 0) + dt;
        if (this.p1.state !== 'ult' && this.demoT > 2.3) {
          this.demoT = 0;
          this.p1.meter = 100;
          this.p1.startUlt(this.p2, this);
        }
      }
      // 修炼模式：道场临时解禁对应武学供试用
      if (this.mode === 'training' && this.training) {
        if (this.training.skill === 'chain3') this.p1._allowChain3 = true;
        if (this.training.skill === 'kick3') this.p1._allowKick3 = true;
        if (this.training.skill === 'ipman') this.p1._allowIpman = true;
      }

      if (this.shakeT > 0) this.shakeT -= dt;
      if (this.flash > 0) this.flash -= dt * 2;
      if (this.banner_) { this.banner_.t += dt; if (this.banner_.t > 1.3) this.banner_ = null; }
      if (this.announce_) { this.announce_.t += dt; if (this.announce_.t > this.announce_.dur) this.announce_ = null; }
      // 连击窗口
      ['1', '2'].forEach(function (k) {
        var key = 't' + k;
        if (this.combo[key] > 0) {
          this.combo[key] -= dt;
          if (this.combo[key] <= 0) { this.combo['p' + k] = 0; }
        }
      }, this);
    },

    timeUp: function () {
      var h1 = this.p1.hp / this.p1.maxHp, h2 = this.p2.hp / this.p2.maxHp;
      var winner = h1 >= h2 ? 'p1' : 'p2';   // 血量相同判 P1 胜，避免无限平局
      this.setAnnounce('时间到！', 1.4);
      this.sfx('bell');
      this.phase = 'ko'; this.phaseT = 0; this.slowmo = 0;
      this.pendingWinner = winner;
      if (winner === 'p1') {
        if (this.p2.state !== 'ko') { this.p2.state = 'ko'; this.p2.vy = -300; this.p2.vx = 200; this.p2.onGround = false; this.p2.eye = 'ko'; }
      } else {
        if (this.p1.state !== 'ko') { this.p1.state = 'ko'; this.p1.vy = -300; this.p1.vx = -200; this.p1.onGround = false; this.p1.eye = 'ko'; }
      }
    },

    afterKo: function () {
      var winner = this.pendingWinner !== undefined ? this.pendingWinner :
        (this.p1.hp <= 0 ? 'p2' : 'p1');
      this.pendingWinner = undefined;
      this.rounds.push(winner);
      if (winner === 'p1') this.p1.roundsWon++; else if (winner === 'p2') this.p2.roundsWon++;
      this.winner = winner;
      if (this.p1.roundsWon >= this.roundsToWin || this.p2.roundsWon >= this.roundsToWin) {
        // 比赛结束
        this.phase = 'matchend'; this.phaseT = 0;
        var champ = this.p1.roundsWon >= this.roundsToWin ? this.p1 : this.p2;
        var loser = champ === this.p1 ? this.p2 : this.p1;
        if (champ.state !== 'ko') champ.state = 'victory';
        loser.state = loser.state === 'ko' ? 'ko' : 'dead';
        this.setAnnounce(champ.name + ' 获胜！', 3);
        this.sfx('win');
        this.onEvent('matchEnd', this.result());
      } else {
        this.phase = 'roundend'; this.phaseT = 0;
        this.setAnnounce(winner === null ? '平局！' :
          (winner === 'p1' ? this.p1.name : this.p2.name) + ' 拿下本回合', 1.5);
        this.sfx('win');
      }
    },

    nextRound: function () {
      this.round++;
      this.timer = this.roundTime;
      this.phase = 'intro'; this.phaseT = 0;
      this.resetFighter(this.p1, 380, 1);
      this.resetFighter(this.p2, 900, -1);
      this.projectiles.length = 0;
      this.setAnnounce('Round ' + this.round, 1.4);
      this.sfx('bell');
    },

    resetFighter: function (f, x, facing) {
      f.x = x; f.y = FLOOR; f.vx = 0; f.vy = 0; f.facing = facing;
      f.hp = f.maxHp;
      f.state = 'idle'; f.stateT = 0; f.hurtT = 0;
      f.atk = null; f.ult = null; f.invincible = false;
      f.eye = f.isBoss ? 'angry' : 'normal';
      if (f.state !== 'victory') f.state = 'idle';
    },

    result: function () {
      return {
        winner: this.p1.roundsWon >= this.roundsToWin ? 'p1' : 'p2',
        rounds: this.rounds.slice(),
        p1: { name: this.p1.name, hpLeft: Math.max(0, this.p1.hp), maxHp: this.p1.maxHp, maxCombo: this.combo.max1, dmg: this.dmgDealt.p1, roundsWon: this.p1.roundsWon },
        p2: { name: this.p2.name, hpLeft: Math.max(0, this.p2.hp), maxHp: this.p2.maxHp, maxCombo: this.combo.max2, dmg: this.dmgDealt.p2, roundsWon: this.p2.roundsWon },
        time: this.time
      };
    },

    // ---------- 判定 ----------
    onHit: function (attacker, victim, info) {
      var from = attacker.x <= victim.x ? 1 : -1;
      var stg = attacker.atk ? attacker.atk.stage : 1;
      var res = victim.takeHit({
        dmg: info.dmg, kb: info.kb, hitstun: info.hitstun,
        launch: info.launch, from: from, fromX: attacker.x,
        hitSfx: info.hitSfx
      }, this);
      if (!res) return;
      var key = attacker === this.p1 ? 'p1' : 'p2';

      // 弹反成功：攻击者硬直 + 击退，受击者蓄力 +20
      if (res === 'parried') {
        attacker.state = 'hurt'; attacker.stateT = 0; attacker.hurtT = 0.75;
        attacker.vx = -from * 280; attacker.vy = -170; attacker.onGround = false;
        attacker.comboStage = 0;
        this.onMeterGain(victim, 20);
        this.dmgNums.push({ x: victim.x, y: victim.y - 200, val: '弹反!', life: 1 });
        this.spawnHitSparks(victim.x, victim.y - 100, 12, false, '#9ad6ff');
        this.hitstop = 0.12;
      } else if (res === 'hit' || res === 'ko') {
        this.dmgDealt[key] += info.dmg;
        this.combo[key]++;
        this.combo['t' + key.slice(1)] = 1.2;
        if (this.combo[key] > this.combo['max' + key.slice(1)]) this.combo['max' + key.slice(1)] = this.combo[key];
        this.onMeterGain(attacker, info.isUlt ? 0 : 10);
        this.dmgNums.push({
          x: victim.x + (Math.random() - 0.5) * 30, y: victim.y - 170,
          val: Math.round(info.dmg), life: 0.9, crit: !!info.heavy || !!info.isUlt
        });
        this.spawnHitSparks(victim.x, victim.y - 90, info.heavy || info.isUlt ? 16 : 8, info.isUlt);
        this.hitstop = info.isUlt ? 0.16 : (info.heavy ? 0.1 : 0.055);
        this.shake(info.isUlt ? 12 : info.heavy ? 7 : 3, info.isUlt ? 0.35 : 0.2);
      } else if (res === 'blocked') {
        this.onMeterGain(attacker, 3);
        this.hitstop = 0.03;
      }
      if (res === 'ko') {
        this.hitstop = 0.2;
        this.flash = 0.5;
      }

      // 修炼模式进度
      if (this.training && attacker === this.p1) {
        var tr = this.training;
        if (tr.skill === 'parry' && res === 'parried') tr.got++;
        else if ((tr.skill === 'chain3' || tr.skill === 'kick3') && res === 'hit' && stg === 3) tr.got++;
        else if (tr.skill === 'lastStand' && res === 'hit') tr.got++;
        else if (tr.skill === 'ipman' && res === 'hit' && attacker.state === 'ult') tr.got++;
        if (!tr.done && tr.got >= tr.need) {
          tr.done = true;
          this.onEvent('trainingDone', { skill: tr.skill });
        }
      }
    },

    onMeterGain: function (f, v) { f.onMeterGain(v, this); },

    spawnProjectile: function (owner, cfg) {
      this.projectiles.push({
        x: cfg.x, y: cfg.y, vx: cfg.vx, r: cfg.r || 14,
        dmg: cfg.dmg, owner: owner, life: 2.2, type: cfg.type || 'fire'
      });
    },

    updateProjectiles: function (dt) {
      for (var i = this.projectiles.length - 1; i >= 0; i--) {
        var p = this.projectiles[i];
        p.x += p.vx * dt;
        p.y += (p.vy || 0) * dt;
        p.life -= dt;
        // 纯视觉弹（弹雨风暴）：不参与判定
        if (p.noHit) {
          if (p.life <= 0 || p.y > 760) this.projectiles.splice(i, 1);
          continue;
        }
        var target = p.owner === this.p1 ? this.p2 : this.p1;
        var hurt = target.hurtbox();
        var px = Math.max(hurt.x, Math.min(p.x, hurt.x + hurt.w));
        var py = Math.max(hurt.y, Math.min(p.y, hurt.y + hurt.h));
        if ((px - p.x) * (px - p.x) + (py - p.y) * (py - p.y) <= p.r * p.r && target.state !== 'ko') {
          this.onHit(p.owner, target, {
            dmg: p.dmg, kb: 300, hitstun: 0.42, launch: -260,
            heavy: true, hitSfx: 'hitHeavy', isUlt: true
          });
          this.spawnHitSparks(p.x, p.y, 14, true);
          this.projectiles.splice(i, 1);
          continue;
        }
        if (p.life <= 0 || p.x < 0 || p.x > W || p.y > H + 30) this.projectiles.splice(i, 1);
      }
    },

    // 灵宠替主人挡投射物
    interceptPet: function (pet, owner) {
      for (var i = this.projectiles.length - 1; i >= 0; i--) {
        var p = this.projectiles[i];
        if (p.noHit || p.owner === owner) continue;
        var dx = p.x - pet.x, dy = p.y - (pet.y - 40);
        if (dx * dx + dy * dy < 45 * 45) {
          pet.hp -= p.dmg;
          pet.hurtT = 0.4;
          this.projectiles.splice(i, 1);
          this.spawnHitSparks(pet.x, pet.y - 30, 6, false, '#fff');
          break;
        }
      }
    },

    // ---------- 特效 ----------
    fx: function (type, f) {
      switch (type) {
        case 'weaponfx': {
          // 武器气浪：按武器类型生成剑气/刀气/枪芒
          var wid = f.custom.weapon, stg = (f.atk && f.atk.stage) || 1;
          var hx = f.x + f.facing * 42, hy = f.y - 92;
          var col = { sword: '#bfe3ff', hammer: '#ffd34d', spear: '#ffb3c8',
                      staff: '#ffb347', nunchaku: '#e6e6ff', fist: '#ffffff' }[wid] || '#ffffff';
          var mul = stg >= 3 ? 1.45 : stg === 2 ? 1.15 : 0.9;
          var ang = f.facing > 0 ? -0.4 : Math.PI + 0.4;
          if (wid === 'spear') {
            this.slashes.push({ type: 'streak', x: hx, y: hy, ang: f.facing > 0 ? 0 : Math.PI,
              len: 130 * mul, life: 0.2, max: 0.2, color: col });
          } else if (wid === 'sword' || wid === 'hammer' || wid === 'staff') {
            this.slashes.push({ type: 'arc', x: hx, y: hy - 4, ang: ang,
              r: 46 * mul, life: 0.22, max: 0.22, color: col });
          } else if (wid === 'nunchaku') {
            this.slashes.push({ type: 'arc', x: hx, y: hy + 6, ang: f.facing > 0 ? -0.9 : Math.PI + 0.9,
              r: 34 * mul, life: 0.18, max: 0.18, color: col });
          } else if (stg >= 2) {
            this.spawnHitSparks(hx, hy, stg >= 3 ? 9 : 5, stg >= 3, '#ffffff');
          }
          break;
        }
        case 'afterimage':
          this.afterimages.push({ x: f.x, y: f.y, facing: f.facing, custom: f.custom, life: 0.3, params: f.poseInfo() });
          break;
        case 'blockspark':
          this.spawnHitSparks(f.x + f.facing * 26, f.y - 100, 6, false, '#9ad6ff');
          break;
        case 'ultready':
          for (var i = 0; i < 14; i++) {
            this.particles.push({
              x: f.x + (Math.random() - 0.5) * 60, y: f.y - Math.random() * 150,
              vx: (Math.random() - 0.5) * 60, vy: -120 - Math.random() * 120,
              life: 0.7, color: '#ffd34d', size: 3 + Math.random() * 3, grav: 0
            });
          }
          break;
        case 'ultstart':
          this.flash = 0.85;
          this.hitstop = 0.32;
          break;
        case 'shockwave':
          for (var j = 0; j < 12; j++) {
            this.particles.push({
              x: f.x, y: this.floorY - Math.random() * 60,
              vx: (j - 6) * 60, vy: -Math.random() * 200,
              life: 0.5, color: '#bcd0ff', size: 4, grav: 900
            });
          }
          break;
        case 'quake':
          for (var k = 0; k < 26; k++) {
            this.particles.push({
              x: f.x + (Math.random() - 0.5) * 500, y: this.floorY,
              vx: (Math.random() - 0.5) * 200, vy: -200 - Math.random() * 400,
              life: 0.8, color: '#c8a05a', size: 4 + Math.random() * 5, grav: 1400
            });
          }
          break;
      }
    },

    spawnHitSparks: function (x, y, n, big, color) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, sp = (big ? 220 : 130) * (0.4 + Math.random());
        this.particles.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
          life: 0.35 + Math.random() * 0.25, color: color || (big ? '#ffb347' : '#ffe08a'),
          size: big ? 3 + Math.random() * 4 : 2 + Math.random() * 3, grav: 700
        });
      }
    },

    updateFx: function (dt) {
      for (var i = this.particles.length - 1; i >= 0; i--) {
        var p = this.particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.grav) p.vy += p.grav * dt;
        p.life -= dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
      // 剑气/刀气弧光衰减
      for (var s2 = this.slashes.length - 1; s2 >= 0; s2--) {
        var sl = this.slashes[s2];
        sl.life -= dt;
        sl.r += 170 * dt;
        if (sl.life <= 0) this.slashes.splice(s2, 1);
      }
      for (var j = this.dmgNums.length - 1; j >= 0; j--) {
        var d = this.dmgNums[j];
        d.y -= 60 * dt; d.life -= dt;
        if (d.life <= 0) this.dmgNums.splice(j, 1);
      }
      for (var k = this.afterimages.length - 1; k >= 0; k--) {
        this.afterimages[k].life -= dt;
        if (this.afterimages[k].life <= 0) this.afterimages.splice(k, 1);
      }
    },

    updateAmbient: function (dt) {
      var kind = this.stage.deco;
      if ((kind === 'snow' || kind === 'volcano' || kind === 'bamboo' || kind === 'castle') &&
          this.ambient.length < 60 && Math.random() < 0.5) {
        if (kind === 'snow') this.ambient.push({ x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 40, life: 20, c: '#ffffff', s: 2 + Math.random() * 3 });
        if (kind === 'volcano') this.ambient.push({ x: Math.random() * W, y: H + 10, vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 60, life: 20, c: '#ff7030', s: 2 + Math.random() * 2 });
        if (kind === 'bamboo') this.ambient.push({ x: Math.random() * W, y: -10, vx: -20 - Math.random() * 30, vy: 30 + Math.random() * 20, life: 20, c: '#7aa86a', s: 3 });
        if (kind === 'castle') this.ambient.push({ x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 20, vy: 25 + Math.random() * 25, life: 20, c: '#9a7ae0', s: 2 });
      }
      for (var i = this.ambient.length - 1; i >= 0; i--) {
        var a = this.ambient[i];
        a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt;
        if (a.y > H + 20 || a.y < -30 || a.x < -20 || a.x > W + 20 || a.life <= 0) this.ambient.splice(i, 1);
      }
      if (kind === 'castle') {
        this.lightning -= dt;
        if (this.lightning < -6 && Math.random() < 0.01) this.lightning = 0.25;
      }
    },

    shake: function (amp, dur) {
      if (amp >= this.shakeAmp || this.shakeT <= 0) { this.shakeAmp = amp; this.shakeT = dur; }
    },
    banner: function (text) { this.banner_ = { text: text, t: 0 }; },
    setAnnounce: function (text, dur) { this.announce_ = { text: text, t: 0, dur: dur }; },
    sfx: function (name) { if (SG.Audio) SG.Audio.sfx(name); },

    // ================= 渲染 =================
    draw: function (ctx) {
      var sx = 0, sy = 0;
      if (this.shakeT > 0) {
        sx = (Math.random() - 0.5) * 2 * this.shakeAmp;
        sy = (Math.random() - 0.5) * 2 * this.shakeAmp;
      }
      ctx.save();
      ctx.translate(sx, sy);
      this.drawStage(ctx);
      this.drawAfterimages(ctx);
      // 角色（后画的在前）
      var order = this.p1.y <= this.p2.y ? [this.p1, this.p2] : [this.p2, this.p1];
      order.forEach(function (f) { f.draw(ctx, this); }, this);
      this.drawProjectiles(ctx);
      this.drawSlashes(ctx);
      this.drawParticles(ctx);
      // 灵宠
      try {
        if (this.petP1 && this.petP1.hp > 0) this.petP1.draw(ctx);
        if (this.petP2 && this.petP2.hp > 0) this.petP2.draw(ctx);
      } catch (e) {}
      this.drawDamageNums(ctx);
      ctx.restore();
      this.drawHUD(ctx);
      if (this.flash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.85, this.flash) + ')';
        ctx.fillRect(0, 0, W, H);
      }
      this.drawBanner(ctx);
      this.drawAnnounce(ctx);
    },

    drawStage: function (ctx) {
      var st = this.stage, rnd = this.stageSeed;
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, st.sky[0]); g.addColorStop(1, st.sky[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      ctx.save();
      switch (st.deco) {
        case 'dojo':
          ctx.fillStyle = 'rgba(120,85,50,0.5)';
          for (var i = 0; i < 13; i++) ctx.fillRect(i * 100, 60, 90, FLOOR - 60);
          ctx.fillStyle = 'rgba(240,220,150,0.9)';
          ctx.beginPath(); ctx.arc(640, 150, 80, 0, 7); ctx.fill();
          ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 8;
          ctx.beginPath(); ctx.arc(640, 150, 80, 0, 7); ctx.stroke();
          for (var j = 0; j < 4; j++) {
            var lx = 160 + j * 320;
            ctx.fillStyle = '#d84848';
            ctx.beginPath(); ctx.ellipse(lx, 130, 16, 24, 0, 0, 7); ctx.fill();
            ctx.fillStyle = 'rgba(255,220,120,0.25)';
            ctx.beginPath(); ctx.arc(lx, 135, 42, 0, 7); ctx.fill();
          }
          break;
        case 'bamboo':
          this.bamboos.forEach(function (b) {
            ctx.fillStyle = 'rgba(' + (40 + b.shade * 30 | 0) + ',' + (120 + b.shade * 40 | 0) + ',70,0.75)';
            ctx.fillRect(b.x, 0, b.w, FLOOR);
          });
          break;
        case 'desert':
          ctx.fillStyle = 'rgba(255,240,200,0.85)';
          ctx.beginPath(); ctx.arc(1020, 130, 60, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(120,80,40,0.5)';
          ctx.beginPath(); ctx.moveTo(200, FLOOR); ctx.lineTo(400, 240); ctx.lineTo(600, FLOOR); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(160,110,60,0.45)';
          ctx.beginPath(); ctx.arc(950, FLOOR + 80, 260, Math.PI, 0); ctx.fill();
          ctx.beginPath(); ctx.arc(400, FLOOR + 140, 340, Math.PI, 0); ctx.fill();
          break;
        case 'snow':
          ctx.fillStyle = 'rgba(220,235,250,0.9)';
          ctx.beginPath(); ctx.moveTo(-100, FLOOR); ctx.lineTo(260, 170); ctx.lineTo(620, FLOOR); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(500, FLOOR); ctx.lineTo(900, 230); ctx.lineTo(1300, FLOOR); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.beginPath(); ctx.moveTo(190, 260); ctx.lineTo(260, 170); ctx.lineTo(330, 260); ctx.closePath(); ctx.fill();
          break;
        case 'volcano':
          ctx.fillStyle = 'rgba(60,20,15,0.9)';
          ctx.beginPath(); ctx.moveTo(600, FLOOR); ctx.lineTo(850, 130); ctx.lineTo(1100, FLOOR); ctx.closePath(); ctx.fill();
          var lg = ctx.createLinearGradient(0, FLOOR - 160, 0, FLOOR);
          lg.addColorStop(0, 'rgba(255,90,20,0)'); lg.addColorStop(1, 'rgba(255,110,30,0.55)');
          ctx.fillStyle = lg; ctx.fillRect(0, FLOOR - 160, W, 160);
          ctx.fillStyle = '#ff6020';
          ctx.beginPath(); ctx.arc(850, 135, 26, 0, 7); ctx.fill();
          break;
        case 'castle':
          ctx.fillStyle = 'rgba(30,18,60,0.95)';
          [[140, 120], [420, 90], [820, 100], [1100, 130]].forEach(function (t) {
            ctx.fillRect(t[0], FLOOR - 380, 120, 380);
            ctx.beginPath(); ctx.moveTo(t[0] - 12, FLOOR - 380);
            ctx.lineTo(t[0] + 60, FLOOR - 380 - t[1]); ctx.lineTo(t[0] + 132, FLOOR - 380);
            ctx.closePath(); ctx.fill();
          });
          if (this.lightning > 0) {
            ctx.fillStyle = 'rgba(220,200,255,' + this.lightning + ')';
            ctx.fillRect(0, 0, W, H);
          }
          break;
      }
      ctx.restore();

      // 地面
      ctx.fillStyle = st.ground; ctx.fillRect(0, FLOOR, W, H - FLOOR);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, FLOOR); ctx.lineTo(W, FLOOR); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (var s = 0; s < 16; s++) ctx.fillRect(s * 84 + 10, FLOOR + 30, 50, 6);

      // 环境粒子
      this.ambient.forEach(function (a) {
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = a.c;
        ctx.fillRect(a.x, a.y, a.s, a.s);
        ctx.globalAlpha = 1;
      });
    },

    drawAfterimages: function (ctx) {
      this.afterimages.forEach(function (a) {
        var pose = a.params ? SG.Stick.getPose(a.params.pose, a.params.t || 0) : SG.Stick.getPose('idle');
        SG.Stick.draw(ctx, { x: a.x, y: a.y, facing: a.facing, params: pose, custom: a.custom,
          alpha: a.life * 1.6, t: 0 });
      });
    },

    drawProjectiles: function (ctx) {
      this.projectiles.forEach(function (p) {
        // 弹道类：箭矢 / 子弹 / 狙击弹（按速度方向绘制）
        if (p.type === 'arrow' || p.type === 'bullet' || p.type === 'sniper') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.vy || 0, p.vx));
          if (p.type === 'arrow') {
            ctx.strokeStyle = '#d8c49a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(8, 0); ctx.stroke();
            ctx.fillStyle = '#e8e8e8';
            ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(7, -4); ctx.lineTo(7, 4); ctx.closePath(); ctx.fill();
          } else if (p.type === 'sniper') {
            var sg3 = ctx.createLinearGradient(-110, 0, 30, 0);
            sg3.addColorStop(0, 'rgba(255,120,80,0)');
            sg3.addColorStop(1, 'rgba(255,120,80,.95)');
            ctx.strokeStyle = sg3; ctx.lineWidth = 5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(-110, 0); ctx.lineTo(30, 0); ctx.stroke();
          } else {
            ctx.fillStyle = '#ffd34d';
            ctx.beginPath(); ctx.ellipse(-7, 0, 13, 2.6, 0, 0, 7); ctx.fill();
          }
          ctx.restore();
          return;
        }
        var r = p.r + Math.sin(this.time * 20) * 2;
        var g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r * 2);
        g.addColorStop(0, 'rgba(255,220,120,0.95)');
        g.addColorStop(0.5, 'rgba(255,120,40,0.75)');
        g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 2, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff0c0';
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.5, 0, 7); ctx.fill();
      }, this);
    },

    drawParticles: function (ctx) {
      this.particles.forEach(function (p) {
        ctx.globalAlpha = Math.min(1, p.life * 3);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.globalAlpha = 1;
      });
    },

    drawSlashes: function (ctx) {
      this.slashes.forEach(function (sl) {
        var t2 = Math.max(0, sl.life / sl.max);
        ctx.save();
        ctx.translate(sl.x, sl.y);
        ctx.rotate(sl.ang);
        ctx.globalAlpha = Math.max(0, t2);
        if (sl.type === 'streak') {
          var g2 = ctx.createLinearGradient(0, 0, sl.len, 0);
          g2.addColorStop(0, 'rgba(255,255,255,0)');
          g2.addColorStop(0.55, sl.color);
          g2.addColorStop(1, 'rgba(255,255,255,0.95)');
          ctx.strokeStyle = g2;
          ctx.lineWidth = 6 * t2 + 1; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(sl.len * 0.12, 0); ctx.lineTo(sl.len, 0); ctx.stroke();
        } else {
          ctx.strokeStyle = sl.color;
          ctx.lineWidth = 7 * t2 + 1; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(0, 0, sl.r, -1.15, 1.15); ctx.stroke();
          ctx.globalAlpha = Math.max(0, t2 * 0.45);
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, sl.r + 11, -0.85, 0.85); ctx.stroke();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      });
    },

    drawDamageNums: function (ctx) {
      ctx.textAlign = 'center';
      this.dmgNums.forEach(function (d) {
        ctx.globalAlpha = Math.min(1, d.life * 2);
        ctx.font = (d.crit ? 'bold 30px' : 'bold 22px') + ' system-ui, sans-serif';
        ctx.fillStyle = d.crit ? '#ff7043' : '#ffe08a';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4;
        ctx.strokeText(d.val, d.x, d.y);
        ctx.fillText(d.val, d.x, d.y);
        ctx.globalAlpha = 1;
      });
      ctx.textAlign = 'left';
    },

    drawHUD: function (ctx) {
      var self = this;
      // 大招演示模式：极简 HUD
      if (this.demoLoop) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.fillText('🎯 大招演示 · ' + this.p1.name + ' · ' + this.p1.weapon.ult.name, W / 2, 42);
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.fillText('点右上「✕」返回编辑', W / 2, 66);
        ctx.textAlign = 'left';
        return;
      }
      function side(f, x, dir, color) {
        var bw = 430, bh = 22;
        var bx = dir > 0 ? x : x - bw;
        // 名字
        ctx.font = 'bold 17px system-ui, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = dir > 0 ? 'left' : 'right';
        var tag = (f === self.p1 && self.p1.ctrl !== 'human') ? ' 🤖托管' : '';
        ctx.fillText((f.isBoss ? '👑 BOSS · ' : '') + f.name + tag, dir > 0 ? bx : bx + bw, 38);
        // HP
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(bx, 46, bw, bh);
        var pct = Math.max(0, f.hp / f.maxHp);
        var hw = bw * pct;
        var hg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        hg.addColorStop(0, '#ffd24d'); hg.addColorStop(1, '#ff9040');
        ctx.fillStyle = f.isBoss ? '#e04545' : hg;
        ctx.fillRect(dir > 0 ? bx : bx + bw - hw, 46, hw, bh);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
        ctx.strokeRect(bx, 46, bw, bh);
        // 血量数字
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(Math.ceil(f.hp) + ' / ' + f.maxHp, dir > 0 ? bx + 6 : bx + bw - 6, 62);
        // 蓄力条
        var my = 74, mw = bw * 0.72;
        var mx = dir > 0 ? bx : bx + bw - mw;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(mx, my, mw, 10);
        var mpct = f.meter / 100;
        ctx.fillStyle = mpct >= 1 ? (Math.sin(self.time * 10) > 0 ? '#fff4a0' : '#ffd34d') : '#7fb8ff';
        ctx.fillRect(dir > 0 ? mx : mx + mw - mw * mpct, my, mw * mpct, 10);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
        ctx.strokeRect(mx, my, mw, 10);
        if (mpct >= 1) {
          ctx.font = 'bold 13px system-ui, sans-serif';
          ctx.fillStyle = '#ffd34d';
          ctx.textAlign = dir > 0 ? 'left' : 'right';
          ctx.fillText('✦ 大招就绪 ' + f.weapon.ult.name, dir > 0 ? mx + mw + 8 : mx - 8, my + 10);
        }
        // 回合星
        for (var i = 0; i < self.roundsToWin; i++) {
          var px = dir > 0 ? bx + i * 26 + 8 : bx + bw - i * 26 - 8;
          ctx.beginPath(); ctx.arc(px, 104, 7, 0, 7);
          ctx.fillStyle = i < f.roundsWon ? '#ffd34d' : 'rgba(255,255,255,0.2)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
        }
        ctx.textAlign = 'left';
      }
      side(this.p1, 40, 1);
      side(this.p2, W - 40, -1);

      // 中央计时器 + 回合
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(W / 2 - 64, 18, 128, 66);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
      ctx.strokeRect(W / 2 - 64, 18, 128, 66);
      var tsec = Math.ceil(this.timer);
      ctx.font = 'bold 40px system-ui, sans-serif';
      ctx.fillStyle = tsec <= 10 ? '#ff7043' : '#fff';
      ctx.fillText(tsec, W / 2, 60);
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = '#9fb0d8';
      ctx.fillText(this.mode === 'story' ? '第 ' + this.round + ' 战' : 'Round ' + this.round + ' · Bo' + (this.roundsToWin * 2 - 1), W / 2, 76);

      // 连击
      var c1 = this.combo.p1, c2 = this.combo.p2;
      ctx.font = 'bold 30px system-ui, sans-serif';
      if (c1 >= 2) {
        ctx.fillStyle = '#8fe08f'; ctx.textAlign = 'left';
        ctx.fillText(c1 + ' 连击!', 60, 180 + Math.sin(this.time * 14) * 3);
      }
      if (c2 >= 2) {
        ctx.fillStyle = '#8fe08f'; ctx.textAlign = 'right';
        ctx.fillText(c2 + ' 连击!', W - 60, 180 + Math.sin(this.time * 14) * 3);
      }
      ctx.textAlign = 'left';

      // 修炼模式：道场指引横幅
      if (this.mode === 'training' && this.training) {
        ctx.fillStyle = 'rgba(10,12,24,.8)';
        ctx.fillRect(W / 2 - 270, 96, 540, 62);
        ctx.strokeStyle = 'rgba(255,217,122,.55)'; ctx.lineWidth = 2;
        ctx.strokeRect(W / 2 - 270, 96, 540, 62);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd97a'; ctx.font = 'bold 17px system-ui, sans-serif';
        ctx.fillText('🧘 ' + this.training.label, W / 2, 122);
        ctx.fillStyle = '#8fe08f'; ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillText('进度 ' + this.training.got + ' / ' + this.training.need, W / 2, 148);
        ctx.textAlign = 'left';
      }

      // 大招就绪提示气泡（角色头顶，醒目浮动）
      var self2 = this;
      [[this.p1, 'U / 必'], [this.p2, '回车 / U']].forEach(function (pair) {
        var f = pair[0];
        if (f.meter >= 100 && f.state !== 'ult' && f.state !== 'ko') {
          var bob = Math.sin(self2.time * 5) * 5;
          var bx = f.x, by = f.y - 200 + bob;
          var keyHint = self2.mode === 'story' || f === self2.p1 ? '按 U' : (f.ctrl === 'human' ? '按回车' : 'U / 必');
          ctx.save();
          ctx.translate(bx, by);
          var pul = 0.85 + Math.sin(self2.time * 9) * 0.15;
          ctx.scale(pul, pul);
          ctx.fillStyle = 'rgba(20,24,44,.88)';
          ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.5;
          ctx.beginPath();
          var w2 = 132, h2 = 44, r2 = 10;
          ctx.moveTo(-w2 / 2 + r2, -h2 / 2);
          ctx.arcTo(w2 / 2, -h2 / 2, w2 / 2, h2 / 2, r2);
          ctx.arcTo(w2 / 2, h2 / 2, -w2 / 2, h2 / 2, r2);
          ctx.arcTo(-w2 / 2, h2 / 2, -w2 / 2, -h2 / 2, r2);
          ctx.arcTo(-w2 / 2, -h2 / 2, w2 / 2, -h2 / 2, r2);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          // 小尾巴
          ctx.beginPath(); ctx.moveTo(-6, h2 / 2 - 1); ctx.lineTo(0, h2 / 2 + 9); ctx.lineTo(6, h2 / 2 - 1);
          ctx.fillStyle = 'rgba(20,24,44,.88)'; ctx.fill();
          ctx.fillStyle = '#ffd34d'; ctx.font = 'bold 15px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('⚡ 大招就绪!', 0, -6);
          ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui';
          ctx.fillText(keyHint + ' 释放', 0, 13);
          ctx.restore();
        }
      });
    },

    drawBanner: function (ctx) {
      if (!this.banner_) return;
      var b = this.banner_;
      var a = b.t < 0.15 ? b.t / 0.15 : b.t > 0.9 ? Math.max(0, 1 - (b.t - 0.9) / 0.4) : 1;
      var sc = b.t < 0.2 ? 0.5 + b.t * 2.5 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(W / 2, 300);
      ctx.scale(sc, sc);
      ctx.textAlign = 'center';
      ctx.font = 'bold 58px system-ui, sans-serif';
      ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(120,20,20,0.9)';
      ctx.strokeText(b.text, 0, 0);
      var g = ctx.createLinearGradient(0, -40, 0, 20);
      g.addColorStop(0, '#fff2b0'); g.addColorStop(1, '#ff9040');
      ctx.fillStyle = g;
      ctx.fillText(b.text, 0, 0);
      ctx.restore();
    },

    drawAnnounce: function (ctx) {
      if (!this.announce_) return;
      var a = this.announce_;
      var alpha = a.t < 0.2 ? a.t / 0.2 : a.t > a.dur - 0.4 ? Math.max(0, (a.dur - a.t) / 0.4) : 1;
      var sc = a.t < 0.25 ? 1.6 - a.t * 2.4 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(W / 2, 330);
      ctx.scale(sc, sc);
      ctx.textAlign = 'center';
      ctx.font = 'bold 74px system-ui, sans-serif';
      ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(a.text, 0, 0);
      ctx.fillStyle = '#fff';
      ctx.fillText(a.text, 0, 0);
      ctx.restore();
    }
  };

  SG.Battle = Battle;
})(typeof window !== 'undefined' ? window : globalThis);
