/* 格斗角色：物理 / 状态机 / 攻击判定 / 蓄力与武器大招 */
(function (global) {
  'use strict';
  var SG = global.SG = global.SG || {};

  var GRAVITY = 2300, JUMP_VY = -880, BASE_SPEED = 272;
  var HURT_W = 48, HURT_H = 152;

  // 攻击定义（时间会被武器速度缩放）
  // 背水一战伤害倍率（提取为公共函数）
  function lsMul(f) {
    return (SG.game && SG.game.hasSkill && SG.game.hasSkill("lastStand") && f.hp < f.maxHp * 0.35) ? 1.25 : 1;
  }
  var ATK = {
    light: { startup: 0.13, active: 0.10, recover: 0.17, dmg: 6, range: 74, kb: 150, hitstun: 0.28, sfx: 'punch', hitSfx: 'hit' },
    heavy: { startup: 0.24, active: 0.12, recover: 0.30, dmg: 11, range: 90, kb: 360, hitstun: 0.4, launch: -300, sfx: 'punch', hitSfx: 'hitHeavy' }
  };

  function Fighter(custom, opts) {
    opts = opts || {};
    this.custom = custom;
    this.name = custom.name || (opts.isBoss ? 'Boss' : '战士');
    this.isBoss = !!opts.isBoss;
    this.weapon = SG.DATA.weaponById(custom.weapon);
    this.gear = SG.DATA.gearById(custom.gear || 'none');

    var gearHp = this.gear.hp || 0;
    this.maxHp = (opts.hp || 100) + (this.isBoss ? 0 : gearHp);
    this.hp = this.maxHp;

    this.dmgMult = this.weapon.dmg * (this.gear.dmg || 1);
    this.spdMult = this.weapon.spd;
    this.rangeMult = this.weapon.range;
    this.moveSpeed = BASE_SPEED * (this.gear.spd || 1);

    this.x = opts.x || 400; this.y = opts.y || 620;
    this.vx = 0; this.vy = 0;
    this.facing = opts.facing || 1;
    this.onGround = true;
    this.state = 'idle';           // idle walk jump attack block hurt dash charge ult ko victory
    this.stateT = 0;
    this.animT = 0;
    this.meter = 0;
    this.ultReadyNotified = false;

    this.atk = null; this.atkT = 0; this.atkId = 0;
    this.hitDone = false;
    this.hurtT = 0;
    this.dashT = 0; this.dashCd = 0;
    this.ult = null;               // {type, t, phase, hitsDone}
    this.prev = {};                // 上一帧输入（边沿检测）
    this.jumpUsed = false;
    this.chargeTickT = 0;
    this.comboStage = 0; this.comboKind = null; this.lastAtkEnd = -10;
    this.invincible = false;
    this.dead = false;
    this.roundsWon = 0;
    this._autoCd = 0;              // 全自动武器开火冷却
  }

  Fighter.prototype = {
    // ---------- 每帧更新 ----------
    update: function (dt, input, opp, battle) {
      this.animT += dt;
      this.stateT += dt;
      if (this.dashCd > 0) this.dashCd -= dt;

      var p = this.prev || {};
      var pressed = function (k) { return input[k] && !p[k]; };
      if (input.down && !p.down) this.blockPressedAt = this.animT;   // 弹反计时
      // 全自动武器：按住攻击键持续开火
      if (this.weapon.ranged && this.weapon.ranged.auto &&
          (input.punch || input.kick) && this.canAct() && this._autoCd <= 0) {
        this.startAttack(input.kick ? 'heavy' : 'light');
        this._autoCd = 0.03;
      }
      var grounded = this.onGround;

      // ---- 终局状态 ----
      if (this.state === 'ko') {
        this.physics(dt, battle);
        this.prev = input;
        return;
      }
      if (this.state === 'victory' || this.state === 'dead') {
        this.physics(dt, battle);
        this.prev = input;
        return;
      }

      // ---- 大招演出中 ----
      if (this.state === 'ult') { this.updateUlt(dt, opp, battle); this.prev = input; return; }

      // ---- 硬直 ----
      if (this.state === 'hurt') {
        this.hurtT -= dt;
        this.physics(dt, battle);
        if (this.hurtT <= 0 && this.onGround) this.setIdle();
        this.prev = input;
        return;
      }

      // ---- 大招释放 ----
      if (pressed('ult') && this.meter >= 100 && grounded && this.canAct()) {
        this.startUlt(opp, battle);
        this.prev = input; return;
      }

      // ---- 攻击中 ----
      if (this.state === 'attack') {
        this.updateAttack(dt, opp, battle);
        this.physics(dt, battle);
        this.prev = input;
        return;
      }

      // ---- 蓄力 ----
      if (this.state === 'charge') {
        if (!input.charge || !grounded) { this.setIdle(); }
        else {
          this.meter = Math.min(100, this.meter + 30 * dt);
          this.chargeTickT -= dt;
          if (this.chargeTickT <= 0) { battle.sfx('chargeTick'); this.chargeTickT = 0.16; }
          this.vx *= 0.8;
          this.physics(dt, battle);
          this.checkMeter(battle);
          this.prev = input; return;
        }
      }

      // ---- 蓄力触发 ----
      if (input.charge && grounded && this.canAct()) {
        this.state = 'charge'; this.stateT = 0; this.chargeTickT = 0;
        this.vx *= 0.5;
        this.physics(dt, battle);
        this.prev = input; return;
      }

      // ---- 防守 ----
      if (input.down && grounded && this.canAct()) {
        this.state = 'block';
        this.vx *= 0.6;
        this.physics(dt, battle);
        this.prev = input; return;
      } else if (this.state === 'block') this.setIdle();

      // ---- 冲刺 ----
      if (pressed('dash') && this.dashCd <= 0 && this.canAct()) {
        var dir = input.left ? -1 : input.right ? 1 : this.facing;
        this.state = 'dash'; this.stateT = 0; this.dashT = 0.2; this.dashCd = 0.55;
        this.vx = dir * 700; this.facing = dir;
        battle.sfx('dash');
        battle.fx('afterimage', this);
      }

      if (this.state === 'dash') {
        this.dashT -= dt;
        this.vx *= 0.9;
        this.physics(dt, battle);
        if (this.dashT <= 0) this.setIdle();
        this.prev = input; return;
      }

      // ---- 攻击触发 ----
      if (this.canAct() || (!grounded && this.state === 'jump')) {
        if (pressed('punch') || pressed('kick')) {
          var kind = pressed('punch') ? 'light' : 'heavy';
          this.startAttack(kind);
          this.physics(dt, battle);
          this.prev = input; return;
        }
      }

      // ---- 跳跃 ----
      if (pressed('up') && grounded && this.canAct()) {
        this.vy = JUMP_VY; this.onGround = false; this.jumpUsed = true;
        battle.sfx('jump');
      }

      // ---- 移动 ----
      var move = 0;
      if (input.left) move -= 1;
      if (input.right) move += 1;
      if (this.state !== 'attack' || !this.onGround) {
        if (grounded) {
          this.vx += (move * this.moveSpeed - this.vx) * Math.min(1, dt * 14);
          this.state = move !== 0 ? 'walk' : 'idle';
        } else {
          this.vx += move * this.moveSpeed * dt * 4;
          this.vx = Math.max(-this.moveSpeed * 1.2, Math.min(this.moveSpeed * 1.2, this.vx));
          this.state = 'jump';
        }
        if (move !== 0 && grounded) this.facing = move;
      }

      // 自动面向对手
      if (grounded && (this.state === 'idle' || this.state === 'walk') && opp) {
        this.facing = opp.x > this.x ? 1 : -1;
      }

      this.physics(dt, battle);
      this.prev = input;
    },

    canAct: function () {
      return this.state === 'idle' || this.state === 'walk' || this.state === 'block' ||
             this.state === 'charge' || this.state === 'jump';
    },

    setIdle: function () { this.state = this.onGround ? 'idle' : 'jump'; this.stateT = 0; },

    physics: function (dt, battle) {
      // 重力
      if (!this.onGround) {
        this.vy += GRAVITY * dt;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      var floor = battle ? battle.floorY : 620;
      if (this.y >= floor) {
        if (!this.onGround) {
          if (this.state !== 'ko') battle.sfx('land');
        }
        this.y = floor; this.vy = 0;
        if (!this.onGround) { this.onGround = true; this.jumpUsed = false; }
        if (this.state === 'ko') { this.vx *= 0.86; if (Math.abs(this.vx) < 4) this.vx = 0; }
      } else {
        this.onGround = false;
      }
      // 场地边界
      if (battle) {
        var L = battle.minX + 30, R = battle.maxX - 30;
        if (this.x < L) { this.x = L; this.vx = Math.max(0, this.vx); }
        if (this.x > R) { this.x = R; this.vx = Math.min(0, this.vx); }
      }
      // 空中缓慢衰减
      if (this.onGround && (this.state === 'idle' || this.state === 'walk')) {
        this.vx *= Math.pow(0.0001, dt);
      }
    },

    // ---------- 攻击 ----------
    startAttack: function (kind) {
      var def = ATK[kind];
      // 武学门槛：第三段连招需在修炼模式中习得（道场修炼时临时解禁试用）
      var g = SG.game;
      var maxStage = 2;
      var allowC3 = !g || (g.hasSkill && g.hasSkill('chain3')) || this._allowChain3;
      var allowK3 = !g || (g.hasSkill && g.hasSkill('kick3')) || this._allowKick3;
      if (kind === 'light' && allowC3) maxStage = 3;
      if (kind === 'heavy' && allowK3) maxStage = 3;
      // 连招判定：同类攻击且距上次收招不超过 0.42s → 衔接下一段
      var chain = this.comboKind === kind && (this.animT - this.lastAtkEnd < 0.42) && this.comboStage < maxStage;
      this.comboStage = chain ? this.comboStage + 1 : 1;
      this.comboKind = kind;
      var stage = this.comboStage;
      this.state = 'attack'; this.stateT = 0;
      this.atk = { kind: kind, def: def, id: ++this.atkId, stage: stage };
      this.atkT = 0; this.hitDone = false;
      var s = this.spdMult;
      this.atk.timing = { startup: def.startup / s, active: def.active / s, recover: def.recover / s };
      // 全自动武器（加特林/冲锋枪）：按住持续速射
      if (this.weapon.ranged && this.weapon.ranged.auto) {
        this.atk.timing = { startup: 0.06, active: 0.05, recover: 0.05 };
      }
      // 段位加成：段2 伤害×1.15；段3 伤害×1.45、击退×2.2、主动前冲追击
      // 连招段1/2 击退减小（锁住对手保持连击距离），终结段大击退打飞
      this.atk.dmgMul = stage >= 3 ? 1.45 : stage === 2 ? 1.15 : 1;
      this.atk.kbMul = stage >= 3 ? 2.2 : stage === 2 ? 0.25 : 0.5;
      this.atk.lunge = stage >= 2 ? 1 : 0;
      this.sfxPlayed = false;
    },

    updateAttack: function (dt, opp, battle) {
      var a = this.atk, tm = a.timing;
      this.atkT += dt;
      var total = tm.startup + tm.active + tm.recover;

      if (this.atkT >= tm.startup && this.atkT < tm.startup + tm.active) {
        if (!this.sfxPlayed) {
          // 远程武器：发射子弹/箭矢（重击 = 强化弹）
          if (this.weapon.ranged) {
            var rd = this.weapon.ranged, hv = a.kind === 'heavy';
            battle.sfx(hv ? 'shotBig' : 'shot');
            battle.spawnProjectile(this, {
              x: this.x + this.facing * 46, y: this.y - 95,
              vx: this.facing * rd.projSpd,
              dmg: rd.dmg * (hv ? 1.7 : 1) * this.dmgMult * lsMul(this),
              r: rd.kind === 'sniper' ? 9 : 5, type: rd.kind
            });
          } else {
            battle.sfx(a.def.sfx);
            battle.fx('weaponfx', this);
          }
          this.sfxPlayed = true;
        }
        // 近战武器：连招段2/3 前冲 + 命中判定
        if (!this.weapon.ranged) {
          if (a.lunge) this.x += this.facing * 900 * dt;
          if (!this.hitDone) {
            var hb = this.attackHitbox();
            var hurt = opp.hurtbox();
            if (hb.x < hurt.x + hurt.w && hb.x + hb.w > hurt.x &&
                hb.y < hurt.y + hurt.h && hb.y + hb.h > hurt.y) {
              this.hitDone = true;
              var lsM = lsMul(this);
              battle.onHit(this, opp, {
                dmg: a.def.dmg * this.dmgMult * (a.dmgMul || 1) * lsM,
                kb: a.def.kb * (a.kbMul || 1), hitstun: a.def.hitstun,
                launch: a.def.launch || 0,
                heavy: a.kind === 'heavy', hitSfx: a.def.hitSfx
              });
            }
          }
        }
      }
      if (this.atkT >= total) {
        this.lastAtkEnd = this.animT;
        this.setIdle();
        this.atk = null;
      }
    },

    attackHitbox: function () {
      var a = this.atk, d = a.def;
      var reach = d.range * this.rangeMult;
      var air = !this.onGround;
      return {
        x: this.facing > 0 ? this.x + 10 : this.x - 10 - reach,
        y: this.y - (air ? 90 : 120) - (a.kind === 'heavy' ? -30 : 0),
        w: reach, h: a.kind === 'heavy' ? 90 : 70
      };
    },

    hurtbox: function () {
      return { x: this.x - HURT_W / 2, y: this.y - HURT_H, w: HURT_W, h: HURT_H };
    },

    // ---------- 受击 ----------
    takeHit: function (info, battle) {
      if (this.state === 'ko' || this.invincible) return false;
      // 面向攻击者才算格挡
      var blocking = this.state === 'block' && this.onGround &&
        Math.sign(info.fromX - this.x) === this.facing;
      // 弹反（需习得「攻防转换」）：举格挡 0.22 秒内被命中 → 弹反成功
      if (blocking && SG.game && SG.game.hasSkill && SG.game.hasSkill('parry') &&
          this.animT - (this.blockPressedAt || -9) < 0.22) {
        this.blockPressedAt = -9;
        return 'parried';
      }

      if (blocking) {
        var chip = info.dmg * 0.15;
        this.hp = Math.max(0, this.hp - chip);
        this.vx = info.kb * 0.3 * info.from;
        battle.sfx('block');
        battle.fx('blockspark', this);
        battle.onMeterGain(this, 3);
        return 'blocked';
      }
      this.hp = Math.max(0, this.hp - info.dmg);
      this.state = 'hurt'; this.stateT = 0;
      this.hurtT = info.hitstun;
      this.vx = info.kb * info.from;
      if (info.launch) { this.vy = info.launch; this.onGround = false; }
      if (this.state !== 'hurt') {}
      this.atk = null;
      if (this.hp <= 0) {
        this.state = 'ko'; this.stateT = 0;
        this.vx = info.kb * 1.4 * info.from;
        this.vy = -420; this.onGround = false;
        this.eye = 'ko';
        battle.sfx('ko');
        return 'ko';
      }
      battle.sfx(info.hitSfx);
      battle.onMeterGain(this, 6);
      return 'hit';
    },

    // ---------- 蓄力 / 大招 ----------
    checkMeter: function (battle) {
      if (this.meter >= 100 && !this.ultReadyNotified) {
        this.ultReadyNotified = true;
        battle.sfx('ultReady');
        battle.fx('ultready', this);
      }
    },

    startUlt: function (opp, battle) {
      this.meter = 0;
      this.ultReadyNotified = false;
      this.state = 'ult'; this.stateT = 0;
      this.invincible = true;
      // 拳法双奥义：近身自动改用「咏春·日字冲拳」（需修炼解锁；道场中可试用）
      var ut = this.weapon.ult.type, uname = this.weapon.ult.name;
      var g = SG.game;
      var canIpman = this.weapon.id === 'fist' &&
        (!g || !g.hasSkill || g.hasSkill('ipman') || this._allowIpman);
      if (ut === 'upper' && opp && canIpman && Math.abs(opp.x - this.x) < 165) {
        ut = 'ipman';
        uname = '咏春·日字冲拳';
      }
      this.ult = { type: ut, t: 0, hits: 0, done: false, opp: opp, name: uname };
      battle.sfx('ult');
      battle.fx('ultstart', this);   // 白屏闪烁 + 定身
      battle.banner(uname + '！');
      if (this.isBoss) battle.shake(14, 0.5); else battle.shake(10, 0.4);
    },

    updateUlt: function (dt, opp, battle) {
      var u = this.ult;
      u.t += dt;
      var t = u.t;
      // 安全上限：任何大招不超过 3.5 秒（防止无限无敌）
      if (t > 3.5) { this.endUlt(battle); return; }
      // 咏春·日字冲拳：叶问式残影连环快拳
      if (u.type === 'ipman') {
        if (!u.done) {
          u.done = true;
          u.hits = 0;
          this.facing = opp.x >= this.x ? 1 : -1;
          this.x = opp.x - this.facing * 78;
        }
        this._ipT = (this._ipT || 0) + dt;
        if (this._ipT >= 0.14 && u.hits < 8) {
          this._ipT = 0;
          u.hits++;
          this.facing = opp.x >= this.x ? 1 : -1;
          battle.fx('afterimage', this);
          this.tryUltHit(opp, battle, { w: 130, h: 150, dmg: 4.5 * this.dmgMult, once: false, kb: 26, hitSfx: 'punch' });
          battle.sfx('punch');
        }
        if (u.hits >= 8 && this._ipT > 0.2 && !u.knock) {
          u.knock = true;
          this.tryUltHit(opp, battle, { w: 140, h: 160, dmg: 6 * this.dmgMult, once: false, kb: 560, launch: -260, hitSfx: 'hitHeavy' });
          battle.sfx('hitHeavy');
          battle.shake(9, 0.3);
        }
        if (t > 1.75) this.endUlt(battle);
        this.physics(dt, battle);
        return;
      }
      switch (u.type) {
        case 'upper':
          if (t < 0.15) { this.vx = 0; }
          else if (t < 0.55) {
            if (t - dt <= 0.15) {
              this.vy = -760; this.vx = 240 * this.facing; this.onGround = false;
              battle.slashes.push({ type: 'arc', x: this.x, y: this.y - 70, ang: -Math.PI / 2,
                r: 64, life: 0.3, max: 0.3, color: '#bfe3ff' });
            }
            this.tryUltHit(opp, battle, { w: 100, h: 170, dmg: 30 * this.dmgMult, once: true, launch: -520 });
          } else if (t > 1.0) { this.endUlt(battle); }
          break;
        case 'spin':
          if (t > 0.1 && t < 0.75) {
            if (t > 0.12 + u.hits * 0.18) {
              u.hits++;
              this.tryUltHit(opp, battle, { circle: 135, dmg: 12 * this.dmgMult, once: false, kb: 180 });
              battle.sfx('punch');
              battle.slashes.push({ type: 'arc', x: this.x, y: this.y - 80,
                ang: (u.hits * 1.05 + 0.3) * (this.facing > 0 ? 1 : -1) + (this.facing > 0 ? 0 : Math.PI),
                r: 56, life: 0.24, max: 0.24, color: '#bfe3ff' });
            }
            if (t > 0.2 && t - dt <= 0.2) battle.shake(5, 0.15);
          }
          if (t > 1.05) this.endUlt(battle);
          break;
        case 'dash':
          if (t > 0.12 && t < 0.42) {
            this.vx = 950 * this.facing;
            this.tryUltHit(opp, battle, { w: 120, h: 130, dmg: 32 * this.dmgMult, once: true, kb: 460 });
          } else this.vx *= 0.8;
          if (t >= 0.42 && !u.done) {
            u.done = true;
            battle.fx('shockwave', this);
            battle.shake(8, 0.25);
          }
          if (t > 0.9) this.endUlt(battle);
          break;
        case 'quake':
          if (t > 0.3 && !u.done) {
            u.done = true;
            this.vy = 620; // 猛砸落地
            battle.sfx('hitHeavy');
          }
          if (u.done && this.onGround && !u.landed) {
            u.landed = true;
            battle.fx('quake', this);
            battle.shake(16, 0.5);
            this.tryUltHit(opp, battle, { circle: 300, ground: true, dmg: 34 * this.dmgMult, once: true, kb: 380, launch: -380 });
          }
          if (t > 1.1) this.endUlt(battle);
          break;
        case 'fire':
          if (t > 0.35 && !u.done) {
            u.done = true;
            battle.spawnProjectile(this, {
              x: this.x + this.facing * 40, y: this.y - 90,
              vx: 640 * this.facing, dmg: 30 * this.dmgMult, r: 17, type: 'fire'
            });
            battle.sfx('fire');
          }
          if (t > 0.85) this.endUlt(battle);
          break;
        case 'rush':
          if (!u.done) {
            u.done = true;
            // 瞬身到对手背后并面向对手
            var side = opp.x >= this.x ? 1 : -1;
            this.x = opp.x - side * 70;
            this.facing = side;
            battle.fx('afterimage', this);
            battle.sfx('dash');
          }
          if (t > 0.25 && u.hits < 3 && t > 0.25 + u.hits * 0.16) {
            u.hits++;
            this.tryUltHit(opp, battle, { w: 160, h: 170, dmg: 11 * this.dmgMult, once: false, kb: 90 });
            battle.sfx('hit');
            battle.fx('afterimage', this);
          }
          if (u.hits >= 3 && !u.knocked && t > 0.25 + 3 * 0.16) {
            u.knocked = true;
            this.tryUltHit(opp, battle, { w: 160, h: 170, dmg: 0, once: false, kb: 520, launch: -420, noDmg: true });
          }
          if (t > 1.0) this.endUlt(battle);
          break;
        case 'lightning':   // 雷神之锤：引九天之雷轰击对手
          if (t > 0.4 && !u.done) {
            u.done = true;
            var bx = opp.x;
            battle.slashes.push({ type: 'bolt', x: bx, y: 0, life: 0.4, max: 0.4, color: '#9ad6ff' });
            battle.flash = 0.6; battle.shake(14, 0.5);
            battle.sfx('ult');
            if (opp.onGround && Math.abs(opp.x - bx) < 95) {
              this.tryUltHit(opp, battle, { w: 180, h: 260, dmg: 40 * this.dmgMult, once: true, kb: 260, launch: -300 });
            }
          }
          if (t > 1.2) this.endUlt(battle);
          break;
        case 'volley':   // 长弓：穿云箭雨（五连矢）
          u._vT = (u._vT === undefined ? 0.4 : u._vT) - dt;
          if (u._vT <= 0) {
            u._vT = 0.28;
            battle.sfx('arrow');
            battle.spawnProjectile(this, { x: this.x + this.facing * 50, y: this.y - 100,
              vx: this.facing * 1000, dmg: 10 * this.dmgMult, r: 6, type: 'arrow' });
          }
          if (t > 1.6) this.endUlt(battle);
          break;
        case 'gunburst':   // 手枪：三连速射
          if (t > 0.25 + u.hits * 0.28 && u.hits < 3) {
            u.hits++;
            battle.sfx('shotBig');
            battle.spawnProjectile(this, { x: this.x + this.facing * 50, y: this.y - 95,
              vx: this.facing * 1350, dmg: 12 * this.dmgMult, r: 6, type: 'bullet' });
          }
          if (t > 1.3) this.endUlt(battle);
          break;
        case 'spray':   // 冲锋枪：倾泻弹雨
          this._spT = (this._spT || 0) - dt;
          if (t > 0.15 && t < 1.15 && this._spT <= 0) {
            this._spT = 0.1;
            battle.sfx('shot');
            battle.spawnProjectile(this, { x: this.x + this.facing * 50, y: this.y - 95 + (Math.random() - 0.5) * 26,
              vx: this.facing * 1250, dmg: 3.2 * this.dmgMult, r: 4, type: 'bullet' });
          }
          if (t > 1.6) this.endUlt(battle);
          break;
        case 'sniper':   // 狙击枪：瞄准 + 穿透一击
          if (t > 0.6 && !u.done) {
            u.done = true;
            battle.slashes.push({ type: 'streak', x: this.x + this.facing * 46, y: this.y - 95,
              ang: this.facing > 0 ? 0 : Math.PI, len: 1200, life: 0.25, max: 0.25, color: '#ff8a6a' });
            battle.sfx('shotBig'); battle.shake(10, 0.3);
            battle.spawnProjectile(this, { x: this.x + this.facing * 50, y: this.y - 95,
              vx: this.facing * 2200, dmg: 45 * this.dmgMult, r: 9, type: 'sniper' });
          }
          if (t > 1.3) this.endUlt(battle);
          break;
        case 'rain':   // 加特林·弹雨风暴：天降弹雨 3 秒，我方无敌
          if (!u.done) {
            u.done = true;
            u.rainX = opp.x;
            this.invincible = true;
            battle.banner('弹雨风暴！');
          }
          u._vis = (u._vis || 0) - dt;
          if (u._vis <= 0) {
            u._vis = 0.09;
            for (var ri = 0; ri < 2; ri++) {
              battle.projectiles.push({ x: u.rainX + (Math.random() - 0.5) * 520, y: -20,
                vx: 0, vy: 820, dmg: 0, r: 4, type: 'bullet', noHit: true, life: 1.15 });
            }
            battle.sfx('shot');
          }
          u._dmgT = (u._dmgT || 0) - dt;
          if (u._dmgT <= 0) {
            u._dmgT = 0.3;
            if (Math.abs(opp.x - u.rainX) < 260) {
              battle.onHit(this, opp, { dmg: 7 * this.dmgMult, kb: 26, hitstun: 0.1, hitSfx: 'shot', isUlt: true });
            }
          }
          if (t > 3) this.endUlt(battle);
          break;
      }
      this.physics(dt, battle);
    },

    tryUltHit: function (opp, battle, opt) {
      if (!opt.noDmg) {
        var hurt = opp.hurtbox();
        var hit = false;
        if (opt.circle) {
          var cx = this.x, cy = opt.ground ? this.y : this.y - 80;
          var px = Math.max(hurt.x, Math.min(cx, hurt.x + hurt.w));
          var py = Math.max(hurt.y, Math.min(cy, hurt.y + hurt.h));
          hit = (px - cx) * (px - cx) + (py - cy) * (py - cy) <= opt.circle * opt.circle;
          if (opt.ground && !opp.onGround) hit = false;
        } else {
          var hb = { x: this.facing > 0 ? this.x : this.x - opt.w,
                     y: this.y - opt.h, w: opt.w, h: opt.h };
          hit = hb.x < hurt.x + hurt.w && hb.x + hb.w > hurt.x &&
                hb.y < hurt.y + hurt.h && hb.y + hb.h > hurt.y;
        }
        if (!hit) return;
        if (opt.once && this.ultHitDone) return;
        this.ultHitDone = true;
        battle.onHit(this, opp, {
          dmg: opt.dmg, kb: opt.kb || 260, hitstun: 0.5,
          launch: opt.launch || 0, heavy: true, hitSfx: 'hitHeavy', isUlt: true
        });
      } else {
        this.ultHitDone = true;
        battle.onHit(this, opp, { dmg: 0, kb: opt.kb, hitstun: 0.4, launch: opt.launch || 0, hitSfx: 'hit', isUlt: true });
      }
    },

    endUlt: function (battle) {
      this.invincible = false;
      this.ultHitDone = false;
      this.ult = null;
      this.setIdle();
    },

    onMeterGain: function (v, battle) {
      this.meter = Math.min(100, this.meter + v);
      this.checkMeter(battle);
    },

    // ---------- 姿势选择 ----------
    poseInfo: function () {
      var t = this.animT;
      if (this.state === 'ko') return { pose: 'ko' };
      if (this.state === 'victory') return { pose: 'victory', t: t };
      if (this.state === 'hurt') return { pose: 'hurt' };
      if (this.state === 'charge') return { pose: 'charge', t: t };
      if (this.state === 'ult') {
        var u = this.ult;
        if (u && u.type === 'ipman') {
          // 咏春快拳：左右拳交替 + 残影已由特效层生成
          return { pose: (u.hits % 2 ? 'punchB' : 'punchX'), t: 0 };
        }
        if (u && (u.type === 'spin')) return { pose: 'ult', t: t * 3 };
        if (u && u.type === 'fire') return { pose: 'charge', t: t };
        return { pose: 'ult', t: t };
      }
      if (this.state === 'attack' && this.atk) {
        var tm = this.atk.timing, at = this.atkT;
        var heavy = this.atk.kind === 'heavy';
        var stg = this.atk.stage || 1;
        if (at < tm.startup) return { pose: heavy ? 'kickW' : 'punchW', t: 0 };
        if (at < tm.startup + tm.active) {
          var xp = heavy ? 'kickX'
            : stg >= 3 ? 'upper'
            : stg === 2 ? 'punchB'
            : 'punchX';
          return { pose: xp, t: 0 };
        }
        return { pose: heavy ? 'kickX' : 'punchW', t: 0 };
      }
      if (this.state === 'block') return { pose: 'block' };
      if (this.state === 'dash') return { pose: 'fall' };
      if (!this.onGround) return { pose: this.vy < 0 ? 'jump' : 'fall', t: 0 };
      if (this.state === 'walk') return { pose: 'walk', t: t };
      return { pose: 'idle', t: t };
    },

    draw: function (ctx, battle) {
      var pi = this.poseInfo();
      var pose = SG.Stick.getPose(pi.pose, pi.t || 0);
      var glow = 0;
      if (this.state === 'charge') glow = 0.7;
      else if (this.meter >= 100) glow = 0.35 + Math.sin(this.animT * 8) * 0.15;
      if (this.state === 'ult') glow = 1;

      if (this.state === 'ult' && this.ult && this.ult.type === 'spin') {
        ctx.save();
        ctx.translate(this.x, this.y - 80);
        ctx.rotate(this.animT * 22 * this.facing);
        ctx.translate(-this.x, -(this.y - 80));
        SG.Stick.draw(ctx, { x: this.x, y: this.y, facing: this.facing, params: pose,
          t: this.animT, custom: this.custom, vx: this.vx, glow: glow, eye: 'angry' });
        ctx.restore();
        return;
      }

      SG.Stick.draw(ctx, {
        x: this.x, y: this.y, facing: this.facing, params: pose,
        t: this.animT, custom: this.custom, vx: this.vx, glow: glow,
        alpha: this.state === 'dash' ? 0.75 : 1,
        eye: this.state === 'ko' ? 'ko' : (this.isBoss || this.state === 'attack' || this.state === 'ult') ? 'angry' : 'normal'
      });
    }
  };

  SG.Fighter = Fighter;
})(typeof window !== 'undefined' ? window : globalThis);
