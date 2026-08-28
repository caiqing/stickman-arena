/* 无头模拟测试：AI vs AI 完整对局，验证引擎稳定性与录像/回放一致性 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ctx = { console: console, Math: Math, Date: Date, performance: { now: () => 0 } };
vm.createContext(ctx);
// 依顺序加载引擎相关脚本（不含 DOM/UI 模块）
['data.js', 'audio.js', 'stickman.js', 'fighter.js', 'battle.js', 'ai.js', 'replay.js'].forEach(function (f) {
  var code = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  vm.runInContext(code, ctx, { filename: f });
});
var SG = ctx.SG;

function approx(x) { return isFinite(x) && !isNaN(x); }

function runBattle(opts, withRecording) {
  var done = false, result = null;
  var battle = new SG.Battle({
    mode: opts.mode || 'versus', stage: opts.stage || 'dojo',
    roundsToWin: opts.roundsToWin !== undefined ? opts.roundsToWin : 2,
    roundTime: 60,
    p1: { name: '甲', custom: Object.assign(SG.DATA.defaultCustom(), opts.p1 || {}), ctrl: opts.p1ai },
    p2: { name: '乙', custom: Object.assign(SG.DATA.defaultCustom(), opts.p2 || {}), ctrl: opts.p2ai },
    onEvent: function (type, data) { if (type === 'matchEnd') { done = true; result = data; } }
  });
  if (withRecording) SG.Replay.start({ modeLabel: '测试', p1: { name: '甲', custom: {} }, p2: { name: '乙', custom: {} }, stage: 'dojo', roundsToWin: 2 });
  var dt = 1 / 60, t = 0, frames = [];
  while (!done && t < 60 * 240) {   // 上限4分钟模拟
    battle.update(dt, {});          // AI 在 battle.update 内部生成
    var li = battle.lastInputs || { p1: {}, p2: {} };
    if (withRecording) { SG.Replay.tick(li.p1, li.p2); frames.push([li.p1, li.p2]); }
    t += dt;
    if (!approx(battle.p1.x) || !approx(battle.p2.x) || !approx(battle.p1.hp)) {
      throw new Error('出现 NaN 在 t=' + t.toFixed(1));
    }
  }
  var rec = withRecording ? SG.Replay.finalize('测试') : null;
  return { battle: battle, result: result, simTime: t, done: done, rec: rec, rawFrames: frames };
}

var failures = 0;

// ---- 测试1：AI vs AI 10场随机对局（不同武器/场地），必须能分出胜负 ----
console.log('== 测试1：10场 AI 对局 ==');
var weapons = SG.DATA.WEAPONS.map(w => w.id);
for (var i = 0; i < 10; i++) {
  var r = runBattle({
    stage: SG.DATA.STAGES[i % 6].id,
    p1: { weapon: weapons[i % weapons.length] },
    p2: { weapon: weapons[(i + 3) % weapons.length] },
    p1ai: { aggr: 0.3 + (i % 5) * 0.1, block: 0.2, jump: 0.1, reaction: 0.35 },
    p2ai: { aggr: 0.3 + ((i + 2) % 5) * 0.1, block: 0.2, jump: 0.1, reaction: 0.4 }
  }, false);
  var ok = r.done && r.result && (r.result.winner === 'p1' || r.result.winner === 'p2');
  if (!ok) { failures++; console.log('  第' + i + '场失败: done=' + r.done); }
  else console.log('  第' + i + '场 完成 用时' + r.simTime.toFixed(1) + 's 胜者=' + r.result.winner +
    ' 比分' + r.result.p1.roundsWon + ':' + r.result.p2.roundsWon + ' 最高连击 ' + r.result.p1.maxCombo + '/' + r.result.p2.maxCombo);
}

// ---- 测试2：全部6种武器的大招都要能释放且不崩溃 ----
console.log('== 测试2：6种大招释放 ==');
weapons.forEach(function (wid) {
  var b = new SG.Battle({
    mode: 'versus', stage: 'dojo', roundsToWin: 99, roundTime: 99,
    p1: { name: 'A', custom: Object.assign(SG.DATA.defaultCustom(), { weapon: wid }), ctrl: 'human' },
    p2: { name: 'B', custom: Object.assign(SG.DATA.defaultCustom(), { weapon: wid }), ctrl: 'human' },
    onEvent: function () {}
  });
  b.p1.meter = 100;
  b.p2.x = 470;   // 拉近距离让近战大招也能命中
  var dt = 1 / 60;
  for (var w = 0; w < 100; w++) b.update(dt, {});   // 等待 intro 结束进入战斗
  b.update(dt, { p1: { ult: true }, p2: {} });      // 触发大招
  for (var k = 0; k < 120; k++) b.update(dt, { p1: {}, p2: {} });
  var used = b.p1.ult === null && b.p1.state !== 'ult';
  var dealt = b.p2.hp < b.p2.maxHp;
  console.log('  ' + wid + ': 释放' + (used ? '正常' : '异常!') + ' 命中=' + (dealt ? '是' : '否!') +
    ' B剩余血量=' + b.p2.hp.toFixed(0) + '/' + b.p2.maxHp);
  if (!used) failures++;
  if (!dealt) failures++;
});

// ---- 测试3：录像 → 回放 一致性（最终HP应完全一致） ----
console.log('== 测试3：录像回放一致性 ==');
(function () {
  var r = runBattle({
    p1: { weapon: 'sword' }, p2: { weapon: 'hammer' },
    p1ai: { aggr: 0.6, block: 0.3, jump: 0.1, reaction: 0.3 },
    p2ai: { aggr: 0.6, block: 0.3, jump: 0.1, reaction: 0.3 }
  }, true);
  if (!r.rec) { failures++; console.log('  录像未保存!'); return; }
  // 用原始帧回放
  var p = SG.Replay.beginPlayback(r.rec);
  var b2 = new SG.Battle({
    mode: 'replay', stage: 'dojo', roundsToWin: 2, roundTime: 60,
    p1: { name: '甲', custom: Object.assign(SG.DATA.defaultCustom(), { weapon: 'sword' }), ctrl: 'human' },
    p2: { name: '乙', custom: Object.assign(SG.DATA.defaultCustom(), { weapon: 'hammer' }), ctrl: 'human' },
    onEvent: function () {}
  });
  var dt = 1 / 60, guard = 0;
  while (guard++ < 60 * 300) {
    var inp = SG.Replay.nextInputs();
    if (inp === null) break;
    b2.update(dt, inp);
  }
  var sameHp = Math.abs(b2.p1.hp - r.battle.p1.hp) < 0.001 && Math.abs(b2.p2.hp - r.battle.p2.hp) < 0.001;
  var sameX = Math.abs(b2.p1.x - r.battle.p1.x) < 0.001 && Math.abs(b2.p2.x - r.battle.p2.x) < 0.001;
  console.log('  帧数=' + SG.Replay.player.frames.length +
    ' HP一致=' + sameHp + '(' + b2.p1.hp.toFixed(1) + '/' + r.battle.p1.hp.toFixed(1) + ')' +
    ' 位置一致=' + sameX);
  if (!sameHp || !sameX) failures++;
  SG.Replay.endPlayback();
})();

// ---- 测试4：故事模式全部Boss可击败（高攻击AI vs Boss） ----
console.log('== 测试4：6个故事Boss ==');
SG.DATA.STORY.forEach(function (lv) {
  var r = runBattle({
    mode: 'story', stage: lv.stage, roundsToWin: 1,
    p1: { weapon: 'sword', name: '勇者' },
    p2: { weapon: lv.boss.custom.weapon, name: lv.boss.name },
    p1ai: { aggr: 0.75, block: 0.35, jump: 0.12, reaction: 0.25 },
    p2ai: lv.boss.ai
  }, false);
  var ok = r.done;
  console.log('  L' + lv.id + ' ' + lv.boss.name + ': ' + (ok ? '完成' : '超时!') +
    (r.result ? ' 胜者=' + (r.result.winner === 'p1' ? '勇者' : lv.boss.name) : '') + ' 用时' + r.simTime.toFixed(0) + 's');
  if (!ok) failures++;
});

// ---- 测试5：RLE 编解码往返 ----
console.log('== 测试5：RLE往返 ==');
(function () {
  var frames = [];
  for (var i = 0; i < 1000; i++) frames.push([i < 500 ? 3 : 258, i % 7 === 0 ? 16 : 0]);
  // RLE 编解码往返验证
  var out = [], cur = null, run = 0;
  for (var j = 0; j < frames.length; j++) {
    var f = frames[j];
    if (cur && cur[0] === f[0] && cur[1] === f[1]) run++;
    else { if (cur) out.push(cur[0], cur[1], run); cur = f; run = 1; }
  }
  if (cur) out.push(cur[0], cur[1], run);
  var dec = [];
  for (var k2 = 0; k2 < out.length; k2 += 3) {
    for (var r2 = 0; r2 < out[k2 + 2]; r2++) dec.push([out[k2], out[k2 + 1]]);
  }
  var same = dec.length === frames.length && frames.every(function (f, idx) { return f[0] === dec[idx][0] && f[1] === dec[idx][1]; });
  console.log('  压缩 ' + frames.length * 2 + ' → ' + out.length + ' 数字, 往返一致=' + same);
  if (!same) failures++;
})();

console.log(failures === 0 ? '\n✅ 全部测试通过' : '\n❌ 有 ' + failures + ' 处失败');
process.exit(failures === 0 ? 0 : 1);
