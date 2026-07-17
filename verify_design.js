// 驗證改造後的設計（7 屬性：school/degree/tenure/rank/cred/beat/award）
// 載入真實 config.js，複製 index.html 的配對邏輯，跑模擬檢查收斂性與水準平衡。
// 用法：node verify_design.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 載入 config.js 到 sandbox（const 宣告不掛 global，故在尾端顯式導出）
const cfg = fs.readFileSync(path.join(__dirname, 'config.js'), 'utf8');
const ctx = { console, __out: {} };
vm.createContext(ctx);
vm.runInContext(cfg + `
__out.ATTRS=ATTRS; __out.ATTR_KEYS=ATTR_KEYS; __out.EDU_KEYS=EDU_KEYS; __out.SOLO_KEYS=SOLO_KEYS;
__out.CHUNK_KEYS=CHUNK_KEYS; __out.DESIGN=DESIGN; __out.NAME_POOL=NAME_POOL;
__out.buildEduChunk=buildEduChunk; __out.buildRoleChunk=buildRoleChunk; __out.buildSentenceBody=buildSentenceBody;
`, ctx);
const { ATTRS, ATTR_KEYS, EDU_KEYS, SOLO_KEYS, CHUNK_KEYS, DESIGN,
        buildEduChunk, buildRoleChunk, buildSentenceBody, NAME_POOL } = ctx.__out;

console.log('=== 1. 屬性檢查 ===');
console.log('屬性數:', ATTRS.length, '| keys:', ATTR_KEYS.join(', '));
console.log('EDU_KEYS:', EDU_KEYS.join(','), '| SOLO_KEYS:', SOLO_KEYS.join(','), '| CHUNK_KEYS:', CHUNK_KEYS.join(','));
const hasMajor = ATTR_KEYS.includes('major');
const hasAward = ATTR_KEYS.includes('award');
console.log(hasMajor ? '✗ major 仍存在（應已砍）' : '✓ major 已砍');
console.log(hasAward ? '✓ award 已加入' : '✗ award 未加入');
ATTRS.forEach(a => console.log(`   ${a.key}(${a.name}): ${a.levels.length} 水準 [${a.levels.map(l=>l.label).join('/')}]`));

// ---- 複製 index.html 的配對邏輯 ----
const rand = arr => arr[Math.floor(Math.random()*arr.length)];
const STRENGTH = ['cred','tenure','award'];
const MIN_DIFF = ATTR_KEYS.length - 3;
function prohibited(p){ const t=p.tenure,r=p.rank; if(t===2&&r===3)return true; if(t===4&&r===2)return true; return false; }
const OMIT_IDX={school:3,degree:3,cred:1,tenure:1,rank:1,beat:1,award:1};
const MAX_OMIT=3;
function nOmitted(p){ return ATTR_KEYS.reduce((n,k)=>n+(p[k]===OMIT_IDX[k]?1:0),0); }
function tooEmpty(p){ return nOmitted(p)>MAX_OMIT; }
function randProfile(){ let p,g=0; do{ p={}; ATTRS.forEach(a=>{p[a.key]=rand(a.levels).idx;}); g++; }while((prohibited(p)||tooEmpty(p))&&g<500); return p; }
function diffCount(A,B){ return ATTR_KEYS.reduce((n,k)=>n+(A[k]!==B[k]?1:0),0); }
function strengthWins(A,B){ return STRENGTH.some(k=>A[k]>B[k]); }
function identical(A,B){ return ATTR_KEYS.every(k=>A[k]===B[k]); }
function eduVisible(p){ return buildEduChunk(p)?1:0; }
function roleVisible(p){ return buildRoleChunk(p)?1:0; }
function visibleClauses(p){ return eduVisible(p)+roleVisible(p)+(p.cred!==1?1:0)+(p.tenure!==1?1:0)+(p.award!==1?1:0); }
function bodyLen(p){ return buildSentenceBody(p, CHUNK_KEYS, p.credVar, p.awardVar).length; }
function nVariants(key, idx){ const lv=ATTRS.find(a=>a.key===key).levels.find(l=>l.idx===idx); return (lv&&lv.phraseVariants&&lv.phraseVariants.length)||1; }
function tuneCredLen(A,B){
  let best=null,bestDiff=Infinity;
  for(let i=0;i<nVariants('cred',A.cred);i++) for(let j=0;j<nVariants('cred',B.cred);j++)
  for(let m=0;m<nVariants('award',A.award);m++) for(let n=0;n<nVariants('award',B.award);n++){
    A.credVar=i;B.credVar=j;A.awardVar=m;B.awardVar=n;
    const d=Math.abs(bodyLen(A)-bodyLen(B));
    if(d<bestDiff){bestDiff=d;best=[i,j,m,n];}
  }
  if(best){A.credVar=best[0];B.credVar=best[1];A.awardVar=best[2];B.awardVar=best[3];}
  return bestDiff;
}
function makePairMatched(){
  let A,B,guard=0;
  do{
    A=randProfile();B=randProfile();A.credVar=null;B.credVar=null;A.awardVar=null;B.awardVar=null;guard++;
    if(identical(A,B)||diffCount(A,B)<MIN_DIFF||!strengthWins(A,B)||!strengthWins(B,A)||visibleClauses(A)!==visibleClauses(B)) continue;
    tuneCredLen(A,B);
    if(Math.abs(bodyLen(A)-bodyLen(B))<=8) break;
  } while(guard<15000);
  return {pair:[A,B], guard};
}
const MAX_FREE_LEN_DIFF=12;
function makePairFree(){
  let A,B,guard=0;
  do{ A=randProfile();B=randProfile();A.credVar=null;B.credVar=null;A.awardVar=null;B.awardVar=null;guard++; }
  while(guard<15000&&(identical(A,B)||diffCount(A,B)<MIN_DIFF||!strengthWins(A,B)||!strengthWins(B,A)||Math.abs(visibleClauses(A)-visibleClauses(B))!==1||Math.abs(bodyLen(A)-bodyLen(B))>MAX_FREE_LEN_DIFF));
  return {pair:[A,B], guard};
}

console.log('\n=== 2. 句子組裝範例（含 award）===');
for(let i=0;i<6;i++){
  const p=randProfile();
  const name=rand(NAME_POOL);
  console.log(`  ${name}${buildSentenceBody(p, CHUNK_KEYS, null, null)}`);
  console.log(`     [school=${p.school} degree=${p.degree} tenure=${p.tenure} rank=${p.rank} cred=${p.cred} beat=${p.beat} award=${p.award}]`);
}

console.log('\n=== 3. 配對模擬（matched 組 N=3000）===');
const N=3000;
let failM=0, guardSum=0, lenDiffs=[];
const lvlCount={}; ATTR_KEYS.forEach(k=>lvlCount[k]={});
for(let i=0;i<N;i++){
  const {pair,guard}=makePairMatched();
  const [A,B]=pair;
  guardSum+=guard;
  if(guard>=15000){ failM++; continue; }
  lenDiffs.push(Math.abs(bodyLen(A)-bodyLen(B)));
  [A,B].forEach(p=>ATTR_KEYS.forEach(k=>{ lvlCount[k][p[k]]=(lvlCount[k][p[k]]||0)+1; }));
}
console.log(`  收斂失敗: ${failM}/${N} (${(failM*100/N).toFixed(2)}%)`);
console.log(`  平均嘗試次數: ${(guardSum/N).toFixed(1)}`);
console.log(`  長度差: 平均 ${(lenDiffs.reduce((a,b)=>a+b,0)/lenDiffs.length).toFixed(2)} 字, 最大 ${Math.max(...lenDiffs)}`);

console.log('\n=== 4. 水準曝光平衡（matched 組，檢查 award 加入 STRENGTH 後是否稀釋）===');
ATTR_KEYS.forEach(k=>{
  const attr=ATTRS.find(a=>a.key===k);
  const total=Object.values(lvlCount[k]).reduce((a,b)=>a+b,0);
  const parts=attr.levels.map(l=>{
    const c=lvlCount[k][l.idx]||0;
    return `${l.label}:${(c*100/total).toFixed(1)}%`;
  });
  const pcts=attr.levels.map(l=>(lvlCount[k][l.idx]||0)*100/total);
  const flag = Math.min(...pcts)<15 ? '  ⚠ 有水準<15%' : '';
  console.log(`  ${k}: ${parts.join('  ')}${flag}`);
});

console.log('\n=== 5. free 組收斂 (N=1000) ===');
let failF=0;
for(let i=0;i<1000;i++){ const {guard}=makePairFree(); if(guard>=15000) failF++; }
console.log(`  收斂失敗: ${failF}/1000 (${(failF/10).toFixed(2)}%)`);

console.log('\n=== 6. 禁制組合檢查 ===');
let violate=0;
for(let i=0;i<2000;i++){ const p=randProfile(); if(prohibited(p)) violate++; }
console.log(`  違反禁制組合: ${violate}/2000 ${violate===0?'✓':'✗'}`);
