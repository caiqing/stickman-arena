/* 灵宠系统：可爱小动物（火柴人风格），战斗中助攻/护主/承受伤害 */
(function (global) {
  'use strict';
  var SG = global.SG = global.SG || {};

  // ---------- 灵宠图鉴 ----------
  var PETS = [
    { id: 'tiger',  name: '小虎',   type: 'land', hp: 60, atk: 8,  def: 0.7,
      color: '#e8a040', ear: 'cat',  tail: 'cat',  move: 'melee',
      desc: '勇猛的小虎，近身扑咬' },
    { id: 'fox',    name: '灵狐',   type: 'land', hp: 45, atk: 6,  def: 0.5,
      color: '#f0672a', ear: 'fox',  tail: 'fox',  move: 'melee',
      desc: '灵活的灵狐，身法飘忽' },
    { id: 'eagle',  name: '苍鹰',   type: 'fly',  hp: 40, atk: 10, def: 0.4,
      color: '#8a7a5a', ear: 'bird', tail: 'bird', move: 'ranged',
      desc: '翱翔天际，俯冲利爪' },
    { id: 'goose',  name: '呆鹅',   type: 'fly',  hp: 80, atk: 4,  def: 0.9,
      color: '#e8e8e0', ear: 'bird', tail: 'bird', move: 'melee',
      desc: '坦克型呆鹅，替主人挡刀' },
    { id: 'cat',    name: '雷猫',   type: 'land', hp: 50, atk: 7,  def: 0.6,
      color: '#9c5ce0', ear: 'cat',  tail: 'cat',  move: 'ranged',
      desc: '雷电猫猫，远程放电' },
    { id: 'bear',   name: '小熊',   type: 'land', hp: 90, atk: 5,  def: 0.95,
      color: '#8a6a42', ear: 'bear', tail: 'stub', move: 'melee',
      desc: '憨厚小熊，铜墙铁壁' }
  ];

  // ---------- 灵宠渲染（火柴人风格小动物） ----------
  function drawPet(ctx, pet, x, y, facing, t, hurt) {
    var s = pet.type === 'fly' ? 0.8 : 1.0;   // 飞行体型略小
    var col = hurt > 0 ? '#ff6b6b' : pet.color;
    var bob = pet.type === 'fly' ? Math.sin(t * 4) * 4 : 0;
    var legPhase = pet.type === 'fly' ? 0 : Math.sin(t * 6) * 0.3;

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(facing * s, s);

    var lw = 5, headR = 11, bodyH = 24, legH = 14;

    // 尾巴
    if (pet.tail === 'cat') {
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-8, -bodyH + 4);
      ctx.quadraticCurveTo(-18, -bodyH - 8, -14 + Math.sin(t * 5) * 3, -bodyH - 16);
      ctx.stroke();
    } else if (pet.tail === 'fox') {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(-14, -bodyH + 6, 10, 5, -0.4 + Math.sin(t * 4) * 0.1, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-20, -bodyH + 4, 3.5, 0, 7); ctx.fill();
    } else if (pet.tail === 'bird') {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-6, -bodyH + 6); ctx.lineTo(-18, -bodyH);
      ctx.lineTo(-16, -bodyH + 4); ctx.lineTo(-18, -bodyH + 8);
      ctx.closePath(); ctx.fill();
    } else if (pet.tail === 'stub') {
      ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-7, -bodyH + 4); ctx.lineTo(-11, -bodyH - 2); ctx.stroke();
    }

    // 身体
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(0, -legH); ctx.lineTo(0, -legH - bodyH); ctx.stroke();

    // 前肢（攻击时伸出）
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -legH - bodyH + 6);
    ctx.lineTo(facing > 0 ? 8 : -8, -legH - bodyH + 2 + legPhase * 4); ctx.stroke();

    // 后肢（陆地行走）
    if (pet.type === 'land') {
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-3, -legH); ctx.lineTo(-3 - legPhase * 3, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, -legH); ctx.lineTo(3 + legPhase * 3, 0); ctx.stroke();
    }

    // 翅膀（飞行类型扑扇）
    if (pet.type === 'fly') {
      var flap = Math.sin(t * 10) * 0.5;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(-2, -legH - bodyH + 8);
      ctx.quadraticCurveTo(-20, -legH - bodyH - 10 + flap * 10, -26, -legH - bodyH + 4 + flap * 8);
      ctx.quadraticCurveTo(-14, -legH - bodyH + 6, -2, -legH - bodyH + 4);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 头
    var headY = -legH - bodyH - headR + 2;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, headY, headR, 0, 7); ctx.fill();

    // 耳朵
    if (pet.ear === 'cat') {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(-headR + 2, headY - headR + 3);
      ctx.lineTo(-headR - 3, headY - headR - 7); ctx.lineTo(-headR + 7, headY - headR + 1);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(headR - 2, headY - headR + 3);
      ctx.lineTo(headR + 3, headY - headR - 7); ctx.lineTo(headR - 7, headY - headR + 1);
      ctx.closePath(); ctx.fill();
    } else if (pet.ear === 'fox') {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(-headR + 1, headY - headR + 4);
      ctx.lineTo(-headR - 1, headY - headR - 10); ctx.lineTo(-headR + 8, headY - headR);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(headR - 1, headY - headR + 4);
      ctx.lineTo(headR + 1, headY - headR - 10); ctx.lineTo(headR - 8, headY - headR);
      ctx.closePath(); ctx.fill();
    } else if (pet.ear === 'bear') {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(-headR + 2, headY - headR + 2, 5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(headR - 2, headY - headR + 2, 5, 0, 7); ctx.fill();
    } else if (pet.ear === 'bird') {
      // 鸟嘴
      ctx.fillStyle = '#f5a030';
      ctx.beginPath(); ctx.moveTo(headR - 2, headY - 2);
      ctx.lineTo(headR + 7, headY); ctx.lineTo(headR - 2, headY + 3);
      ctx.closePath(); ctx.fill();
    }

    // 眼睛
    if (hurt > 0) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(2, headY - 3); ctx.lineTo(7, headY + 1);
      ctx.moveTo(7, headY - 3); ctx.lineTo(2, headY + 1); ctx.stroke();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(3, headY - 2, 2.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(4, headY - 2, 1.2, 0, 7); ctx.fill();
    }

    // 猫胡须
    if (pet.ear === 'cat' || pet.ear === 'fox') {
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
      for (var wi = 0; wi < 2; wi++) {
        ctx.beginPath();
        ctx.moveTo(headR - 2, headY + 2 + wi * 3);
        ctx.lineTo(headR + 5, headY + 1 + wi * 4);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ---------- 灵宠战斗实体 ----------
  function PetEntity(petType, owner, side) {
    this.def = PETS.find(function (p) { return p.id === petType; }) || PETS[0];
    this.owner = owner;
    this.side = side;             // 1=跟p1, -1=跟p2
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.x = owner.x + side * -60;
    this.y = 620;
    this.facing = side;
    this.atkCd = 1 + Math.random() * 2;
    this.stunT = 0;
    this.hurtT = 0;
    this.hurtT -= 0;  // placeholder
    this.t = Math.random() * 6;
  }

  PetEntity.prototype.update = function (dt, opp, oppPet, battle) {
    this.t += dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.stunT > 0) { this.stunT -= dt; return; }
    if (this.hp <= 0) return;

    var owner = this.owner;
    var target = opp;

    // 跟随主人（保持在主人侧后方）
    var followX = owner.x - this.facing * 55;
    this.x += (followX - this.x) * Math.min(1, dt * 3);
    if (this.def.type === 'fly') {
      this.y += (620 - 90 - this.y) * Math.min(1, dt * 2);   // 飞行悬浮
    } else {
      this.y = 620;
    }

    // 面向目标
    this.facing = target.x > this.x ? 1 : -1;

    // 攻击冷却
    this.atkCd -= dt;

    if (this.atkCd <= 0) {
      if (this.def.move === 'melee' && Math.abs(target.x - this.x) < 90) {
        // 近战扑咬
        battle.onPetHit(this, target, this.def.atk, this.facing * 120);
        this.atkCd = 1.5 + Math.random() * 1.5;
      } else if (this.def.move === 'ranged' && Math.abs(target.x - this.x) > 150 && Math.abs(target.x - this.x) < 600) {
        // 远程（飞行俯冲/雷电）
        battle.spawnProjectile(this, {
          x: this.x + this.facing * 20, y: this.y - 40,
          vx: this.facing * 800, dmg: this.def.atk, r: 5, type: 'petbolt'
        });
        this.atkCd = 2 + Math.random() * 2;
      } else if (this.def.move === 'melee') {
        // 追近目标
        this.x += this.facing * 120 * dt;
      }
    }

    // 替主人挡投射物（防御）
    // （投射物碰撞检测在 battle.updateProjectiles 中处理）
  };

  PetEntity.prototype.draw = function (ctx) {
    var hurt = this.hurtT > 0 ? 1 : 0;
    drawPet(ctx, this.def, this.x, this.y, this.facing, this.t, hurt);
    // HP 条
    if (this.hp < this.maxHp) {
      var hw = 40;
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.fillRect(this.x - hw / 2, this.y - (this.def.type === 'fly' ? 130 : 150), hw, 5);
      ctx.fillStyle = this.hp > this.maxHp * 0.3 ? '#8fe08f' : '#ff6b6b';
      ctx.fillRect(this.x - hw / 2, this.y - (this.def.type === 'fly' ? 130 : 150), hw * (this.hp / this.maxHp), 5);
    }
  };

  // ---------- 导出 ----------
  SG.PETS = PETS;
  SG.PetEntity = PetEntity;
  SG.drawPet = drawPet;
})(typeof window !== 'undefined' ? window : globalThis);
