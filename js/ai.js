/* CPU 控制器：按性格参数决策（激进/格挡/跳跃/反应速度/远程施法） */
(function (global) {
  'use strict';
  var SG = global.SG = global.SG || {};

  SG.AI = {
    think: function (f, opp, dt, cfg, battle) {
      var m = f._ai || (f._ai = { t: 0, plan: 'idle', holdT: 0 });
      m.t -= dt; m.holdT -= dt;
      var inp = {};
      var dist = Math.abs(opp.x - f.x);
      var toward = opp.x > f.x ? 'right' : 'left';
      var away = toward === 'right' ? 'left' : 'right';

      // 周期性决策
      if (m.t <= 0) {
        m.t = (cfg.reaction || 0.4) * (0.7 + Math.random() * 0.6);
        m.plan = this.decide(f, opp, cfg, dist);
        m.holdT = 0.25 + Math.random() * 0.3;
      }

      // 大招时机：满槽就放（近中距离）
      if (f.meter >= 100 && dist < 360 && f.onGround && f.state !== 'ult' && Math.random() < 0.5) {
        inp.ult = true;
        m.plan = 'idle';
        return inp;
      }

      // 躲避飞行道具
      for (var i = 0; i < battle.projectiles.length; i++) {
        var p = battle.projectiles[i];
        if (p.owner !== f && Math.abs(p.x - f.x) < 300 &&
            Math.sign(p.vx) === (f.x > p.x ? 1 : -1) && Math.random() < 0.45) {
          inp.up = true;
          inp[toward] = true;
          return inp;
        }
      }

      switch (m.plan) {
        case 'approach':
          inp[toward] = true;
          if (dist > 300 && Math.random() < 0.03) inp.dash = true;
          break;
        case 'retreat':
          inp[away] = true;
          break;
        case 'charge':
          if (f.meter < 100) inp.charge = true;
          else m.plan = 'approach';
          break;
        case 'block':
          inp.down = true;
          break;
        case 'jumpin':
          if (f.onGround) { inp.up = true; inp[toward] = true; }
          else if (!f.jumpUsed && dist < 160) inp.kick = true;   // 跳踢
          break;
        case 'attack':
          if (dist < 115 * f.rangeMult) {
            if (Math.random() < 0.45 + (cfg.heavy ? 0.3 : cfg.aggr * 0.2)) inp.kick = true;
            else inp.punch = true;
            m.plan = 'idle';
          } else {
            inp[toward] = true;
          }
          break;
        default:
          if (Math.random() < 0.01) inp.punch = true;
          break;
      }
      return inp;
    },

    decide: function (f, opp, cfg, dist) {
      var r = Math.random();
      // 对手出招 → 概率格挡
      if (opp.state === 'attack' && dist < 170 && r < (cfg.block || 0.2)) return 'block';
      // 远程型：保持距离蓄力
      if (cfg.ranged) {
        if (dist < 240) return Math.random() < 0.7 ? 'retreat' : 'attack';
        if (f.meter < 100) return Math.random() < 0.75 ? 'charge' : 'approach';
        return 'approach';
      }
      if (f.meter < 100 && dist > 420 && r < 0.35) return 'charge';
      if (dist > 230) {
        if (r < cfg.aggr) return 'approach';
        if (r < cfg.aggr + 0.25) return 'jumpin';
        return Math.random() < 0.5 ? 'approach' : 'idle';
      }
      // 近身
      if (r < cfg.aggr) return 'attack';
      if (r < cfg.aggr + (cfg.block || 0.2) * 0.5) return 'block';
      if (r < 0.9) return 'attack';
      return 'retreat';
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
