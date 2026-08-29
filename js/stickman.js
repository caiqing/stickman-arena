/* 火柴人渲染：骨骼姿势插值 + 发型/帽子/服装/武器绘制 */
(function (global) {
  'use strict';
  var SG = global.SG = global.SG || {};

  var D = Math.PI / 180;
  // 骨骼尺寸（px）
  var HEAD_R = 19, TORSO = 50, UA = 28, FA = 26, L1 = 36, L2 = 34, LEGH = L1 + L2;

  // ---------- 姿势库 ----------
  // 参数: lean 躯干前倾(rad), headTilt 头部倾斜, crouch 下蹲降低量(px)
  //       armF/armB [肩角,肘弯] (0=自然下垂, +向前), legF/legB [髋角,膝弯] (+向前, 膝弯为-向后)
  function P(lean, crouch, aF, aB, lF, lB, headTilt) {
    return { lean: lean, crouch: crouch,
      armF: aF, armB: aB, legF: lF, legB: lB, headTilt: headTilt || 0 };
  }

  var POSES = {
    idle: function (t) {
      var br = Math.sin(t * 2.2) * 0.03;
      return P(0.06 + br * 0.4, 0,
        [0.28 + br, 0.5], [-0.18, 0.35],
        [0.14, -0.08], [-0.14, -0.08], 0);
    },
    walk: function (t) {
      var s = Math.sin(t * 9), c = Math.cos(t * 9);
      return P(0.1, 0,
        [0.28 - s * 0.55, 0.45], [-0.28 + s * 0.55, 0.45],
        [s * 0.55, -0.15 - Math.max(0, c) * 0.45],
        [-s * 0.55, -0.15 - Math.max(0, -c) * 0.45], 0);
    },
    jump: function () {
      return P(0.15, 6, [2.5, 0.5], [2.2, 0.6], [0.6, -1.6], [0.2, -1.2], -0.1);
    },
    fall: function () {
      return P(0.05, 0, [2.7, 0.3], [-0.9, 0.7], [0.35, -0.5], [-0.3, -0.9], 0.1);
    },
    punchW: function () { // 出拳蓄势
      return P(-0.08, 4, [-0.85, 1.6], [0.55, 2.0], [0.3, -0.2], [-0.35, -0.25], -0.05);
    },
    punchX: function () { // 出拳
      return P(0.28, 6, [1.5, 0.05], [0.3, 2.2], [0.62, -0.3], [-0.5, -0.35], 0);
    },
    punchB: function () { // 连招段2：后手直拳
      return P(0.22, 5, [0.85, 2.1], [1.5, 0.08], [0.35, -0.28], [-0.38, -0.3], 0);
    },
    aim: function () { // 远程武器瞄准：双臂前伸持械
      return P(0.12, 2, [1.32, 0.06], [1.18, 0.1], [0.32, -0.2], [-0.32, -0.26], 0);
    },
    drawbow: function () { // 拉弓：前臂持弓伸直，后手拉弦至颊侧
      return P(0.08, 2, [1.52, 0.0], [0.72, 0.95], [0.34, -0.18], [-0.3, -0.28], 0);
    },
    aimFire: function () { // 射击后坐
      return P(0.02, 2, [1.38, 0.08], [1.24, 0.14], [0.32, -0.2], [-0.32, -0.26], -0.06);
    },
    upper: function () { // 连招段3终结：上勾拳
      return P(-0.12, 12, [2.35, 0.55], [0.5, 1.9], [0.42, -0.7], [-0.36, -0.55], -0.25);
    },
    kickW: function () { // 踢腿提膝
      return P(-0.12, 2, [-0.5, 1.3], [0.7, 1.1], [1.15, -1.9], [-0.12, -0.1], 0);
    },
    kickX: function () { // 踢出
      return P(-0.22, 0, [-0.9, 0.9], [1.0, 0.9], [1.65, -0.12], [-0.3, -0.3], 0.08);
    },
    block: function () {
      return P(-0.06, 10, [0.95, 2.15], [0.8, 2.35], [0.25, -0.45], [-0.25, -0.45], 0.05);
    },
    hurt: function () {
      return P(-0.38, 6, [-1.1, 0.7], [-1.6, 0.5], [0.7, -0.6], [-0.2, -0.5], -0.25);
    },
    charge: function (t) {
      var p = Math.sin(t * 10) * 0.06;
      return P(0.3 + p, 16, [0.35 + p, 0.9], [0.35 - p, 0.9], [0.5, -1.0], [-0.5, -1.0], 0.3);
    },
    ult: function (t) {
      var p = Math.sin(t * 14) * 0.1;
      return P(-0.15 - p, 2, [2.9, 0.15], [2.6, 0.3], [0.5, -0.4], [-0.35, -0.5], -0.2);
    },
    victory: function (t) {
      var p = Math.sin(t * 5) * 0.12;
      return P(-0.05, 0, [2.8 + p, 0.1], [0.3, 1.2], [0.15, -0.1], [-0.15, -0.1], -0.15);
    },
    dance1: function () { return P(-0.1, 0, [2.9, 0.1], [-0.5, 2.0], [0.1, -0.05], [-0.35, -0.35], -0.12); },
    dance2: function () { return P(0.12, 6, [-0.4, 2.0], [2.9, 0.1], [0.4, -0.4], [-0.1, -0.05], 0.12); },
    dance3: function () { return P(0, 4, [1.4, 1.8], [-1.2, 0.8], [0.55, -0.7], [-0.3, -0.15], 0); },
    dance4: function () { return P(-0.06, 10, [0.6, 2.3], [0.5, 2.4], [0.15, -0.15], [-0.15, -0.15], -0.06); },
    rowA: function () { // 划桨前伸（坐姿：大腿前伸、小腿垂下）
      return P(0.35, 0, [1.3, 0.25], [1.2, 0.3], [1.35, -1.0], [1.3, -1.05], 0.1);
    },
    rowB: function () { // 划桨后拉
      return P(-0.25, 4, [-0.4, 1.7], [-0.5, 1.7], [1.4, -1.05], [1.35, -1.1], -0.15);
    },
    fly: function (t) { // 滑翔伞悬挂：身体微后仰、双手上举、双腿下垂
      var p = Math.sin(t * 3) * 0.04;
      return P(-0.15 + p, 0, [2.85, 0.15], [2.65, 0.25], [0.3, -0.5], [0.05, -0.6], 0.1);
    },
    // 被击倒：自定义关节坐标（趴地）
    ko: { custom: true,
      pelvis: [-24, -12], neck: [30, -17], head: [52, -22],
      legF: [[-40, -6], [-58, -16]], legB: [[-38, -2], [-56, -2]],
      armF: [[14, -2], [2, -10]], armB: [[42, -6], [56, -12]] }
  };

  function mixPose(a, b, t) {
    if (a.custom || b.custom) return t < 0.5 ? a : b;
    function mixL(u, v) { return [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t]; }
    return {
      lean: a.lean + (b.lean - a.lean) * t, crouch: a.crouch + (b.crouch - a.crouch) * t,
      headTilt: a.headTilt + (b.headTilt - a.headTilt) * t,
      armF: mixL(a.armF, b.armF), armB: mixL(a.armB, b.armB),
      legF: mixL(a.legF, b.legF), legB: mixL(a.legB, b.legB)
    };
  }

  SG.Stick = {
    HEAD_R: HEAD_R,
    POSES: POSES, mix: mixPose,

    getPose: function (name, t) {
      var p = POSES[name] || POSES.idle;
      return typeof p === 'function' ? p(t || 0) : p;
    },

    // ---------- 主绘制入口 ----------
    // o: {x,y,facing,pose,params?,t,custom,vx,glow,alpha,scale,eye}
    draw: function (ctx, o) {
      var custom = o.custom;
      var pose = o.params || SG.Stick.getPose(o.pose || 'idle', o.t || 0);
      var sc = o.scale || 1;
      var bodyHex = SG.DATA.colorById(custom.color).hex;
      var dark = shade(bodyHex, -0.35);

      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.scale(sc * (o.facing || 1), sc);
      if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

      // 蓄力光圈
      if (o.glow > 0) {
        var gr = 60 + Math.sin((o.t || 0) * 12) * 8;
        var grd = ctx.createRadialGradient(0, -LEGH, 5, 0, -LEGH, gr);
        grd.addColorStop(0, 'rgba(255,220,120,' + (0.35 * o.glow) + ')');
        grd.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(0, -LEGH, gr, 0, 7); ctx.fill();
      }

      // 披风/围巾画在身后
      if (custom.clothes === 'cape') drawCape(ctx, pose, dark, o.t || 0, o.vx || 0);
      if (custom.clothes === 'scarf') drawScarf(ctx, pose, '#e05050', o.t || 0, o.vx || 0);

      ctx.lineCap = 'round'; ctx.lineJoin = 'round';

      var J = computeJoints(pose);

      if (pose.custom) {
        // 躺地姿势：直接按关节绘制
        drawLimb(ctx, J.pelvis, J.legF[0], J.legF[1], 7, bodyHex);
        drawLimb(ctx, J.pelvis, J.legB[0], J.legB[1], 7, shade(bodyHex, -0.15));
        drawLimb(ctx, J.neck, J.armB[0], J.armB[1], 6, shade(bodyHex, -0.15));
        drawLimb(ctx, J.pelvis, J.neck, 9, bodyHex);
        drawLimb(ctx, J.neck, J.armF[0], J.armF[1], 6, bodyHex);
        drawHead(ctx, J.head, 0, custom, o);
        ctx.restore();
        return;
      }

      // 后腿/后臂（暗色调）
      drawLeg(ctx, J, 'B', 7, shade(bodyHex, -0.18));
      drawLimb(ctx, J.neckB, J.armBe, J.armBh, 6, shade(bodyHex, -0.18));
      // 躯干
      ctx.strokeStyle = bodyHex; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(J.pelvis[0], J.pelvis[1]); ctx.lineTo(J.neck[0], J.neck[1]); ctx.stroke();
      if (custom.clothes === 'armor') { // 铠甲：加粗躯干 + 肩甲
        ctx.strokeStyle = '#a8b2c8'; ctx.lineWidth = 13;
        ctx.beginPath(); ctx.moveTo(J.pelvis[0], J.pelvis[1] + 6);
        ctx.lineTo(J.neck[0], J.neck[1] + 2); ctx.stroke();
        ctx.fillStyle = '#c4cee0';
        ctx.beginPath(); ctx.arc(J.neck[0] - 5, J.neck[1] + 3, 8, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(J.neck[0] + 5, J.neck[1] + 3, 8, 0, 7); ctx.fill();
      }
      if (custom.clothes === 'ninja') { // 忍者束带
        ctx.strokeStyle = dark; ctx.lineWidth = 11;
        var my = J.pelvis[1] - 14;
        ctx.beginPath(); ctx.moveTo(-5, my); ctx.lineTo(5, my - 1); ctx.stroke();
      }
      if (custom.clothes === 'belt') {
        ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(-5, J.pelvis[1] - 2); ctx.lineTo(5, J.pelvis[1] - 2); ctx.stroke();
        ctx.fillStyle = '#f2c14e';
        ctx.beginPath(); ctx.arc(0, J.pelvis[1] - 2, 4.5, 0, 7); ctx.fill();
      }
      if (custom.clothes === 'skirt') {
        ctx.fillStyle = shade(bodyHex, -0.25);
        ctx.beginPath();
        ctx.moveTo(-8, J.pelvis[1] - 4); ctx.lineTo(8, J.pelvis[1] - 4);
        ctx.lineTo(15, J.pelvis[1] + 22); ctx.lineTo(-15, J.pelvis[1] + 22);
        ctx.closePath(); ctx.fill();
      }
      // 前腿
      drawLeg(ctx, J, 'F', 7, bodyHex);
      // 头
      drawHead(ctx, J.head, pose.headTilt, custom, o);
      // 前臂 + 武器
      drawLimb(ctx, J.neckF, J.armFe, J.armFh, 6, bodyHex);
      drawWeapon(ctx, custom.weapon, J.armFh, forearmAngle(J.neckF, J.armFe, J.armFh), o.t || 0, bodyHex);

      ctx.restore();
    },

    // 对话头像（头 + 肩）
    drawPortrait: function (ctx, custom, w, h, t) {
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h * 0.78);
      var sc = h / 150;
      ctx.scale(sc, sc);
      var bodyHex = SG.DATA.colorById(custom.color).hex;
      ctx.lineCap = 'round';
      ctx.strokeStyle = bodyHex; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(-26, 30); ctx.quadraticCurveTo(0, 8, 26, 30); ctx.stroke();
      // 肩头的躯干
      ctx.lineWidth = 13;
      ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(0, 40); ctx.stroke();
      drawHead(ctx, [0, -HEAD_R - 4], Math.sin((t || 0) * 1.5) * 0.05, custom, { t: t || 0 });
      ctx.restore();
    }
  };

  // ---------- 关节计算 ----------
  function computeJoints(pose) {
    if (pose.custom) return pose;
    var crouch = pose.crouch || 0;
    var pelvis = [0, -LEGH + crouch];
    var dir = function (a, l) { return [Math.sin(a) * l, Math.cos(a) * l]; };
    var lean = pose.lean;
    var neck = [pelvis[0] + Math.sin(lean) * TORSO, pelvis[1] - Math.cos(lean) * TORSO];
    var head = [neck[0] + Math.sin(lean) * (HEAD_R + 5), neck[1] - Math.cos(lean) * (HEAD_R + 5)];

    var legF = [pelvis[0] + 4, pelvis[1]], legB = [pelvis[0] - 4, pelvis[1]];
    var kneeF = [legF[0] + dir(pose.legF[0], L1)[0], legF[1] + dir(pose.legF[0], L1)[1]];
    var footF = [kneeF[0] + dir(pose.legF[0] + pose.legF[1], L2)[0], kneeF[1] + dir(pose.legF[0] + pose.legF[1], L2)[1]];
    var kneeB = [legB[0] + dir(pose.legB[0], L1)[0], legB[1] + dir(pose.legB[0], L1)[1]];
    var footB = [kneeB[0] + dir(pose.legB[0] + pose.legB[1], L2)[0], kneeB[1] + dir(pose.legB[0] + pose.legB[1], L2)[1]];

    var neckF = [neck[0] + 4, neck[1] + 2], neckB = [neck[0] - 4, neck[1] + 2];
    var elbF = [neckF[0] + dir(pose.armF[0], UA)[0], neckF[1] + dir(pose.armF[0], UA)[1]];
    var hndF = [elbF[0] + dir(pose.armF[0] + pose.armF[1], FA)[0], elbF[1] + dir(pose.armF[0] + pose.armF[1], FA)[1]];
    var elbB = [neckB[0] + dir(pose.armB[0], UA)[0], neckB[1] + dir(pose.armB[0], UA)[1]];
    var hndB = [elbB[0] + dir(pose.armB[0] + pose.armB[1], FA)[0], elbB[1] + dir(pose.armB[0] + pose.armB[1], FA)[1]];

    return {
      pelvis: pelvis, neck: neck, head: head,
      legF: [kneeF, footF], legB: [kneeB, footB],
      neckF: neckF, armFe: elbF, armFh: hndF,
      neckB: neckB, armBe: elbB, armBh: hndB
    };
  }

  function drawLeg(ctx, J, side, w, color) {
    var k = J['leg' + side][0], f = J['leg' + side][1];
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(J.pelvis[0], J.pelvis[1]); ctx.lineTo(k[0], k[1]); ctx.lineTo(f[0], f[1]); ctx.stroke();
    // 脚
    ctx.lineWidth = w + 1;
    ctx.beginPath(); ctx.moveTo(f[0], f[1]); ctx.lineTo(f[0] + 9, f[1]); ctx.stroke();
  }

  function drawLimb(ctx, a, b, c, w, color) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
  }

  function drawLimb2(ctx, a, b, w, color) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }

  function forearmAngle(s, e, h) { return Math.atan2(h[1] - e[1], h[0] - e[0]); }

  // ---------- 头部 + 发型 + 帽子 ----------
  function drawHead(ctx, c, tilt, custom, o) {
    var bodyHex = SG.DATA.colorById(custom.color).hex;
    ctx.save();
    ctx.translate(c[0], c[1]); ctx.rotate(tilt || 0);
    ctx.fillStyle = bodyHex;
    ctx.beginPath(); ctx.arc(0, 0, HEAD_R, 0, 7); ctx.fill();

    // 眼睛
    var eye = o.eye || 'normal';
    ctx.fillStyle = '#fff';
    if (eye === 'ko') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4;
      [[6, -3], [13, -3]].forEach(function (p) {
        ctx.beginPath();
        ctx.moveTo(p[0] - 3, p[1] - 3); ctx.lineTo(p[0] + 3, p[1] + 3);
        ctx.moveTo(p[0] + 3, p[1] - 3); ctx.lineTo(p[0] - 3, p[1] + 3);
        ctx.stroke();
      });
    } else {
      ctx.beginPath(); ctx.arc(6, -4, 2.6, 0, 7); ctx.arc(13, -4, 2.6, 0, 7); ctx.fill();
      if (eye === 'angry') {
        ctx.strokeStyle = shade(bodyHex, -0.5); ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(2, -9); ctx.lineTo(9, -6);
        ctx.moveTo(17, -8); ctx.lineTo(11, -6); ctx.stroke();
      }
    }
    if (custom.clothes === 'ninja') { // 蒙面
      ctx.fillStyle = shade(bodyHex, -0.3);
      ctx.beginPath(); ctx.arc(0, 3, HEAD_R - 1, -0.5, Math.PI + 0.5); ctx.fill();
    }

    drawHair(ctx, custom, bodyHex, o.t || 0);
    drawHat(ctx, custom.hat);
    ctx.restore();
  }

  function drawHair(ctx, custom, bodyHex, t) {
    var dark = shade(bodyHex, -0.4);
    var R = HEAD_R;
    ctx.fillStyle = dark;
    switch (custom.hair) {
      case 'short':
        ctx.beginPath(); ctx.arc(0, -2, R + 1.5, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
        break;
      case 'spiky':
        ctx.beginPath();
        for (var i = 0; i < 6; i++) {
          var a0 = Math.PI + i * (Math.PI / 6);
          var a1 = a0 + Math.PI / 6;
          ctx.moveTo(Math.cos(a0) * R * 0.9, Math.sin(a0) * R * 0.9);
          ctx.lineTo(Math.cos((a0 + a1) / 2) * (R + 11), Math.sin((a0 + a1) / 2) * (R + 11));
          ctx.lineTo(Math.cos(a1) * R * 0.9, Math.sin(a1) * R * 0.9);
        }
        ctx.fill();
        break;
      case 'pony':
        ctx.beginPath(); ctx.arc(0, -3, R + 1.5, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
        var sw = Math.sin(t * 6) * 4;
        ctx.strokeStyle = dark; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-R + 3, -8);
        ctx.quadraticCurveTo(-R - 14, -6 + sw, -R - 12, 16 + sw); ctx.stroke();
        break;
      case 'long':
        ctx.beginPath(); ctx.arc(0, -3, R + 2, Math.PI * 0.85, Math.PI * 2.15); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-R - 1, -12); ctx.lineTo(-R - 9, 26); ctx.lineTo(-R + 4, 24);
        ctx.lineTo(-R + 2, -4); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(R - 3, -12); ctx.lineTo(R + 5, 20); ctx.lineTo(R - 6, 18);
        ctx.lineTo(R - 4, -4); ctx.closePath(); ctx.fill();
        break;
      case 'bun':
        ctx.beginPath(); ctx.arc(0, -2, R + 1.5, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
        ctx.beginPath(); ctx.arc(2, -R - 4, 8, 0, 7); ctx.fill();
        break;
      case 'twintail':
        ctx.beginPath(); ctx.arc(0, -2, R + 1.5, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
        var sw2 = Math.sin(t * 7) * 5;
        ctx.strokeStyle = dark; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-R + 1, -6);
        ctx.quadraticCurveTo(-R - 12, 6 + sw2, -R - 8, 22 + sw2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(R - 1, -6);
        ctx.quadraticCurveTo(R + 12, 6 + sw2, R + 8, 22 + sw2); ctx.stroke();
        break;
      case 'curly':
        [[-12, -12], [0, -17], [12, -12], [-16, -2], [16, -2]].forEach(function (p) {
          ctx.beginPath(); ctx.arc(p[0], p[1], 7.5, 0, 7); ctx.fill();
        });
        break;
    }
  }

  function drawHat(ctx, hat) {
    var R = HEAD_R;
    switch (hat) {
      case 'cap':
        ctx.fillStyle = '#d84a4a';
        ctx.beginPath(); ctx.arc(0, -3, R + 1, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillRect(-1, -R - 4, R + 8, 5);
        break;
      case 'straw':
        ctx.fillStyle = '#d8b04a';
        ctx.beginPath(); ctx.ellipse(0, -R + 2, R + 14, 6, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -R + 1, R - 3, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#b58a2a'; ctx.fillRect(-R + 3, -R - 3, (R - 3) * 2, 4);
        break;
      case 'headband':
        ctx.fillStyle = '#e04040'; ctx.fillRect(-R, -R + 2, R * 2, 6);
        var sw = Math.sin((ctx.canvas && 0) || 0) * 0; // 静态带尾
        ctx.strokeStyle = '#e04040'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-R + 2, -R + 5); ctx.lineTo(-R - 14, -R + 12); ctx.stroke();
        break;
      case 'helmet':
        ctx.fillStyle = '#8a95a8';
        ctx.beginPath(); ctx.arc(0, -2, R + 3, Math.PI * 0.93, Math.PI * 2.07); ctx.fill();
        ctx.fillRect(-R - 3, -6, (R + 3) * 2, 5);
        ctx.fillStyle = '#e04040';
        ctx.beginPath(); ctx.arc(0, -R - 4, 4, 0, 7); ctx.fill();
        break;
      case 'wizard':
        ctx.fillStyle = '#5a4ae0';
        ctx.beginPath();
        ctx.moveTo(-R - 4, -R + 4); ctx.lineTo(2, -R - 30); ctx.lineTo(R + 6, -R + 6);
        ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -R + 4, R + 9, 5.5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffd34d';
        ctx.beginPath(); ctx.arc(-5, -R - 8, 2.4, 0, 7);
        ctx.moveTo(6, -R - 16); ctx.arc(6, -R - 16, 2, 0, 7); ctx.fill();
        break;
      case 'crown':
        ctx.fillStyle = '#ffd34d';
        ctx.beginPath();
        ctx.moveTo(-R + 2, -R + 4); ctx.lineTo(-R + 2, -R - 8); ctx.lineTo(-R / 2, -R - 1);
        ctx.lineTo(0, -R - 12); ctx.lineTo(R / 2, -R - 1); ctx.lineTo(R - 2, -R - 8);
        ctx.lineTo(R - 2, -R + 4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e04040';
        ctx.beginPath(); ctx.arc(0, -R - 2, 2.6, 0, 7); ctx.fill();
        break;
    }
  }

  // ---------- 围巾 / 披风 ----------
  function drawScarf(ctx, pose, color, t, vx) {
    var J = computeJoints(pose);
    var n = J.neck;
    var flow = -Math.sign(vx || 0.001) * Math.min(1, Math.abs(vx) / 300);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(n[0] - 3, n[1] + 2);
    var wob = Math.sin(t * 7) * 6;
    ctx.quadraticCurveTo(n[0] - 26 + flow * 14, n[1] + 8 + wob, n[0] - 46 + flow * 26, n[1] + 18 - wob);
    ctx.lineTo(n[0] - 42 + flow * 26, n[1] + 26 - wob);
    ctx.quadraticCurveTo(n[0] - 22 + flow * 14, n[1] + 14 + wob * 0.5, n[0] - 2, n[1] + 9);
    ctx.closePath(); ctx.fill();
  }

  function drawCape(ctx, pose, color, t, vx) {
    var J = computeJoints(pose);
    var n = J.neck;
    var flow = -Math.sign(vx || 0.001) * Math.min(1, Math.abs(vx) / 300);
    var wob = Math.sin(t * 5) * 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(n[0] - 8, n[1] + 1);
    ctx.quadraticCurveTo(n[0] - 34 + flow * 30, n[1] + 40 + wob, n[0] - 30 + flow * 40, n[1] + 86 - wob);
    ctx.lineTo(n[0] - 6 + flow * 18, n[1] + 80);
    ctx.quadraticCurveTo(n[0] + 6, n[1] + 40, n[0] + 8, n[1] + 2);
    ctx.closePath(); ctx.fill();
  }

  // ---------- 武器 ----------
  function drawWeapon(ctx, wid, hand, ang, t, bodyHex) {
    ctx.save();
    ctx.translate(hand[0], hand[1]);
    ctx.rotate(ang);
    switch (wid) {
      case 'fist':
        ctx.fillStyle = bodyHex;
        ctx.beginPath(); ctx.arc(4, 0, 6.5, 0, 7); ctx.fill();
        break;
      case 'sword':
        ctx.fillStyle = '#8a6a3a'; ctx.fillRect(-12, -2.5, 14, 5);          // 柄
        ctx.fillStyle = '#f2c14e'; ctx.fillRect(2, -7, 4, 14);              // 护手
        ctx.fillStyle = '#cdd6e0';
        ctx.beginPath(); ctx.moveTo(6, -3.5); ctx.lineTo(64, -1.5); ctx.lineTo(70, 0);
        ctx.lineTo(64, 1.5); ctx.lineTo(6, 3.5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#eef4ff'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(8, -1); ctx.lineTo(62, -0.5); ctx.stroke();
        break;
      case 'spear':
        ctx.fillStyle = '#7a5a34'; ctx.fillRect(-34, -2.5, 122, 5);          // 杆
        ctx.fillStyle = '#cdd6e0';
        ctx.beginPath(); ctx.moveTo(88, -5); ctx.lineTo(106, 0); ctx.lineTo(88, 5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e04040';                                           // 红缨
        for (var i = -2; i <= 2; i++) {
          ctx.beginPath(); ctx.moveTo(84, 0);
          ctx.quadraticCurveTo(92, i * 7 - 2, 84, i * 9 - 3);
          ctx.quadraticCurveTo(88, i * 3, 84, 0); ctx.fill();
        }
        break;
      case 'hammer':
        ctx.fillStyle = '#7a5a34'; ctx.fillRect(-14, -3, 64, 6);             // 柄
        ctx.fillStyle = '#7a8496'; ctx.fillRect(46, -13, 24, 26);            // 锤头
        ctx.fillStyle = '#9aa4b8'; ctx.fillRect(46, -13, 24, 7);
        break;
      case 'staff':
        ctx.fillStyle = '#6a4a7a'; ctx.fillRect(-26, -2.5, 108, 5);
        var g = ctx.createRadialGradient(86, 0, 1, 86, 0, 14);
        g.addColorStop(0, 'rgba(255,150,60,.95)'); g.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(86, 0, 14 + Math.sin(t * 8) * 2, 0, 7); ctx.fill();
        ctx.fillStyle = '#ff8030';
        ctx.beginPath(); ctx.arc(86, 0, 6.5, 0, 7); ctx.fill();
        break;
      case 'nunchaku': {
        var sw = Math.sin(t * 13) * 0.9;
        ctx.fillStyle = '#5a4030'; ctx.fillRect(-4, -3, 30, 6);              // 上棍
        ctx.strokeStyle = '#b8c0cc'; ctx.lineWidth = 2;                      // 链
        ctx.beginPath(); ctx.moveTo(26, 0);
        ctx.quadraticCurveTo(38, 8 + sw * 6, 36, 18 + sw * 8); ctx.stroke();
        ctx.save(); ctx.translate(36, 18 + sw * 8); ctx.rotate(0.9 + sw);
        ctx.fillStyle = '#5a4030'; ctx.fillRect(0, -3, 28, 6); ctx.restore();
        break;
      }
      // ===== 传统武器扩充 =====
      case 'dagger': {  // 短匕：短刃反握
        ctx.fillStyle = '#c8d2dc';
        ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(28, -1); ctx.lineTo(-2, 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a4632'; ctx.fillRect(-9, -4, 7, 7);
        break;
      }
      case 'emei': {    // 峨眉刺：拳刺
        ctx.fillStyle = '#d8e2ec';
        ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(12, -4); ctx.lineTo(0, 1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(12, 5); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill();
        break;
      }
      case 'twinblade': { // 双刀
        ctx.fillStyle = '#c8d8e8';
        ctx.beginPath(); ctx.moveTo(2, -5); ctx.lineTo(36, -2); ctx.lineTo(2, 1); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.scale(1, -1);
        ctx.fillStyle = '#a8b8cc';
        ctx.beginPath(); ctx.moveTo(2, -5); ctx.lineTo(32, -2); ctx.lineTo(2, 1); ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }
      case 'katana': {  // 武士刀：弧形长刃
        ctx.fillStyle = '#e8eef4';
        ctx.beginPath(); ctx.moveTo(0, -3);
        ctx.quadraticCurveTo(42, -9, 74, -2);
        ctx.quadraticCurveTo(42, 0, 0, 3);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a2a34'; ctx.fillRect(-13, -3.5, 13, 7);
        ctx.fillStyle = '#c8a850'; ctx.fillRect(0, -5.5, 4, 11);
        break;
      }
      case 'longstaff': { // 长棍
        ctx.strokeStyle = '#8a6a42'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-52, 2); ctx.lineTo(54, -2); ctx.stroke();
        break;
      }
      case 'sanjie': {  // 三节棍
        ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 5.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-32, 0); ctx.lineTo(-6, -4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(20, 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(20, 2); ctx.lineTo(46, -6); ctx.stroke();
        break;
      }
      case 'guandao': { // 青龙偃月刀
        ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 5.5;
        ctx.beginPath(); ctx.moveTo(-62, 0); ctx.lineTo(20, 0); ctx.stroke();
        ctx.fillStyle = '#c8d2dc';
        ctx.beginPath();
        ctx.moveTo(20, -4);
        ctx.quadraticCurveTo(60, -28, 70, 6);
        ctx.quadraticCurveTo(50, -6, 20, 6);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d04040'; ctx.fillRect(17, -9, 5, 17);
        break;
      }
      case 'halberd': { // 方天画戟
        ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 5.5;
        ctx.beginPath(); ctx.moveTo(-58, 0); ctx.lineTo(30, 0); ctx.stroke();
        ctx.fillStyle = '#c8d2dc';
        ctx.beginPath(); ctx.moveTo(30, -4); ctx.lineTo(60, -2); ctx.lineTo(54, 5); ctx.lineTo(30, 5); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(36, 0); ctx.quadraticCurveTo(52, -20, 62, -15); ctx.quadraticCurveTo(54, -4, 36, 0); ctx.closePath(); ctx.fill();
        break;
      }
      case 'changba': { // 丈八长矛
        ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(-72, 0); ctx.lineTo(56, -1); ctx.stroke();
        ctx.fillStyle = '#cdd6e0';
        ctx.beginPath(); ctx.moveTo(56, -5); ctx.lineTo(86, -1); ctx.lineTo(56, 4); ctx.closePath(); ctx.fill();
        break;
      }
      case 'mjolnir': { // 雷神之锤
        ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 5.5;
        ctx.beginPath(); ctx.moveTo(-16, 2); ctx.lineTo(26, -2); ctx.stroke();
        ctx.fillStyle = '#8a9bb5'; ctx.fillRect(24, -16, 26, 26);
        ctx.fillStyle = '#b8c8e0'; ctx.fillRect(24, -16, 26, 7);
        ctx.strokeStyle = '#9ad6ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(32, -20); ctx.lineTo(38, -27); ctx.lineTo(32, -24); ctx.stroke();
        break;
      }
      case 'twinhammer': { // 双锤
        ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(-14, 4); ctx.lineTo(20, -2); ctx.stroke();
        ctx.fillStyle = '#8a9bb5'; ctx.fillRect(18, -14, 18, 18);
        ctx.strokeStyle = '#6a5a3a';
        ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(-34, 14); ctx.stroke();
        ctx.fillStyle = '#8a9bb5'; ctx.fillRect(-48, 8, 18, 16);
        break;
      }
      // ===== 现代武器 =====
      case 'longbow': { // 长弓（武器 id 见 data.js WEAPONS）
        ctx.strokeStyle = '#a8793f'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(8, -4, 34, -1.25, 1.25); ctx.stroke();
        ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 1.5;
        var bax = 8 + Math.cos(-1.25) * 34, bay = -4 + Math.sin(-1.25) * 34;
        var bbx = 8 + Math.cos(1.25) * 34, bby = -4 + Math.sin(1.25) * 34;
        ctx.beginPath(); ctx.moveTo(bax, bay); ctx.lineTo(bbx, bby); ctx.stroke();
        break;
      }
      case 'pistol': {  // 手枪
        ctx.fillStyle = '#3a3f4a';
        ctx.fillRect(-4, -6, 26, 8);
        ctx.fillRect(0, 2, 7, 12);
        ctx.fillStyle = '#22262e'; ctx.fillRect(22, -5, 8, 5);
        break;
      }
      case 'smg': {     // 冲锋枪
        ctx.fillStyle = '#2e3340';
        ctx.fillRect(-8, -7, 40, 9);
        ctx.fillRect(6, 2, 7, 13);
        ctx.fillRect(-14, -5, 8, 6);
        ctx.fillStyle = '#22262e'; ctx.fillRect(30, -5, 8, 6);
        break;
      }
      case 'sniper': {  // 狙击枪
        ctx.fillStyle = '#37412e';
        ctx.fillRect(-16, -5, 64, 7);
        ctx.fillStyle = '#22262e';
        ctx.fillRect(48, -4, 16, 4);
        ctx.fillStyle = '#141821'; ctx.fillRect(6, -12, 18, 6);
        ctx.fillRect(-18, -3, 10, 8);
        break;
      }
      case 'gatling': { // 加特林
        ctx.fillStyle = '#3a3f4a';
        ctx.beginPath(); ctx.arc(8, -2, 13, 0, 7); ctx.fill();
        ctx.fillStyle = '#22262e';
        for (var gi = 0; gi < 3; gi++) ctx.fillRect(18, -10 + gi * 7, 44, 4);
        ctx.fillStyle = '#4a5468'; ctx.fillRect(-14, -6, 22, 10);
        break;
      }
    }
    ctx.restore();
  }

  // ---------- 颜色工具 ----------
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function cl(v) { return Math.max(0, Math.min(255, Math.round(v))); }
    if (amt < 0) { r *= (1 + amt); g *= (1 + amt); b *= (1 + amt); }
    else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return 'rgb(' + cl(r) + ',' + cl(g) + ',' + cl(b) + ')';
  }
  SG.Stick.shade = shade;
  SG.Stick.drawLimb2 = drawLimb2;
})(typeof window !== 'undefined' ? window : globalThis);
