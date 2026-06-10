/* R Reporter Byline — conjoint 設定（屬性、水準、句子模板、量表）
 * 設計依據：-work/Research/R Reporter Byline/analysis_output/attribute_levels.md
 * 句型：敘述句（NYT/Texas Tribune 風），7 屬性合併成一句記者簡介。
 *   學歷三屬性（school+major+degree）黏成一個「學歷塊」智慧組裝；
 *   其餘 4 屬性各自獨立成子句；子句（含學歷塊）以「塊」為單位隨機排序。
 * 情境：鎖定財經新聞。主選擇題：繼續閱讀意願。媒體脈絡 between-subject（中央社 vs 三立新聞）。
 */

/* ---- 7 屬性。ordered=true 的有序屬性（award/tenure）idx 1<2<3 為遞增強度；
 *      其餘為類別屬性（idx 順序不影響分析）。
 *      label 供分析對照；token 供「學歷塊」組裝（school/major/degree）；
 *      phrase 供獨立子句（award/tenure/teach/proauth）。 ---- */
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
      { idx: 1, label: '傳播', token: '傳播' },
      { idx: 2, label: '中文', token: '中文' },
      { idx: 3, label: '企管', token: '企管' },
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
    key: 'award', name: '得獎', ordered: true,
    levels: [
      { idx: 1, label: '無',           phrase: null },                   // 略去
      { idx: 2, label: '消費者權益獎',  phrase: '作品曾獲消費者權益獎' },
      { idx: 3, label: '文化部金鼎獎',  phrase: '作品曾獲文化部金鼎獎' },
    ],
  },
  {
    key: 'tenure', name: '跨線年資', ordered: true,
    levels: [
      { idx: 1, label: '資淺約2年',  phrase: '有 2 年採訪經驗' },
      { idx: 2, label: '中堅約8年',  phrase: '有 8 年採訪經驗' },
      { idx: 3, label: '資深約18年', phrase: '有 18 年採訪經驗' },
    ],
  },
  {
    key: 'teach', name: '大學教職', ordered: false,
    levels: [
      { idx: 1, label: '無',     phrase: null },               // 略去
      { idx: 2, label: '兼任講師', phrase: '並在大學兼任講師' },
    ],
  },
  {
    key: 'proauth', name: '專業肯定', ordered: false,
    levels: [
      { idx: 1, label: '無',     phrase: null },                       // 略去
      { idx: 2, label: '著書',   phrase: '著有《ETF 存股術》一書' },
      { idx: 3, label: '分析師', phrase: '具證券投資分析師資格' },
    ],
  },
];
const ATTR_KEYS = ATTRS.map(a => a.key);
const EDU_KEYS = ['school', 'major', 'degree'];          // 學歷塊內固定組裝順序
const SOLO_KEYS = ['award', 'tenure', 'teach', 'proauth']; // 各自獨立子句

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
  const mj = tokenOf('major', profile);   // 傳播 / 中文 / 企管（必有）
  const dg = tokenOf('degree', profile);  // 學士 / 碩士 / null
  if (dg) return `擁有${(sc||'')}${(mj||'')}${dg}學位`;       // 有學位 → 「擁有…學位」
  if (sc && mj) return `${sc}${mj}系畢業`;                    // 有校有系無位
  if (sc) return `${sc}畢業`;                                 // 只有校
  if (mj) return `主修${mj}`;                                 // 只有系
  return null;                                               // 三者皆無
}

/* ---- 整句組裝：學歷塊 + 4 個 solo 子句，以「塊」為單位依 chunkOrder 隨機排序 ----
 * 敘述範式：「<姓名><塊1>，<塊2>，…。」（首塊前不加「是一位記者」，改在 index.html 渲染時處理）
 * chunkOrder：受訪者內固定的「塊順序」（每位受訪者進場 shuffle 一次）。
 * 返回 body（不含姓名），由 index.html 在前面加姓名。
 */
function buildSentenceBody(profile, chunkOrder) {
  const chunks = {};
  chunks.edu = buildEduChunk(profile);
  SOLO_KEYS.forEach(k => { chunks[k] = phraseOf(k, profile); });
  const parts = chunkOrder.map(c => chunks[c]).filter(Boolean);
  const body = parts.length ? parts.join('，') : '資歷不詳';
  return `，${body}。`;   // 前綴逗號接姓名，如「楊宜庭，擁有…，…。」
}

/* 塊的識別碼（供受訪者內固定隨機順序）：edu 塊 + 4 solo */
const CHUNK_KEYS = ['edu', ...SOLO_KEYS];

/* ---- 量表段 ---- */
const LIKERT7 = ['1 非常不同意', '2', '3', '4 普通', '5', '6', '7 非常同意'];
const LIKERT5 = ['1 非常不同意', '2', '3 普通', '4', '5 非常同意'];

/* Mediator：感知記者專業性／權威 — McCroskey & Teven (1999) competence/authority 子維度，繁中 7 點。
 * 題幹脈絡指向「剛才看到的這類記者」。marker 題混入供 CMV。 */
const SCALE_EXPERTISE = {
  group: 'expertise', dim: '感知記者專業性／權威', scale: LIKERT7, prefix: 'q_exp_',
  intro: '請依你剛才看到的記者簡介，整體評估「這樣資歷的記者」給你的印象。',
  items: [
    { id: 'expert',   q: '這樣的記者是某個領域的專家。' },
    { id: 'competent',q: '這樣的記者很有能力。' },
    { id: 'informed', q: '這樣的記者見多識廣、消息靈通。' },
    { id: 'intelligent', q: '這樣的記者很有見識。' },
    { id: 'trained',  q: '這樣的記者受過專業訓練。' },
    { id: 'reliable', q: '這樣的記者值得倚賴。' },
  ],
};

/* DV(b) 警戒心 — Tsfati & Cappella (2003) news media skepticism 改編，主詞改「這位記者/這篇報導」，5 點。
 * 反向計分題（fair/accurate/whole-story/trusted）以「我會懷疑…」正向化，避免反向題造偽因素。 */
const SCALE_SKEPTICISM = {
  group: 'skepticism', dim: '警戒心', scale: LIKERT5, prefix: 'q_skep_',
  intro: '想像你正在讀這類記者寫的一則新聞，請評估以下感受。',
  items: [
    { id: 'unfair',    q: '我會懷疑這位記者報導得不夠公正。' },
    { id: 'inaccurate',q: '我會懷疑這篇報導不夠準確。' },
    { id: 'partial',   q: '我會懷疑這篇報導沒有把事情說完整。' },
    { id: 'distrust',  q: '我對這位記者的報導會抱持戒心、不會輕易相信。' },
    { id: 'speed',     q: '我擔心這位記者為了搶快而犧牲了準確。' },
    { id: 'harm',      q: '我覺得這類報導對社會的幫助有限。' },
  ],
};

/* 整體信任（次 DV）— Meyer (1988) believability 5 題，5 點正向。 */
const SCALE_TRUST = {
  group: 'trust', dim: '整體新聞信任', scale: LIKERT5, prefix: 'q_trust_',
  intro: '整體而言，對這類記者寫的新聞，你的看法是：',
  items: [
    { id: 'fair',     q: '這類報導是公正的。' },
    { id: 'unbiased', q: '這類報導是沒有偏見的。' },
    { id: 'complete', q: '這類報導把事情交代得完整。' },
    { id: 'accurate', q: '這類報導是準確的。' },
    { id: 'trusted',  q: '這類報導可以信任。' },
  ],
};

/* 對指派媒體的既有信任（控制 between-subject carry-over）。{OUTLET} 動態替換為中央社/三立新聞。3 點題以 5 點呈現。 */
const SCALE_OUTLET = {
  group: 'outlet', dim: '對該媒體既有信任', scale: LIKERT5, prefix: 'q_outlet_',
  intro: '在參加這個研究之前，你對「{OUTLET}」這家媒體本身的看法是：',
  items: [
    { id: 'cred',  q: '整體而言，{OUTLET} 是可信的媒體。' },
    { id: 'prof',  q: '{OUTLET} 的新聞報導是專業的。' },
    { id: 'often', q: '我平常會接觸 {OUTLET} 的新聞。' },
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
const TASKS = {
  read: {
    key: 'read', dv: 'continue_reading', label: '繼續閱讀',
    title: '繼續閱讀意願',
    prompt: '當你在{OUTLET}看到一則財經新聞報導時，哪一位記者會讓你<b>更想繼續閱讀</b>？',
    intro: '接下來，每題並排呈現兩位記者的簡介。請依第一直覺，選出<b>更想繼續閱讀</b>其報導的那一位。沒有對錯。',
  },
  wary: {
    key: 'wary', dv: 'wariness', label: '警戒心',
    title: '警戒心',
    prompt: '當你在{OUTLET}看到一則財經新聞報導時，哪一位記者會讓你<b>提高警戒心</b>？',
    intro: '接下來，每題並排呈現兩位記者的簡介。請依第一直覺，選出讓你<b>提高警戒心</b>（比較會有戒備、不敢輕信）的那一位。沒有對錯。',
  },
};

/* 設計參數 */
const DESIGN = {
  nTrialsPerTask: 6,  // 每個 DV 任務的正式對比題數（閱讀 6 + 警戒 6 = 12）
  minAnswerSec: 3,    // 每題最短作答秒數（前端硬限制）
};
