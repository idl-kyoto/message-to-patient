// 使い方: node test/check.js ["資料のmdのパス"]
// 足首用（check-ankle.js）と共通用（check-base.js）を順に実行する。一方でも失敗すれば、終了コードは1
const { spawnSync } = require('child_process');
const path = require('path');
const jobs = [
  ['足首用', 'check-ankle.js', process.argv.slice(2)],
  ['共通用（白紙・骨粗鬆症・2階）', 'check-base.js', []]
];
let failed = 0;
jobs.forEach(([label, file, args]) => {
  console.log('==== ' + label + '（' + file + '）');
  const r = spawnSync(process.execPath, [path.join(__dirname, file), ...args], { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  const lines = (r.stdout || '').split('\n');
  const pass = lines.filter(l => l.startsWith('○')).length, fail = lines.filter(l => l.startsWith('×')).length;
  console.log('---- ' + label + '：○ ' + pass + '件、× ' + fail + '件');
  if (r.status !== 0) failed++;
});
console.log(failed ? '失敗あり（' + failed + '組）' : 'すべての組が ○');
process.exit(failed ? 1 : 0);
