// 使い方: node test/check.js
const fs = require('fs'), path = require('path');
const M = require('../core.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/blank.json'), 'utf8'));
let ng = 0;
const ok = (c, m) => { console.log((c ? '○ ' : '× ') + m); if (!c) ng++; };
const CT = { phone: '000-0000-0000', emergency: '000-0000-0001' };
const st = () => M.initialState(data);

ok(data.sections.length === 0 && data.variables.length === 0 && data.rules.length === 0, 'sections、variables、rules がすべて空');
const text = M.sheetToText(M.buildSheet(data, st(), {}, CT));
const expected = [data.fixedNotice.body, ...data.fixedNotice.contacts.map((c, i) => c.label + '：' + [CT.phone, CT.emergency][i])].join('\n');
ok(data.fixedNotice.contacts.length === 2 && text === expected, '書面の本文が、注意書きの本文と連絡先の2行だけ');
const r0 = M.inspect(data, st(), {}, {});
ok(r0.blockers.length === 1 && r0.blockers[0] === '連絡先が未設定です', '連絡先が未設定のとき、印刷不可の理由は「連絡先が未設定です」の1件だけ');
ok(M.inspect(data, st(), {}, CT).blockers.length === 0, '連絡先を設定すると、印刷不可の理由が0件');
const nb = { ...data, fixedNotice: { ...data.fixedNotice, body: '' } };
ok(M.inspect(nb, st(), {}, CT).blockers.some(b => b.includes('注意書き')), '注意書きの本文が空のとき、印刷不可の理由に「注意書き」が含まれる');
// ---- 骨粗鬆症の運動処方箋 ----
let od = null;
try { od = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/osteoporosis-exercise.json'), 'utf8')); } catch (e) {}
ok(od !== null, '骨粗鬆症：JSONとして読める');
if (od) {
  const vids = od.variables.map(v => v.id);
  ok(new Set(vids).size === vids.length, '骨粗鬆症：変数のidが重複していない');
  ok(od.variables.every(v => od.sections.some(s => s.id === v.section)), '骨粗鬆症：各変数のsectionがsectionsに存在する');
  ok(od.variables.filter(v => v.type === 'always').every(v => v.options.length === 1), '骨粗鬆症：always型の選択肢が1つだけ');
  const pick = sel => {
    const s = M.initialState(od);
    Object.entries(sel).forEach(([v, ids]) => ids.forEach(o => M.setChoice(od, s, v, o, true)));
    return s;
  };
  const cases = {
    A: { ability: ['hard'], exercises: ['quad', 'abduction', 'prone', 'adduction', 'aqua', 'bike'], sets: ['s3'] },
    B: { ability: ['slow'], exercises: ['quad', 'abs', 'back', 'squat', 'thigh_walk', 'step'], sets: ['s2'] },
    C: { ability: ['brisk'], exercises: ['abs', 'back', 'squat'], sets: ['s1'] }
  };
  Object.entries(cases).forEach(([k, sel]) => {
    const s = pick(sel);
    ok(M.inspect(od, s, {}, CT).blockers.length === 0, '骨粗鬆症：選択' + k + ' で blockers が空');
    ok(M.sheetToText(M.buildSheet(od, s, {}, CT)).includes(od.fixedNotice.body), '骨粗鬆症：選択' + k + ' の書面に注意書きの本文が含まれる');
  });
  const none = M.inspect(od, M.initialState(od), {}, CT).blockers;
  const want = ['選び忘れ：運動能力', '選び忘れ：行う運動', '選び忘れ：セット数'];
  ok(want.every(w => none.includes(w)) && none.length === 3, '骨粗鬆症：何も選ばないとき、選び忘れの3つだけが出る');
}
// ---- 2階（editor-core.js）----
const assert = require('assert');
const EC = require('../editor-core.js');
const blank = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/blank.json'), 'utf8'));
const same = (a, b) => { try { assert.deepStrictEqual(a, b); return true; } catch (e) { return false; } };
const codes = m => EC.validate(m).map(x => x.code);
if (od) {
  ok(same(EC.toJSON(EC.fromJSON(od)), od), '2階：骨粗鬆症のデータを読み込んで書き出すと、内容が完全に同じ');
  ok(codes(EC.fromJSON(od)).length === 0, '2階：骨粗鬆症のデータは、点検を通る');
}
ok(same(EC.toJSON(EC.fromJSON(blank)), blank), '2階：blank.json も、読み込んで書き出すと、完全に同じ');
{
  const em = EC.toJSON(EC.emptyModel(blank.fixedNotice));
  const es = M.initialState(em);
  const et = M.sheetToText(M.buildSheet(em, es, {}, CT));
  ok(em.id === 'new-disease' && em.variables.length === 1 && em.variables[0].options.length === 1 && et.includes(blank.fixedNotice.body), '2階：空のモデルから作ったJSONが、initialState と buildSheet で動く');
}
{
  const fresh2 = () => EC.fromJSON(od);
  const t = (label, code, mutate) => { const m = fresh2(); mutate(m); ok(codes(m).includes(code), '2階：点検（' + label + '）'); };
  t('病気の名前が空', 'title-empty', m => { m.title = ' '; });
  t('病気のIDが正規表現に合わない', 'id-invalid', m => { m.id = 'Bad_ID'; });
  t('変数の名前が空', 'var-name-empty', m => { m.variables[1].name = ''; });
  t('選択肢の名前が空', 'option-name-empty', m => { m.variables[1].options[0].name = ''; });
  t('選択肢が0個', 'no-options', m => { m.variables[1].options = []; });
  t('always の選択肢が1つでない', 'always-not-one', m => { m.variables[0].options.push({ id: 'x', name: 'x', text: '', none: false }); });
  t('同じ名前の選択肢', 'option-name-dup', m => { m.variables[1].options[1].name = m.variables[1].options[0].name; });
  t('中見出しが未選択', 'section-unset', m => { m.variables[1].section = ''; });
}
{
  const m = EC.fromJSON(od);
  const v = EC.addVariable(m), o = EC.addOption(m, v.id), sc = EC.addSection(m, 'x');
  ok(!od.variables.some(x => x.id === v.id) && new Set(v.options.map(x => x.id)).size === v.options.length && !od.sections.some(x => x.id === sc.id) && o.id !== v.options[0].id, '2階：新しい id が、既存の id と重複しない');
  ok(EC.newId('v', ['v1', 'v2', 'v4']) === 'v3', '2階：使われている番号は飛ばして、次の番号になる');
}
{
  const m = EC.fromJSON(od);
  const r = EC.setType(m, 'exercises', 'always');
  ok(!r.ok && r.message !== '' && m.variables.find(x => x.id === 'exercises').type === 'multi' && m.variables.find(x => x.id === 'exercises').options.length === 12, '2階：選択肢が2つ以上の変数を always に切り替えられない（選択肢は消えない）');
  const m2 = EC.fromJSON(od); m2.variables[1].type = 'always';
  ok(codes(m2).includes('always-not-one'), '2階：always の選択肢が2つ以上ある変数が、点検で止まる');
}
{
  const m = EC.fromJSON(od);
  const ids = () => m.variables.map(v => v.id);
  const before = ids();
  ok(EC.moveVariable(m, before[0], -1) === false && same(ids(), before), '2階：moveVariable：左端でさらに左へは、何もしない');
  ok(EC.moveVariable(m, before[before.length - 1], 1) === false && same(ids(), before), '2階：moveVariable：右端でさらに右へは、何もしない');
  ok(EC.moveVariable(m, before[1], -1) === true && ids()[0] === before[1] && ids()[1] === before[0] && ids().length === before.length, '2階：moveVariable：左へ動く');
  ok(EC.moveVariable(m, before[1], 1) === true && same(ids(), before), '2階：moveVariable：右へ動いて元に戻る');
  const ev = m.variables.find(v => v.id === 'exercises'), oids = () => ev.options.map(o => o.id), ob = oids();
  ok(EC.moveOption(m, 'exercises', ob[0], -1) === false && same(oids(), ob), '2階：moveOption：上端でさらに上へは、何もしない');
  ok(EC.moveOption(m, 'exercises', ob[ob.length - 1], 1) === false && same(oids(), ob), '2階：moveOption：下端でさらに下へは、何もしない');
  ok(EC.moveOption(m, 'exercises', ob[0], 1) === true && oids()[0] === ob[1] && oids()[1] === ob[0] && oids().length === ob.length, '2階：moveOption：下へ動く');
  ok(EC.moveOption(m, 'exercises', ob[0], -1) === true && same(oids(), ob), '2階：moveOption：上へ動いて元に戻る');
  ok(EC.isBlank(EC.emptyModel(blank.fixedNotice)) && !EC.isBlank(EC.fromJSON(od)), '2階：isBlank：空の下書きだけが、空と判定される');
}
console.log(ng ? ng + '件 ×' : 'すべて ○');
process.exit(ng ? 1 : 0);
