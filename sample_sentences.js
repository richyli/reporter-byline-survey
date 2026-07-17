// 產出樣本句子供人工檢視：單句樣貌 + 實際配對（受訪者真正看到的形式）
const fs = require('fs'), path = require('path'), vm = require('vm');
const cfg = fs.readFileSync(path.join(__dirname, 'config.js'), 'utf8');
const ctx = { console, __out: {} };
vm.createContext(ctx);
vm.runInContext(cfg + `
__out.ATTRS=ATTRS; __out.ATTR_KEYS=ATTR_KEYS; __out.CHUNK_KEYS=CHUNK_KEYS; __out.NAME_POOL=NAME_POOL;
__out.buildEduChunk=buildEduChunk; __out.buildRoleChunk=buildRoleChunk; __out.buildSentenceBody=buildSentenceBody;
__out.OUTLETS=OUTLETS; __out.TASKS=TASKS;
`, ctx);
const { ATTRS, ATTR_KEYS, CHUNK_KEYS, NAME_POOL, buildEduChunk, buildRoleChunk,
        buildSentenceBody, OUTLETS, TASKS } = ctx.__out;

const rand = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const STRENGTH = ['cred', 'tenure', 'award'];
const MIN_DIFF = ATTR_KEYS.length - 3;
function prohibited(p) { const t = p.tenure, r = p.rank; if (t === 2 && r === 3) return true; if (t === 4 && r === 2) return true; return false; }
function randProfile() { let p, g = 0; do { p = {}; ATTRS.forEach(a => { p[a.key] = rand(a.levels).idx; }); g++; } while (prohibited(p) && g < 200); return p; }
function diffCount(A, B) { return ATTR_KEYS.reduce((n, k) => n + (A[k] !== B[k] ? 1 : 0), 0); }
function strengthWins(A, B) { return STRENGTH.some(k => A[k] > B[k]); }
function identical(A, B) { return ATTR_KEYS.every(k => A[k] === B[k]); }
function eduVisible(p) { return buildEduChunk(p) ? 1 : 0; }
function roleVisible(p) { return buildRoleChunk(p) ? 1 : 0; }
function visibleClauses(p) { return eduVisible(p) + roleVisible(p) + (p.cred !== 1 ? 1 : 0) + (p.tenure !== 1 ? 1 : 0) + (p.award !== 1 ? 1 : 0); }
function bodyLen(p) { return buildSentenceBody(p, CHUNK_KEYS, p.credVar, p.awardVar).length; }
function nVariants(key, idx) { const lv = ATTRS.find(a => a.key === key).levels.find(l => l.idx === idx); return (lv && lv.phraseVariants && lv.phraseVariants.length) || 1; }
function tuneCredLen(A, B) {
  let best = null, bestDiff = Infinity;
  for (let i = 0; i < nVariants('cred', A.cred); i++) for (let j = 0; j < nVariants('cred', B.cred); j++)
    for (let m = 0; m < nVariants('award', A.award); m++) for (let n = 0; n < nVariants('award', B.award); n++) {
      A.credVar = i; B.credVar = j; A.awardVar = m; B.awardVar = n;
      const d = Math.abs(bodyLen(A) - bodyLen(B));
      if (d < bestDiff) { bestDiff = d; best = [i, j, m, n]; }
    }
  if (best) { A.credVar = best[0]; B.credVar = best[1]; A.awardVar = best[2]; B.awardVar = best[3]; }
  return bestDiff;
}
function makePairMatched() {
  let A, B, guard = 0;
  do {
    A = randProfile(); B = randProfile(); A.credVar = null; B.credVar = null; A.awardVar = null; B.awardVar = null; guard++;
    if (identical(A, B) || diffCount(A, B) < MIN_DIFF || !strengthWins(A, B) || !strengthWins(B, A) || visibleClauses(A) !== visibleClauses(B)) continue;
    tuneCredLen(A, B);
    if (Math.abs(bodyLen(A) - bodyLen(B)) <= 8) break;
  } while (guard < 15000);
  return [A, B];
}
function makePairFree() {
  let A, B, guard = 0;
  do { A = randProfile(); B = randProfile(); guard++; }
  while (guard < 15000 && (identical(A, B) || diffCount(A, B) < MIN_DIFF || !strengthWins(A, B) || !strengthWins(B, A) || visibleClauses(A) === visibleClauses(B)));
  return [A, B];
}
// 受訪者內固定的塊順序
const chunkOrder = shuffle(CHUNK_KEYS);
const sent = (p, name) => name + buildSentenceBody(p, chunkOrder, p.credVar, p.awardVar);

console.log('本樣本的塊順序（受訪者內固定隨機）:', chunkOrder.join(' → '));
console.log('\n' + '='.repeat(78));
console.log('【A】單句樣貌（各種情境）');
console.log('='.repeat(78) + '\n');

// 手工指定情境，展示極端與典型
const scenarios = [
  { name: '全部揭露（資深＋國外獎＋分析師）', p: { school: 1, degree: 2, cred: 3, tenure: 4, rank: 3, beat: 2, award: 3 } },
  { name: '全部揭露（資淺＋國內獎＋高業）', p: { school: 2, degree: 1, cred: 2, tenure: 2, rank: 2, beat: 3, award: 2 } },
  { name: '什麼都不提（極簡）', p: { school: 3, degree: 3, cred: 1, tenure: 1, rank: 1, beat: 1, award: 1 } },
  { name: '只有學歷', p: { school: 1, degree: 2, cred: 1, tenure: 1, rank: 1, beat: 1, award: 1 } },
  { name: '只有得獎（國外）', p: { school: 3, degree: 3, cred: 1, tenure: 1, rank: 1, beat: 1, award: 3 } },
  { name: '無學歷但資深有獎', p: { school: 3, degree: 3, cred: 3, tenure: 4, rank: 3, beat: 2, award: 3 } },
  { name: '私立學士（warranting 測試）', p: { school: 2, degree: 1, cred: 1, tenure: 3, rank: 2, beat: 3, award: 1 } },
  { name: '國立碩士無其他', p: { school: 1, degree: 2, cred: 1, tenure: 1, rank: 2, beat: 1, award: 1 } },
];
scenarios.forEach((s, i) => {
  const nm = NAME_POOL[i % NAME_POOL.length];
  console.log(`${(i + 1 + '').padStart(2)}. [${s.name}]`);
  console.log(`    ${sent(s.p, nm)}`);
  console.log('');
});

console.log('='.repeat(78));
console.log('【B】實際配對（受訪者一題看到的兩張卡）— 長度匹配組');
console.log('='.repeat(78) + '\n');
const outlet = rand(OUTLETS);
for (let i = 0; i < 5; i++) {
  const [A, B] = makePairMatched();
  const nA = NAME_POOL[(i * 2) % NAME_POOL.length], nB = NAME_POOL[(i * 2 + 1) % NAME_POOL.length];
  const dv = i % 2 === 0 ? TASKS.read : TASKS.wary;
  console.log(`── 第 ${i + 1} 題（${dv.title}）`);
  console.log(`   題幹：${dv.prompt.replaceAll('{OUTLET}', outlet.name).replace(/<\/?b>/g, '')}`);
  console.log(`   A. ${sent(A, nA)}`);
  console.log(`   B. ${sent(B, nB)}`);
  console.log(`      (字數 A=${bodyLen(A)} B=${bodyLen(B)}，差 ${Math.abs(bodyLen(A) - bodyLen(B))})`);
  console.log('');
}

console.log('='.repeat(78));
console.log('【C】實際配對 — 長度不限組（故意有長短差，測揭露多寡效果）');
console.log('='.repeat(78) + '\n');
for (let i = 0; i < 3; i++) {
  const [A, B] = makePairFree();
  const nA = NAME_POOL[(i * 2) % NAME_POOL.length], nB = NAME_POOL[(i * 2 + 1) % NAME_POOL.length];
  console.log(`── 第 ${i + 1} 題`);
  console.log(`   A. ${sent(A, nA)}`);
  console.log(`   B. ${sent(B, nB)}`);
  console.log(`      (子句數 A=${visibleClauses(A)} B=${visibleClauses(B)})`);
  console.log('');
}
