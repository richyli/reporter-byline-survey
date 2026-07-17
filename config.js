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
    // 科系(major)已於 2026-07-17 定稿砍除：Study 1 共線盤點顯示科系×學科領域 phi=.93、×學校.88 是學歷冗餘；
    // wiki 文獻無支持科系別是可信度信號（Spence 談學位層級非科系）；對口功能由 beat 承載。詳見 study2_attribute_final.md。
    key: 'degree', name: '學位', ordered: false, chunk: 'edu',
    levels: [
      { idx: 1, label: '學士', token: '學士' },
      { idx: 2, label: '碩士', token: '碩士' },
      { idx: 3, label: '不提', token: null },            // 不提：學歷塊略去學位
    ],
  },
  {
    /* 證照 cred：水準不變(無/高業/分析師)，但每水準有多種「同義不同長度」措辭版本（長→短）。
     * 僅供『長度匹配組(matched)』微調整卡總長，幫兩卡更精準等長。版本選擇純為長度服務、
     * 不進設計矩陣（part-worth 只對應水準 idx），故不洩漏資訊、不影響估計。
     * phrase = 預設(最長正式版)；phraseVariants = 由長到短可替換版本。 */
    key: 'cred', name: '專業證照', ordered: true,
    levels: [
      { idx: 1, label: '無', phrase: null, phraseVariants: [] },             // 略去
      { idx: 2, label: '證券高級業務員', phrase: '具證券高級業務員資格',
        phraseVariants: ['具證券高級業務員資格','證券高級業務員資格','證券高級業務員','證券高業'] },
      { idx: 3, label: '證券分析師', phrase: '具證券投資分析師資格',
        phraseVariants: ['具證券投資分析師資格','證券投資分析師資格','證券投資分析師','證券分析師'] },
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
    key: 'rank', name: '職級', ordered: false, chunk: 'role',   // 與 beat 黏成複合詞；砍主編(2026-06-20 減參數)
    levels: [
      { idx: 1, label: '不提',   token: null },
      { idx: 2, label: '記者',   token: '記者' },
      { idx: 3, label: '資深記者', token: '資深記者' },
    ],
  },
  {
    key: 'beat', name: '關注路線', ordered: false, chunk: 'role',   // 與 rank 黏成複合詞；砍金融(2026-06-20 減參數)
    levels: [
      { idx: 1, label: '不提', token: null },
      { idx: 2, label: '證券', token: '證券' },
      { idx: 3, label: '產業', token: '產業' },
    ],
  },
  {
    /* 得獎 award（2026-07-17 加入）：個人歸屬、有序（不提<國內<國外，稀缺/成本遞增）。
     * 獨立 solo 子句（放法 A），句尾亮點；加入 STRENGTH（互有勝負/dominance）。
     * 三水準用「國內/國外」而非等級高低——一般讀者分不出國內獎等級，但國內vs國外可辨識（Spence 相關性條件）。
     * 泛稱措辭，不鎖具體獎名，避免受訪者對特定獎的認知差異。真實案例：SOPA=國外；卓越/金鼎=國內。
     * phraseVariants 供長度微調（同 cred 機制）。詳見 study2_attribute_final.md §二決策4。 */
    key: 'award', name: '得獎', ordered: true,
    levels: [
      { idx: 1, label: '不提', phrase: null, phraseVariants: [] },                 // 略去
      { idx: 2, label: '國內新聞獎', phrase: '曾獲國內新聞獎',
        phraseVariants: ['曾獲國內新聞獎', '獲國內新聞獎', '得過國內新聞獎'] },
      { idx: 3, label: '國外新聞獎', phrase: '曾獲國外新聞獎',
        phraseVariants: ['曾獲國外新聞獎', '獲國外新聞獎', '得過國外新聞獎'] },
    ],
  },
];
const ATTR_KEYS = ATTRS.map(a => a.key);
const EDU_KEYS = ['school', 'degree'];                   // 學歷塊內固定組裝順序（科系 major 已砍）
const ROLE_KEYS = ['beat', 'rank'];                      // 路線×職級複合詞塊
const SOLO_KEYS = ['cred', 'tenure', 'award'];           // 各自獨立子句（award 2026-07-17 加入）

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

/* ---- 學歷塊智慧組裝（school + degree，只留「有提」的細項；科系 major 2026-07-17 已砍） ----
 * 規則（依細項是否「不提」決定措辭）：
 *   school + degree  → 擁有<校><位>學位             （如：擁有國立大學碩士學位）
 *   只有 degree      → 擁有<位>學位                 （如：擁有碩士學位）
 *   只有 school      → <校>畢業                     （如：國立大學畢業）
 *   兩者皆不提       → null（學歷塊整個消失）
 * 註：拆 school+degree 兩獨立屬性（正交可估純校級/純學位效果），但呈現仍黏成一句學歷塊自然表述。
 */
function buildEduChunk(profile) {
  const sc = tokenOf('school', profile);  // 國立大學 / 私立大學 / null
  const dg = tokenOf('degree', profile);  // 學士 / 碩士 / null
  if (dg) return `擁有${(sc||'')}${dg}學位`;                  // 有學位 → 「擁有…學位」(校可缺)
  if (sc) return `${sc}畢業`;                                 // 只有校
  return null;                                               // 兩者皆無
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
/* 取指定屬性片語的長度版本（vi=版本索引，0=最長…末=最短；超界自動夾住）。
 * 適用有 phraseVariants 的 solo 屬性（cred 證照 / award 得獎）。
 * 僅 matched 組微調長度用；不指定(vi=null)時回預設 phrase（最長正式版）。 */
function variantPhrase(profile, key, vi) {
  const attr = ATTRS.find(a => a.key === key);
  const lv = attr.levels.find(l => l.idx === profile[key]);
  if (!lv || !lv.phrase) return null;
  if (vi == null || !lv.phraseVariants || !lv.phraseVariants.length) return lv.phrase;
  const i = Math.max(0, Math.min(vi, lv.phraseVariants.length - 1));
  return lv.phraseVariants[i];
}
/* 相容舊呼叫名 */
function credPhrase(profile, vi) { return variantPhrase(profile, 'cred', vi); }
/* credVariant / awardVariant：matched 組微調證照與得獎的長度版本（null=預設最長）。 */
function buildSentenceBody(profile, chunkOrder, credVariant, awardVariant) {
  const chunks = {};
  chunks.edu = buildEduChunk(profile);
  chunks.role = buildRoleChunk(profile);
  SOLO_KEYS.forEach(k => { chunks[k] = phraseOf(k, profile); });   // cred / tenure / award
  if (credVariant != null) chunks.cred = variantPhrase(profile, 'cred', credVariant);    // 覆寫證照長度版本
  if (awardVariant != null) chunks.award = variantPhrase(profile, 'award', awardVariant); // 覆寫得獎長度版本
  // 依 chunkOrder 取出非空子句，並記住每個子句來自哪個塊
  const ordered = chunkOrder.map(c => ({ key: c, text: chunks[c] })).filter(o => o.text);
  // 全不提（理論上不進正式配對，因互有勝負規則排除）→ 只顯示姓名，不寫「資歷不詳」避免像在標記受訪者
  if (!ordered.length) return '。';
  const body = ordered.map(o => o.text).join('，');
  return `，${body}。`;   // 前綴逗號接姓名，如「林宇真，證券組記者，擁有國立大學碩士學位，曾獲國內新聞獎。」
}

/* 塊的識別碼（供受訪者內固定隨機順序）：edu 塊 + role 塊（路線職級）+ 3 solo（cred/tenure/award）*/
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

/* 構面 2：是否在意記者資格（核心 moderator）— 4 題（2026-07-17 由 2 題補足）。
 * 【構念窄化】原 2 題橫跨「注意（attention：會不會看記者是誰）」與「使用（use/weighting：
 * 會不會拿記者資歷當判斷依據）」兩個子面向，item 間共變低是 α 不穩主因。
 * 本版**窄化為「使用／賦權」單一面向**——即「記者是誰／什麼資歷，會不會影響我對這則新聞的判斷」，
 * 理論上最貼近 conjoint 的選擇行為，最適合當預測 part-worth 差異的 moderator。
 * 【wiki 無現成量表故自建】source/author attention 在文獻中僅以行為指標（Edgerly & Vraga 2019 來源辨識檢核）、
 * 開放式提及率（Bobkowski 2020：author 為第二高可信度線索 84%）、質性訪談（Tully et al. 2020）出現，
 * 未見自陳傾向量表 → 本構面題項為自建，pilot 須測信度。
 * 【設 moderator 的理論依據】Edgerly & Vraga (2019) 發現近四成受試者未察覺來源線索、並以來源辨識檢核
 * 篩除 127 人 → 直接證明「是否注意/使用來源資訊」存在個體差異且會稀釋效果。
 * 【全部同向，不加反向題】Meyer (1988) 極性實驗證實反向措辭會製造方法假象因子、破壞 α。
 * 【避免污染】題目聚焦「傾向／重要性」而非「查證行為頻率」——Prajod (2026) 顯示 source-checking
 * 主要由主題興趣驅動，寫成查證行為會混入主題興趣變異。 */
const SCALE_CREDLOOK = {
  group: 'credlook', dim: '是否在意記者資格', scale: LIKERT5, prefix: 'q_cred_',
  intro: '以下是你平常閱讀新聞的看法，請依實際情況作答。',
  items: [
    { id: 'use',     q: '我會參考記者的資歷（學歷、得獎、經驗）來判斷一則新聞可不可信。' },
    { id: 'affect',  q: '同樣一則新聞，記者是誰會影響我對它的信任程度。' },
    { id: 'matter',  q: '新聞是誰寫的，對我來說是重要的資訊。' },
    { id: 'weigh',   q: '記者的專業背景，是我判斷新聞品質時會納入考量的因素。' },
  ],
};

/* 對指派媒體的既有信任（between-subject 控制：受訪者整份固定一家）— 4 題（2026-07-17 由 1 題補足）。
 * 【量表來源】改寫自 Meyer (1988) Believability Index 五題（Journalism Quarterly 65: 567-574）：
 *   Can be trusted / Accurate / Fair / Unbiased / Tells the whole story。
 *   本版取前四題（alpha-if-deleted 全落 .78-.80，無冗題；省「全貌」題控題數）。
 * 【信度背書】Meyer 原研究 α=.83-.84；West (1994) 交叉驗證 α=.92；
 *   McComas & Trumbo (2001) 將主詞替換為非媒體來源仍 α=.84 → 主詞換成特定媒體有實證先例；
 *   Edgerly & Vraga (2019) 以近乎同一組題測「特定帳號」α=.87。
 * 【改寫說明】原為語意差異雙極量尺，此處改寫為 Likert 陳述句（論文須註明 adapted from Meyer 1988）。
 * 【全部同向，不加反向題】Meyer 極性實驗證實 Gaziano-McGrath 的「單因子」實為反向措辭造成的方法假象。
 * {OUTLET} 動態替換為受訪者被分派的那一家。 */
const SCALE_OUTLET = {
  group: 'outlet', dim: '對該媒體既有信任', scale: LIKERT5, prefix: 'q_outlet_',
  intro: '最後，關於你這次看到的這家媒體：',
  items: [
    { id: 'cred',     q: '整體而言，<span class="ctx">{OUTLET}</span>是可信的媒體。' },        // Can be trusted
    { id: 'accurate', q: '<span class="ctx">{OUTLET}</span>的報導內容是準確的。' },            // Accurate
    { id: 'fair',     q: '<span class="ctx">{OUTLET}</span>的報導是公正的。' },                // Fair
    { id: 'unbiased', q: '<span class="ctx">{OUTLET}</span>的報導不帶偏見。' },                // Unbiased
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
  /* 情境錨點（媒體名／新聞類型）以 <span class="ctx"> 標示（使用者 2026-07-17）：
   * 這兩個是實驗操弄的關鍵情境（between-subject 媒體 × 鎖定財經情境），需確保受訪者注意到。 */
  read: {
    key: 'read', dv: 'expertise', label: '更專業',
    title: '專業可信（expertise）',
    prompt: '當你在<span class="ctx">{OUTLET}</span>看到一則<span class="ctx">財經新聞</span>報導時，你覺得哪一位記者<b>看起來更專業</b>？',
    intro: '接下來，每題上下呈現兩位記者的簡介。請依第一直覺，選出你覺得<b>看起來更專業</b>的那一位。沒有對錯。',
  },
  wary: {
    key: 'wary', dv: 'trustworthiness', label: '更可信',
    title: '誠信可信（trustworthiness）',
    prompt: '當你在<span class="ctx">{OUTLET}</span>看到一則<span class="ctx">財經新聞</span>報導時，你覺得哪一位記者的<b>報導更可信</b>？',
    intro: '接下來，每題上下呈現兩位記者的簡介。請依第一直覺，選出你覺得<b>報導更可信</b>的那一位。沒有對錯。',
  },
};

/* 設計參數 */
const DESIGN = {
  nTrialsPerTask: 10,   // 每 DV 正式對比題數（雙 DV 共 20）
  nMatched: 6,          // 其中「長度匹配組」題數（兩卡等長→純內容 part-worth）
  nFree: 4,             // 「長度不限組」題數（兩卡長度不限→捕捉長度/揭露數效果）
  minAnswerSec: 3,      // 每題最短作答秒數（前端硬限制）
  // 品質題分散：DV1(read)放 trap、DV2(wary)放 repeat、不放 dominance（使用者 2026-06-20）
};
