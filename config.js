/* R Reporter Byline — conjoint 設定（屬性、水準、句子模板、量表）
 * 設計依據：-work/Research/R Reporter Byline/analysis_output/attribute_levels.md
 * 句型：敘述句（NYT/Texas Tribune 風），7 屬性合併成一句記者簡介。
 *   學歷三屬性（school+major+degree）黏成一個「學歷塊」智慧組裝；
 *   其餘 4 屬性各自獨立成子句；子句（含學歷塊）以「塊」為單位隨機排序。
 * 情境：鎖定財經新聞。主選擇題：繼續閱讀意願。媒體脈絡 between-subject（中央社 vs 三立新聞）。
 */

/* ---- 7 屬性（財經情境 v2，全含「不提」＝揭露 vs 沉默框架）。
 *      強度屬性 cred(證照) idx 1<2<3 遞增；tenure(年資) idx 1不提/2=3年/3=10年/4=20年。
 *      label 供分析對照；token 供「學歷塊」(school/major/degree) 與「路線職級塊」(beat/rank) 組裝；
 *      phrase 供獨立子句（cred/tenure）。
 *      設計依據：study1_byline_content/design_memo_v2.md。 ---- */
const ATTRS = [
  {
    key: 'school', name: '學校層級', ordered: false, chunk: 'edu',
    levels: [
      { idx: 1, label: '國立大學', token: '國立大學' },
      { idx: 2, label: '私立大學', token: '私立大學' },
      { idx: 3, label: '不提',     token: null },        // 不提：學歷塊略去此細項
    ],
  },
  {
    key: 'major', name: '科系背景', ordered: false, chunk: 'edu',
    levels: [
      { idx: 1, label: '中文', token: '中文' },
      { idx: 2, label: '新聞', token: '新聞' },
      { idx: 3, label: '企管', token: '企管' },
      { idx: 4, label: '不提', token: null },            // 不提：學歷塊略去科系
    ],
  },
  {
    key: 'degree', name: '學位', ordered: false, chunk: 'edu',
    levels: [
      { idx: 1, label: '學士', token: '學士' },
      { idx: 2, label: '碩士', token: '碩士' },
      { idx: 3, label: '不提', token: null },            // 不提：學歷塊略去學位
    ],
  },
  {
    key: 'cred', name: '專業證照', ordered: true,
    levels: [
      { idx: 1, label: '無',           phrase: null },                       // 略去
      { idx: 2, label: '證券高級業務員', phrase: '具證券高級業務員資格' },
      { idx: 3, label: '證券分析師',     phrase: '具證券投資分析師資格' },
    ],
  },
  {
    key: 'tenure', name: '採訪年資', ordered: false,   // 含「不提」故非純有序；2/3/4 為 3<10<20 線性
    levels: [
      { idx: 1, label: '不提',  phrase: null },               // 略去
      { idx: 2, label: '3年',   phrase: '採訪資歷3年' },
      { idx: 3, label: '10年',  phrase: '採訪資歷10年' },
      { idx: 4, label: '20年',  phrase: '採訪資歷20年' },
    ],
  },
  {
    key: 'rank', name: '職級', ordered: false, chunk: 'role',   // 與 beat 黏成複合詞
    levels: [
      { idx: 1, label: '不提',   token: null },
      { idx: 2, label: '記者',   token: '記者' },
      { idx: 3, label: '資深記者', token: '資深記者' },
      { idx: 4, label: '主編',   token: '主編' },
    ],
  },
  {
    key: 'beat', name: '關注路線', ordered: false, chunk: 'role',   // 與 rank 黏成複合詞
    levels: [
      { idx: 1, label: '不提', token: null },
      { idx: 2, label: '金融', token: '金融' },
      { idx: 3, label: '證券', token: '證券' },
      { idx: 4, label: '產業', token: '產業' },
    ],
  },
];
const ATTR_KEYS = ATTRS.map(a => a.key);
const EDU_KEYS = ['school', 'major', 'degree'];          // 學歷塊內固定組裝順序
const ROLE_KEYS = ['beat', 'rank'];                      // 路線×職級複合詞塊
const SOLO_KEYS = ['cred', 'tenure'];                    // 各自獨立子句

/* ---- 性別平衡的中性中文姓名池（姓名非屬性、不分析；只為讓句子像真實 byline） ---- */
const NAME_POOL = [
  '林宇真', '陳允中', '張立平', '李則安', '王思齊', '黃柏宇',
  '吳子睿', '劉欣澄', '蔡和洋', '鄭少均', '楊宜庭', '許家瑋',
  '謝定遠', '洪語安', '周泓任', '何書維',
].filter(n => /^[一-鿿]{3}$/.test(n)); // 過濾掉任何混入非中文字的污染

/* ---- 媒體脈絡（between-subject，進場隨機固定其一） ---- */
const OUTLETS = [
  { key: 'cna',  name: '中央社' },
  { key: 'sin',  name: '三立新聞' },
];

/* ---- token 取得輔助 ---- */
function tokenOf(key, profile) {
  const attr = ATTRS.find(a => a.key === key);
  const lv = attr.levels.find(l => l.idx === profile[key]);
  return lv ? lv.token : null;
}
function phraseOf(key, profile) {
  const attr = ATTRS.find(a => a.key === key);
  const lv = attr.levels.find(l => l.idx === profile[key]);
  return lv ? lv.phrase : null;
}

/* ---- 學歷塊智慧組裝（school + major + degree，只留「有提」的細項） ----
 * 規則（依細項是否「不提」決定措辭；「擁有…學位」/「主修…」自然混用）：
 *   school + major + degree  → 擁有<校><系><位>學位         （如：擁有國立大學中文碩士學位）
 *   major  + degree（無校）   → 擁有<系><位>學位             （如：擁有中文碩士學位）
 *   school + major（無位）    → <校><系>系畢業               （如：國立大學中文系畢業）
 *   school + degree（無系）   → 擁有<校><位>學位             （如：擁有國立大學碩士學位）
 *   只有 degree              → 擁有<位>學位                 （如：擁有碩士學位）
 *   只有 school              → <校>畢業                     （如：國立大學畢業）
 *   只有 major               → 主修<系>                     （如：主修中文）
 *   三者皆不提               → null（學歷塊整個消失）
 */
function buildEduChunk(profile) {
  const sc = tokenOf('school', profile);  // 國立大學 / 私立大學 / null
  const mj = tokenOf('major', profile);   // 中文 / 新聞 / 企管 / null（現可不提）
  const dg = tokenOf('degree', profile);  // 學士 / 碩士 / null
  if (dg) return `擁有${(sc||'')}${(mj||'')}${dg}學位`;       // 有學位 → 「擁有…學位」(校/系任一可缺)
  if (sc && mj) return `${sc}${mj}系畢業`;                    // 有校有系無位
  if (sc) return `${sc}畢業`;                                 // 只有校
  if (mj) return `主修${mj}`;                                 // 只有系
  return null;                                               // 三者皆無
}

/* ---- 路線×職級複合詞（beat + rank 黏成一塊） ----
 *   beat + rank  → 「<路線>組<職級>」     （金融組記者 / 證券組主編 / 產業組資深記者）
 *   rank 不提，beat 有 → 「主跑<路線>」    （主跑金融）  ← 主跑＝路線單獨出現
 *   beat 不提，rank 有 → 「<職級>」        （資深記者）
 *   兩者皆不提 → null（此塊消失）
 */
function buildRoleChunk(profile) {
  const bt = tokenOf('beat', profile);   // 金融 / 證券 / 產業 / null
  const rk = tokenOf('rank', profile);   // 記者 / 資深記者 / 主編 / null
  if (bt && rk) return `${bt}組${rk}`;
  if (bt) return `主跑${bt}`;
  if (rk) return rk;
  return null;
}

/* ---- 整句組裝：學歷塊 + 4 個 solo 子句，以「塊」為單位依 chunkOrder 隨機排序 ----
 * 敘述範式：「<姓名><塊1>，<塊2>，…。」（首塊前不加「是一位記者」，改在 index.html 渲染時處理）
 * chunkOrder：受訪者內固定的「塊順序」（每位受訪者進場 shuffle 一次）。
 * 返回 body（不含姓名），由 index.html 在前面加姓名。
 */
function buildSentenceBody(profile, chunkOrder) {
  const chunks = {};
  chunks.edu = buildEduChunk(profile);
  chunks.role = buildRoleChunk(profile);
  SOLO_KEYS.forEach(k => { chunks[k] = phraseOf(k, profile); });   // cred / tenure
  // 依 chunkOrder 取出非空子句，並記住每個子句來自哪個塊
  const ordered = chunkOrder.map(c => ({ key: c, text: chunks[c] })).filter(o => o.text);
  // 全不提（理論上不進正式配對，因互有勝負規則排除）→ 只顯示姓名，不寫「資歷不詳」避免像在標記受訪者
  if (!ordered.length) return '。';
  const body = ordered.map(o => o.text).join('，');
  return `，${body}。`;   // 前綴逗號接姓名，如「林宇真，金融組記者，擁有國立大學企管碩士學位。」
}

/* 塊的識別碼（供受訪者內固定隨機順序）：edu 塊 + role 塊（路線職級）+ 2 solo（cred/tenure）*/
const CHUNK_KEYS = ['edu', 'role', ...SOLO_KEYS];

/* ---- 量表段 ---- */
const LIKERT7 = ['1 非常不同意', '2', '3', '4 普通', '5', '6', '7 非常同意'];
const LIKERT5 = ['1 非常不同意', '2', '3 普通', '4', '5 非常同意'];

/* 量表重設（使用者 2026-06-10）：原「感知某記者專業/信任」缺評估對象、受訪者無法答。
 * 改為兩個「受訪者自身一般傾向」構面（永遠有對象＝你自己）：
 *   (1) 對新聞的普遍信任（Meyer 1988 believability 改一般版，主詞＝台灣新聞）
 *   (2) 是否會看報導者資格（本研究核心 moderator，2 題簡單總括） */

/* 構面 1：對新聞的普遍信任 — Meyer (1988) believability 改一般版，5 點。 */
const SCALE_NEWSTRUST = {
  group: 'newstrust', dim: '對新聞的普遍信任', scale: LIKERT5, prefix: 'q_ntrust_',
  intro: '以下是你對「台灣新聞」整體的看法，請依你平常的感受作答。',
  items: [
    { id: 'credible', q: '整體而言，台灣的新聞是可信的。' },
    { id: 'fair',     q: '整體而言，台灣的新聞報導是公正的。' },
    { id: 'accurate', q: '整體而言，台灣的新聞報導是準確的。' },
    { id: 'trust',    q: '整體而言，我信任台灣的新聞媒體。' },
  ],
};

/* 構面 2：是否會看報導者資格（核心 moderator）— 2 題，問受訪者平常的閱讀習慣。 */
const SCALE_CREDLOOK = {
  group: 'credlook', dim: '是否在意記者資格', scale: LIKERT5, prefix: 'q_cred_',
  intro: '以下是你平常閱讀新聞的習慣，請依實際情況作答。',
  items: [
    { id: 'notice', q: '我讀新聞時，會在意撰稿記者是誰、有什麼背景。' },
    { id: 'use',    q: '我會參考記者的資歷（學歷、得獎、經驗）來判斷一則新聞可不可信。' },
  ],
};

/* 對指派媒體的既有信任（between-subject 控制：受訪者整份固定一家）：該家 1 題。{OUTLET} 動態替換。 */
const SCALE_OUTLET = {
  group: 'outlet', dim: '對該媒體既有信任', scale: LIKERT5, prefix: 'q_outlet_',
  intro: '最後，關於你這次看到的這家媒體：',
  items: [
    { id: 'cred',  q: '整體而言，{OUTLET} 是可信的媒體。' },
  ],
};

/* CMV marker 題（與構念無關，供共同方法變異校正） */
const MARKER = { group: 'marker', dim: 'marker', scale: LIKERT7, prefix: 'q_marker_',
  intro: '', items: [{ id: 'blue', q: '我很喜歡藍色。' }] };

/* demographics — 點選即可 */
const DEMOG = [
  { id: 'sex', q: '你的生理性別？', options: ['男', '女', '其他／不願透露'] },
  { id: 'age', q: '你的年齡層？', options: ['18–24', '25–34', '35–44', '45–54', '55 以上'] },
  { id: 'edu_self', q: '你的最高學歷？', options: ['高中以下', '大學', '碩士', '博士'] },
];

/* 雙 DV 任務定義。媒體 {OUTLET} 每題動態替換（within-subject：題內兩位同家、題間隨機）。
 * 題幹格式：「當你在<中央社/三立新聞>看到一則財經新聞報導時，哪一位記者會讓你<DV>？」 */
/* 雙 DV ＝ source credibility 兩個核心可分離維度（Mayer et al. 1995；McCroskey 1981）：
 *   DV1 read  → expertise（專業可信，能力面）
 *   DV2 wary  → trustworthiness（誠信可信，品格面）
 * task key 沿用 'read'/'wary' 不變動，避免 flatten 欄位連鎖更名。 */
const TASKS = {
  read: {
    key: 'read', dv: 'expertise', label: '更專業',
    title: '專業可信（expertise）',
    prompt: '當你在{OUTLET}看到一則財經新聞報導時，你覺得哪一位記者<b>看起來更專業</b>？',
    intro: '接下來，每題上下呈現兩位記者的簡介。請依第一直覺，選出你覺得<b>看起來更專業</b>的那一位。沒有對錯。',
  },
  wary: {
    key: 'wary', dv: 'trustworthiness', label: '更可信',
    title: '誠信可信（trustworthiness）',
    prompt: '當你在{OUTLET}看到一則財經新聞報導時，你覺得哪一位記者的<b>報導更可信</b>？',
    intro: '接下來，每題上下呈現兩位記者的簡介。請依第一直覺，選出你覺得<b>報導更可信</b>的那一位。沒有對錯。',
  },
};

/* 設計參數 */
const DESIGN = {
  nTrialsPerTask: 8,  // 每個 DV 任務的正式對比題數（閱讀 8 + 不受市場利益 8 = 16）
  minAnswerSec: 3,    // 每題最短作答秒數（前端硬限制）
};
