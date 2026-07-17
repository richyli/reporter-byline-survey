// 量測：(1) 措辭變體觸發頻率 (2)「不提」數量分布 (3) 長短差分布 — 供使用者決定約束
const fs = require('fs'), path = require('path'), vm = require('vm');
const cfg = fs.readFileSync(path.join(__dirname, 'config.js'), 'utf8');
const ctx = { console, __out: {} };
vm.createContext(ctx);
vm.runInContext(cfg + `
__out.ATTRS=ATTRS; __out.ATTR_KEYS=ATTR_KEYS; __out.CHUNK_KEYS=CHUNK_KEYS;
__out.buildEduChunk=buildEduChunk; __out.buildRoleChunk=buildRoleChunk; __out.buildSentenceBody=buildSentenceBody;
`, ctx);
const { ATTRS, ATTR_KEYS, CHUNK_KEYS, buildEduChunk, buildRoleChunk, buildSentenceBody } = ctx.__out;

const rand = a => a[Math.floor(Math.random() * a.length)];
const STRENGTH = ['cred', 'tenure', 'award'];
const MIN_DIFF = ATTR_KEYS.length - 3;
function prohibited(p) { const t = p.tenure, r = p.rank; if (t === 2 && r === 3) return true; if (t === 4 && r === 2) return true; return false; }
const OMIT_IDX={school:3,degree:3,cred:1,tenure:1,rank:1,beat:1,award:1};
const MAX_OMIT=3;
function nOmitted(p){ return ATTR_KEYS.reduce((n,k)=>n+(p[k]===OMIT_IDX[k]?1:0),0); }
function tooEmpty(p){ return nOmitted(p)>MAX_OMIT; }
function randProfile() { let p, g = 0; do { p = {}; ATTRS.forEach(a => { p[a.key] = rand(a.levels).idx; }); g++; } while ((prohibited(p)||tooEmpty(p)) && g < 500); return p; }
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
const MAX_FREE_LEN_DIFF=12;
function makePairFree() {
  let A, B, guard = 0;
  do { A = randProfile(); B = randProfile(); A.credVar=null;B.credVar=null;A.awardVar=null;B.awardVar=null; guard++; }
  while (guard < 15000 && (identical(A, B) || diffCount(A, B) < MIN_DIFF || !strengthWins(A, B) || !strengthWins(B, A) || Math.abs(visibleClauses(A)-visibleClauses(B))!==1 || Math.abs(bodyLen(A)-bodyLen(B))>MAX_FREE_LEN_DIFF));
  return [A, B];
}
// 「不提」計數沿用上方 OMIT_IDX / nOmitted

const N = 3000;
console.log('=== (1) 措辭變體觸發頻率（matched 組 N=' + N + '）===');
let credDiffVer = 0, awardDiffVer = 0, anyDiffVer = 0, credBothPresent = 0, awardBothPresent = 0;
let credShortest = 0, awardShortest = 0;
const lenDiffs = [], omitA = [], omitB = [], clausesArr = [];
for (let i = 0; i < N; i++) {
  const [A, B] = makePairMatched();
  lenDiffs.push(Math.abs(bodyLen(A) - bodyLen(B)));
  omitA.push(nOmitted(A)); omitB.push(nOmitted(B));
  clausesArr.push(visibleClauses(A));
  const cA = A.cred !== 1, cB = B.cred !== 1;
  const aA = A.award !== 1, aB = B.award !== 1;
  if (cA && cB) { credBothPresent++; if (A.credVar !== B.credVar) credDiffVer++; }
  if (aA && aB) { awardBothPresent++; if (A.awardVar !== B.awardVar) awardDiffVer++; }
  if ((cA && cB && A.credVar !== B.credVar) || (aA && aB && A.awardVar !== B.awardVar)) anyDiffVer++;
  // 最短版本使用率（cred 有 4 版、award 3 版）
  [[A, 'cred'], [B, 'cred']].forEach(([p, k]) => { if (p[k] !== 1 && p.credVar === nVariants('cred', p.cred) - 1) credShortest++; });
  [[A, 'award'], [B, 'award']].forEach(([p, k]) => { if (p[k] !== 1 && p.awardVar === nVariants('award', p.award) - 1) awardShortest++; });
}
console.log(`  兩卡都有證照的題數: ${credBothPresent} (${(credBothPresent * 100 / N).toFixed(1)}%)`);
console.log(`    其中措辭版本不同: ${credDiffVer} (${credBothPresent ? (credDiffVer * 100 / credBothPresent).toFixed(1) : 0}% of 兩卡都有證照)`);
console.log(`  兩卡都有得獎的題數: ${awardBothPresent} (${(awardBothPresent * 100 / N).toFixed(1)}%)`);
console.log(`    其中措辭版本不同: ${awardDiffVer} (${awardBothPresent ? (awardDiffVer * 100 / awardBothPresent).toFixed(1) : 0}% of 兩卡都有得獎)`);
console.log(`  ⚠ 整題「至少一屬性措辭版本不同」: ${anyDiffVer}/${N} (${(anyDiffVer * 100 / N).toFixed(1)}%)`);
console.log(`  最短版本(如「證券高業」)出現次數: cred ${credShortest} / award ${awardShortest}（共 ${N * 2} 張卡）`);

console.log('\n=== (2)「不提」數量分布（每張卡 7 屬性中有幾個不提）===');
const allOmit = omitA.concat(omitB);
const omitDist = {};
allOmit.forEach(o => omitDist[o] = (omitDist[o] || 0) + 1);
Object.keys(omitDist).sort((a, b) => a - b).forEach(k => {
  console.log(`  不提 ${k} 項: ${omitDist[k]} 張 (${(omitDist[k] * 100 / allOmit.length).toFixed(1)}%)`);
});
console.log(`  平均不提 ${(allOmit.reduce((a, b) => a + b, 0) / allOmit.length).toFixed(2)} 項 / 7`);
console.log(`  最多不提: ${Math.max(...allOmit)} 項`);

console.log('\n=== (3) 長度差分布（matched 組）===');
const ld = {};
lenDiffs.forEach(d => ld[d] = (ld[d] || 0) + 1);
Object.keys(ld).sort((a, b) => a - b).forEach(k => console.log(`  差 ${k} 字: ${ld[k]} (${(ld[k] * 100 / N).toFixed(1)}%)`));

console.log('\n=== (4) free 組長短差（子句數差）===');
const freeDiff = [], freeLenDiff = [];
for (let i = 0; i < 1000; i++) {
  const [A, B] = makePairFree();
  freeDiff.push(Math.abs(visibleClauses(A) - visibleClauses(B)));
  freeLenDiff.push(Math.abs(bodyLen(A) - bodyLen(B)));
}
const fd = {};
freeDiff.forEach(d => fd[d] = (fd[d] || 0) + 1);
Object.keys(fd).sort((a, b) => a - b).forEach(k => console.log(`  子句數差 ${k}: ${fd[k]} (${(fd[k] / 10).toFixed(1)}%)`));
console.log(`  字數差: 平均 ${(freeLenDiff.reduce((a, b) => a + b, 0) / freeLenDiff.length).toFixed(1)}, 最大 ${Math.max(...freeLenDiff)}`);
