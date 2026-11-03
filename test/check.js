// 使い方: node test/check.js ["資料のmdのパス"]
const fs = require('fs'), path = require('path');
const M = require('../core.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/ankle-sprain-acute.json'), 'utf8'));
const md = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let ng = 0;
const ok = (c, m) => { console.log((c ? '○ ' : '× ') + m); if (!c) ng++; };
const fresh = () => M.initialState(data);
const CT = { phone: '000-0000-0000', emergency: '000-0000-0001' };

// 2. 全変数を選ぶ（single は先頭の非空欄、multi は none 以外すべて）→ JSONの文と完全一致
const st = fresh();
const expected = [];
data.sections.forEach(s => {
  const lines = [];
  data.variables.filter(v => v.section === s.id).forEach(v => {
    let pick;
    if (v.type === 'multi') { pick = v.options.filter(o => !o.none); pick.forEach(o => M.setChoice(data, st, v.id, o.id, true)); }
    else { const o = v.options.find(o => o.text) || v.options[0]; M.setChoice(data, st, v.id, o.id, true); pick = [o]; }
    pick.forEach(o => { if (!o.none) lines.push(o.text); });
  });
  if (lines.length) expected.push(s.name, ...lines);
});
expected.push(data.fixedNotice.body, ...data.fixedNotice.contacts.map(c => c.label + '：' + c.placeholder));
ok(M.sheetToText(M.buildSheet(data, st, {}, {})) === expected.join('\n'), '2 プレビューとJSONの文が完全一致');

// 資料との一致（JSONの各文が資料の行にそのまま含まれる）
if (md) {
  const all = data.variables.flatMap(v => v.options.filter(o => o.text).map(o => o.text));
  ok(all.every(t => md.includes(t)), '資料の文とJSONの文が一致（' + all.length + '件）');
  ok(md.includes(data.fixedNotice.body), '資料と注意書きの本文が一致');
}

// 3
let r = M.inspect(data, fresh(), {});
ok(r.blockers.some(b => b.includes('固定')) && r.blockers.some(b => b.includes('早期からできる運動')), '3 single・multi の未選択は印刷不可');
// 4
const s4 = fresh(); const mv = data.variables.find(v => v.type === 'multi');
M.setChoice(data, s4, mv.id, 'calf', true); M.setChoice(data, s4, mv.id, 'none', true);
const a = s4.sel[mv.id].join();
M.setChoice(data, s4, mv.id, 'toes', true);
ok(a === 'none' && s4.sel[mv.id].join() === 'toes', '4 該当なしと他は同時に選べない');
// 5
const s5 = fresh();
data.variables.forEach(v => { if (v.type !== 'always') { const o = v.options.find(o => o.none) || v.options.find(o => o.text) || v.options[0]; M.setChoice(data, s5, v.id, o.id, true); } });
const noneOnlyR = M.inspect(data, s5, {}, CT);
ok(noneOnlyR.blockers.length === 2 && noneOnlyR.blockers.every(b => /入浴|仕事/.test(b)), '5 空欄の文は印刷不可（入浴・仕事のみ）');
const ov = { 'bathing.ok': 'x', 'work.off': 'x' };
ok(M.inspect(data, s5, ov, CT).blockers.length === 0, '5 none=true の選択肢は印刷可（文を入れれば全体も可）');
// 6
const s6 = fresh();
ok(s6.sel.surgery.join() === 'text', '6 always は最初から選択');
M.setChoice(data, s6, 'surgery', 'text', false);
ok(s6.sel.surgery.join() === 'text', '6 always は外せない');
const edited = M.buildSheet(data, s6, { 'surgery.text': '編集後' }, {});
ok(edited.sections[0].items[0].texts[0] === '編集後', '6 always の文は編集できる');
// 7 注意書き
ok(M.inspect({ ...data, fixedNotice: { ...data.fixedNotice, body: '' } }, fresh(), {}).blockers.some(b => b.includes('注意書き')), '7 注意書きがなければ印刷不可');
ok(M.buildSheet(data, fresh(), { 'x': 'y' }, {}).notice.body === data.fixedNotice.body, '7 注意書きの本文は上書きされない');
// 連絡先
const full = fresh();
data.variables.forEach(v => { if (v.type !== 'always') { const o = v.options.find(o => o.none) || v.options.find(o => o.text) || v.options[0]; M.setChoice(data, full, v.id, o.id, true); } });
const fill = { 'bathing.ok': 'x', 'work.off': 'x' };
const nb = c => M.inspect(data, full, fill, c).blockers.filter(b => b.includes('連絡先'));
ok(nb({}).length === 1, '連絡先が空欄のとき印刷不可');
ok(nb({ phone: '[医療機関の電話番号]', emergency: '[緊急時の連絡先]' }).length === 1, '仮の表記のままのとき印刷不可');
ok(nb({ phone: CT.phone }).length === 1 && nb({ emergency: CT.emergency }).length === 1, '1項目だけ設定したとき印刷不可');
ok(nb(CT).length === 0 && M.inspect(data, full, fill, CT).blockers.length === 0, '2項目とも設定すると印刷可');
// rules
const rd = { ...data, rules: [{ id: 't', when: [{ variable: 'elevation', option: 'yes' }], message: 'テスト' }] };
const s8 = fresh(); M.setChoice(rd, s8, 'elevation', 'yes', true);
ok(M.inspect(rd, s8, {}).warnings.join() === 'テスト', 'rules 一致で警告');
console.log(ng ? ng + '件 ×' : 'すべて ○');
process.exit(ng ? 1 : 0);
