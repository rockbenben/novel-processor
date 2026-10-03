import { splitTextIntoLines, compressNewlines, chapterPattern, isChapterTitleLine, normalizeNewlines, toHalfWidth, cleanLines, filterLines, splitParagraph, dedupeAdjacentLines, isSeparatorBar, escapeRegExp, pureNumberRegex, novelSectionHeaderRegex, specialLineStartRegex, numberStartRegex, punctuationEndRegex, numberEndRegex, CHAPTER_MARKERS } from "@/app/utils";

// 章节标题判定（标题正则 + 长度/标点约束）统一收在 utils/regex.ts 的 isChapterTitleLine
const isTitleLine = isChapterTitleLine;

// 提取“第X<标记>”里的结构标记（章/节/卷/集/幕/回/部/篇）；无则 null（英文 / 纯数字标题等）
const chapterMarker = (s: string): string | null => {
  // 数字类与 extractChapterOrder/chineseNumeralToNumber 对齐:含 万/萬 与大写
  // 数字(壹贰…拾佰仟)—— 否则「第一万章」「第壹拾章」取不到标记,同号去重
  // 在万级和大写章节上静默失效。
  const m = s.match(/第\s*[〇零一二三四五六七八九十百千万两壹贰叁肆伍陆柒捌玖拾佰仟萬\d]+\s*([章节卷集幕回部篇])/);
  return m ? m[1] : null;
};

// 两个标题是否属于同一章：文本相同；或章节号相同且结构标记一致（避免第3卷与第3章因序号相同被误判同章）。
// 无结构标记的标题(英文/纯数字,chapterMarker 均为 null)不能只靠 null===null
// 判同章 —— "5. Apples" 与 "5. Oranges" 只是序号巧合相同,误判会让合并逻辑
// 把靠前整章(标题+正文)静默删除。去掉序号前缀后剩余文本须实质相同。
const stripOrderPrefix = (s: string): string =>
  s
    .replace(/^(?:chapter|ch)\.?\s*(?:\d+|[ivxlcdm]+)\s*[.、:：\-]?\s*/i, "")
    .replace(/^\s*(?:\d+|[ivxlcdm]+)\s*[.、．:：\-)\]】]?\s*/i, "")
    .trim()
    .toLowerCase();

const isSameChapter = (a: string, b: string): boolean => {
  const ta = a.trim();
  const tb = b.trim();
  if (ta === tb) return true;
  const oa = extractChapterOrder(ta);
  const ob = extractChapterOrder(tb);
  if (oa === null || ob === null || oa !== ob) return false;
  const ma = chapterMarker(ta);
  const mb = chapterMarker(tb);
  if (ma !== mb) return false;
  // 「第5章 初遇」vs「第5章 初遇(修)」:结构标记 + 同号 → 同章(标题修订)
  if (ma !== null) return true;
  return stripOrderPrefix(ta) === stripOrderPrefix(tb);
};

// 将中文数字转为阿拉伯数字（支持到万级,含大写数字）。
// 万级与大写(壹贰叁…拾佰仟萬)必须支持:chapterTitleRegex 接受这些字符,
// 长篇网文跨过第 9999 章是常态 —— 解析不出序号的章节全被排到文档末尾。
export const chineseNumeralToNumber = (input: string): number | null => {
  const map: Record<string, number> = {
    零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
    壹: 1, 贰: 2, 叁: 3, 肆: 4, 伍: 5, 陆: 6, 柒: 7, 捌: 8, 玖: 9,
  };
  const unit: Record<string, number> = { 十: 10, 拾: 10, 百: 100, 佰: 100, 千: 1000, 仟: 1000 };
  // 位数式写法(一一〇/一二三):全串均为数字字符、不含任何单位且长度>1 时
  // 按位拼接(一一〇 → 110)。下方累加路径会逐位【求和】得到 2 —— 在任何中文
  // 数字读法下都不成立,还会与真实低号章节撞号,触发同章误判整段删除。
  const chars = [...input];
  if (chars.length > 1 && chars.every((ch) => map[ch] !== undefined || /\d/.test(ch))) {
    let v = 0;
    for (const ch of chars) v = v * 10 + (map[ch] ?? Number(ch));
    return v;
  }
  let total = 0;
  let section = 0; // 当前万段内的累计
  let current = 0;
  let has = false;
  for (const ch of input) {
    if (map[ch] !== undefined) {
      current = current + map[ch];
      has = true;
    } else if (unit[ch] !== undefined) {
      if (current === 0) current = 1; // 十、百、千前省略“一”
      section += current * unit[ch];
      current = 0;
      has = true;
    } else if (ch === "万" || ch === "萬") {
      section += current;
      if (section === 0) section = 1; // “万”前省略“一”
      total += section * 10000;
      section = 0;
      current = 0;
      has = true;
    } else if (/\d/.test(ch)) {
      // 阿拉伯数字逐位累入 current,与中文单位正常结合:旧实现遇到任何数字
      // 就 parseInt 首段数字直接返回 —— "第1万章" 解析成 1 而非 10000,
      // reorder 把万章级章节排到最前,同号去重还会把它与"第一章"误判同章。
      current = current * 10 + Number(ch);
      has = true;
    }
  }
  if (!has) return null;
  return total + section + current;
};

export const romanToInt = (s: string): number | null => {
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let res = 0;
  let has = false;
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const val = map[up[i]];
    if (!val) continue;
    has = true;
    const next = i + 1 < up.length ? map[up[i + 1]] || 0 : 0;
    if (val < next) {
      res += next - val;
      i++;
    } else {
      res += val;
    }
  }
  return has ? res : null;
};

// 从章节标题提取顺序号
export const extractChapterOrder = (title: string): number | null => {
  // 常见：第十二章 / 第12章 / 第一万章 / 第壹拾章 / Chapter 5 / CH 5
  const m = title.match(/第([〇零一二三四五六七八九十百千万两壹贰叁肆伍陆柒捌玖拾佰仟萬\d]+)\s*[章节卷集幕回部篇]/);
  if (m) {
    // 纯数字与混合写法("1万"、"2万3千")统一走 chineseNumeralToNumber:
    // 旧的 /\d+/ 短路只取首段数字,单位被丢弃("第1万章" → 1)。
    const cn = chineseNumeralToNumber(m[1]);
    if (cn !== null) return cn;
  }
  const en = title.match(/\b(?:chapter|ch)\.?\s*(\d+)\b/i);
  if (en) return parseInt(en[1], 10);

  const roman = title.match(/\b(?:chapter|ch)\.?\s*([ivxlcdm]+)\b/i);
  if (roman) {
    const r = romanToInt(roman[1]);
    if (r !== null) return r;
  }

  // 带编号的前后置标记标题(番外1/后记2):编号是番外自身的序列,不是正文
  // 章节号 —— anyNum 兜底会让「番外1」拿到 order=1,reorder 按同号排进第一、
  // 二章之间(静默内容易位)。返回 null 走「前置留前/后置排后」通道。
  // 「番外第三章」由上方第X章分支先行命中,不进此守卫。
  if (/^\s*(?:序章|序言|引子|前言|卷首语|扉页|楔子|终章|后记|附录|尾声|番外)/.test(title)) return null;
  const anyNum = title.match(/\d+/);
  if (anyNum) return parseInt(anyNum[0], 10);
  return null;
};

export const reorderChaptersByTitle = (text: string): { output: string; chapters: number } => {
  const lines = splitTextIntoLines(text || "");
  type Chapter = { title: string; content: string[]; order: number | null; idx: number };
  const chapters: Chapter[] = [];
  let current: Chapter | null = null;
  const preface: string[] = [];

  for (const line of lines) {
    if (isTitleLine(line)) {
      if (current) chapters.push(current);
      const order = extractChapterOrder(line) ?? null;
      current = { title: line, content: [line], order, idx: chapters.length };
    } else {
      if (!current) preface.push(line);
      else current.content.push(line);
    }
  }
  if (current) chapters.push(current);

  if (chapters.length === 0) {
    return { output: text, chapters: 0 };
  }

  const withIndex = chapters.map((c, i) => ({ ...c, i }));
  // 无序号章节分两类:出现在首个【有序号】章节之前的(序章/楔子/前言等
  // 前置内容)留在最前;之后出现的(终章/后记/番外)排到最后。旧实现把
  // null 一律排到末尾 —— 序章被搬到全书结尾(静默内容易位)。
  const firstNumbered = chapters.findIndex((c) => c.order !== null);
  const rank = (c: { order: number | null; i: number }) => (c.order !== null ? 1 : firstNumbered === -1 || c.i < firstNumbered ? 0 : 2);
  withIndex.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 1 && a.order !== b.order) return a.order! - b.order!;
    return a.i - b.i;
  });

  const parts: string[] = [];
  if (preface.length) parts.push(preface.join("\n"));
  for (const ch of withIndex) parts.push(ch.content.join("\n"));

  const out = compressNewlines(parts.join("\n\n"), 2);
  return { output: out, chapters: chapters.length };
};

// 将未换行的章节标题拆分为“标题 + 换行 + 内容”的形式
export const splitInlineChapterTitles = (text: string): string => {
  return splitTextIntoLines(text)
    .map((line) => {
      const trimmedLine = line.trim();
      const match = trimmedLine.match(chapterPattern);

      if (match) {
        const chapterTitle = match[1].trim();
        const restContent = match[2].trim();

        // 如果后面内容包含括号，在括号后添加换行（仅作用于第一个右括号）
        if (restContent.includes(")") || restContent.includes("）")) {
          return `${chapterTitle} ${restContent.replace(/[)）]/, "$&\n\n")}`;
        } else {
          // 寻找第一个空格位置
          const firstSpaceIndex = restContent.indexOf(" ");
          if (firstSpaceIndex !== -1) {
            // 在第一个空格后添加换行
            return `${chapterTitle} ${restContent.substring(0, firstSpaceIndex)}\n\n${restContent.substring(firstSpaceIndex + 1).trim()}`;
          } else if (restContent.length > 30) {
            // 如果内容较长且没有空格，在章节标题后添加换行
            return `${chapterTitle}\n\n${restContent}`;
          } else {
            // 短内容保持原样
            return `${chapterTitle} ${restContent}`;
          }
        }
      }
      return line;
    })
    .join("\n");
};

// 将每行末尾的数字移除（仅当行长度 >= minLen），偏小说处理语境
export const removeLineEndNumbers = (text: string, minLen = 10): string => {
  return splitTextIntoLines(text)
    .map((line) => (line.length >= minLen ? line.replace(/\d+$/, "") : line))
    .join("\n");
};

// 清除常见小说站点的水印/落款/提示等杂质（可逐步扩充）
export const stripNovelArtifacts = (text: string): string => {
  return (
    text
      // 清除乱码：私用区(PUA, U+E000–U+F8FF) 字符与替换符 (U+FFFD)
      .replace(/[\uE000-\uF8FF\uFFFD]/g, " ")
      // HTML 残留的不间断空格（含可选分号）
      .replace(/&nbsp;?/g, " ")
      .replace(/Added Url/g, "")
      .replace(/【待续】/g, "")
  );
  // 站点版权/导航提示类广告【不在这里】—— 一律走 stripAdLines 的行级线索判据，
  // 本函数只做字符级清洗。
};

// 小说正文里几乎不会出现的广告线索；命中处即广告起点。
// 含「加群 / 加入群聊 / 防盗链 / NBA.com / reference.com」这类字样的正文句必须原样
// 保留 —— 所以这些词只作辅助特征，不进本表。
const AD_CUES: RegExp[] = [
  /请牢记收藏|记住本站|加入收藏|收藏本页|请大家收藏[：:]/,
  /最快更新请?浏览器|最新最快无防盗|无防盗免费找书/,
  /免费找书|加书可加|找书群\s*[：:]?\d{5,}|本书首发/,
  /关注下方【?\s*QQ ?群|复制下方【?\s*QQ ?群号|复制下面群号|群号加入群聊|一键加群|搜索群号|加全订群|抽奖方式[：:]?\S{0,6}群[（(]?群号[：:]/,
  /(?:中转群|小说群|读书群|交流群|粉丝群|广告群|全订群|订阅群|新群|二群|三群)\s*[：:]?\s*\d{5,}/,
  /联系(?:管理|群管|管理员)?\s*(?:QQ|qq)\s*\d{5,}/,
  /如不慎该资源侵犯了您的权益|侵犯了您的权益|版权归所有|本作品仅供读者|文本仅供|仅供个人学习|请在下载后\d+\s*小时|请观看完毕后删除|24小时[內内]?(?:以)?内[除删]/,
  /每月更新\d+|每日更新\d+|日更\d+\s*[+＋]|全网小说资源|小说源共享|资源每日更新/,
  /从此告别书荒|告[，,]?别书荒/,
  /请购买正版书籍|购买正版谢谢合作|支持订阅正版|感谢对作者的支持|拒绝盗版|如果觉得本书不错/,
  /本书由【[^】]{1,12}】整理/,
  /(?:正在)?转码中|转码中[，,]?请稍后再试/,
  // 网址只吃 URL 安全字符：写成 [^\s，。]{4,} 会把紧跟其后的正文（"https://众人循着方向…"）
  // 一起吞进"广告跨度"，导致后面的判据误判。
  /(?:https?:\/\/|www\.)[A-Za-z0-9._\-\/:?&%#=~+@]{4,}/i,
  /笔趣阁|全文字阅读|txt下载|TXT下载|电子书下载/,
  /资源来自于网络|来自网络，仅作|学习交流使用|学习和试读|更多精彩|请访问|最新章节\W{0,3}请?访问/,
  // 旧 stripNovelArtifacts 里"整块拼齐才命中"的多行水印的残余碎片线索：那几条正则
  // 已删，这些片段必须在这里单独站得住（否则 "本群免费提取全网平台资源" 之类会留下半截）
  /怠惰小说下载器|DownloadAllContent|免费提取全网|全网平台资源|私聊群主|整理[,]?请勿/,
  // 群号行的三种排版：号码在括号内、用破折号引出括号外、或混进混淆字符里
  // 【月漪免费外群1号】——176132292 / 【千寻新免费满文件小说2群：960126270】
  // 【灵梦免费外群6号】——l/-i*/…梦/-首*发830907958
  // 判据取"群"后 30 字内出现 7 位以上连续数字：正文里的电话号码极少与「群」同现，
  // 而作者的打赏鸣谢行（非常感谢【书友160827132928773】的300起点币打赏。）没有「群」，
  // 不该被当成站点广告删掉。
  /群[^\n]{0,30}\d{7,}/,
  // 站方"温馨提醒"话术与引流括号群名
  /合理安排阅读时间|杜绝沉迷网络|尽在【[^】]{0,14}群】/,
];

// 一次粗筛再逐条定位：绝大多数正文行不会命中这条并集，省掉全行逐条扫描。
const AD_CUE_SOURCES = AD_CUES.map((re) => `(?:${re.source})`).join("|");
const AD_CUE_UNION = new RegExp(AD_CUE_SOURCES, "i");
// 挖掉一段文字里所有广告片段时用同一张表的 g 版
const AD_CUE_UNION_G = new RegExp(AD_CUE_SOURCES, "gi");

// 小说站点品牌名：一行里同时出现 ≥2 个基本不可能是正文（引流横幅的站名清单）
const AD_SITE_BRANDS = ["刺猬猫", "菠萝包", "飞卢", "飞泸", "点娘", "少年梦", "息壤", "次元姬", "笔趣阁", "纵横", "晋江", "17k", "18k", "起点", "番茄", "七猫", "搜书吧", "sxsy"];

// 前缀里带这些字样说明"切割点之前的部分也还是广告"（如「更多精彩小说请访问：」），
// 保留下来只会留半截引流话术，所以整行删除。
const AD_PREFIX_RESIDUE = /全网|资源|学习|试读|正版|盗版|版权|书荒|转码|防盗|浏览|输入|网址|http|群|收藏|请访问|更多精彩|更新\d/;
const AD_SYMBOL_HEAD = /^[\s=\-—─═_*#~|]{3,}/;
const AD_PROSE_TAIL = /[。！？…”』」]$/;
// 前缀停在没闭合的括号里（【千寻新免费满文件小说外群：…】被从"群"处切开时就是这样）——
// 那是广告自己的括号，不是正文断句，保留下来只剩半截。
const adPrefixTrailsInOpenBracket = (s: string): boolean => {
  const open = Math.max(s.lastIndexOf("【"), s.lastIndexOf("《"), s.lastIndexOf("（"), s.lastIndexOf("("));
  const close = Math.max(s.lastIndexOf("】"), s.lastIndexOf("》"), s.lastIndexOf("）"), s.lastIndexOf(")"));
  return open > close;
};
// 挖掉广告片段后，判断"剩下的是不是正文"专用：只认营销词（不含「输入/浏览」这类
// 普通动词，它们常出现在广告话术里但也会出现在正文里），且只数中日韩字——
// URL 残渣的字母不能算成正文长度。
const AD_MARKETING = /群|收藏|网址|http|www|\.com|\.cn|全网|资源|首发|笔阁|正版|盗版|版权|书荒|转码|更新|下载|访问|试读|牢记|域名|本站/;
const adCjkLen = (s: string): number => (s.match(/[一-鿿぀-ヿ]/g) || []).length;
const adContentLen = (s: string): number => (s.match(/[一-鿿぀-ヿA-Za-z0-9]/g) || []).length;
const adBrandCount = (s: string): number => {
  const low = s.toLowerCase();
  return AD_SITE_BRANDS.reduce((n, b) => n + (low.includes(b.toLowerCase()) ? 1 : 0), 0);
};

const AD_HTML_TAG = /<[^>\n]{1,400}>?/g;
// 广告线索命中处若落在 HTML 标签内部，就不能从这里下刀 —— 站点注入的
// <img src="https://aigcc.yuewen.com/imgChapter/…"> 是阅文的 AIGC 内容标识，
// 要整段留着；把标签里的网址切掉会留下半截坏标签。
function adInsideHtmlTag(line: string, at: number): boolean {
  AD_HTML_TAG.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = AD_HTML_TAG.exec(line)) !== null) {
    if (m.index <= at && at < m.index + m[0].length) return true;
    if (m.index > at) break;
  }
  return false;
}

// 排版类 HTML 标签：网页导出的 <p>/</p>/<div>/<br> 本来就是"分段/换行"的另一种写法，
// 转成断点；<font>/<span>/<em> 这类行内样式标签直接去掉，内容一个字不动。
// ⚠ 标签内必须不跨行且限长：防盗乱码里有 <I（三〒） 这种没有闭合的碎片，
// 若允许跨过换行去找下一个 >，就会一路吞掉中间整段正文。
// 白名单 + 标签名整词边界同理：语料里落在尖括号里的还有 <img> AIGC 标识、
// <Take Your Pills> 纪录片名、1.5<D<1.8 不等式，这些必须原样活着。
// ⚠ 标签名后必须紧跟 >、斜杠或空白才算标签：\b 在汉字前也算边界（汉字不是 \w），
// 只靠 \b 会把防盗乱码里的 "<P聣筫…" 当段落标签，一路吃到下一个 > 吞掉整段正文。
// 白名单 + 不跨行 + 限长三者缺一不可。
const HTML_BLOCK_TAG = /<\/?(?:p|div|br)(?=>|[/\s])[^>\n]{0,120}>/gi;
const HTML_INLINE_TAG = /<\/?(?:font|span|em|strong|small|center|u|i|b)(?=>|[/\s])[^>\n]{0,120}>/gi;

export const collapseHtmlLayoutTags = (text: string): string => text.replace(HTML_BLOCK_TAG, "\n\n").replace(HTML_INLINE_TAG, "");

// 盗版 TXT 的广告有两种形态：整行横幅（站点品牌名 + 群号 + 版权声明 + 符号包裹），
// 以及接在正文后面的广告尾巴（"…。请牢记收藏,网址 最新最快无防盗…"，也会插在句中）。
// 按线索定位：命中处即广告起点，前缀是成句正文就只裁尾巴，否则整行删。
// ⚠ 别回到"站点原文逐字命中 + [\s\S] 跨行拼块"的多行水印正则 —— 横幅措辞或标点
// 改一个字（品牌名单顺序、逗号有无）就整片失配，而站点天天改。
export const stripAdLines = (text: string): string => {
  const out: string[] = [];
  for (const rawLine of splitTextIntoLines(text)) {
    const line = rawLine.trim();
    if (!line || !AD_CUE_UNION.test(line)) {
      out.push(rawLine);
      continue;
    }
    let cut = -1;
    for (const re of AD_CUES) {
      const m = re.exec(line);
      if (m && m.index >= 0 && (cut === -1 || m.index < cut)) cut = m.index;
    }
    if (cut === -1) {
      // 只有并集粗筛命中、逐条线索都没定位到（例如正文里出现了品牌名之一）
      if (adBrandCount(line) >= 2 && line.length > 12) continue;
      out.push(rawLine);
      continue;
    }
    if (adInsideHtmlTag(line, cut)) {
      // 命中处在 HTML 标签里（注入的 <img> AIGC 标识等）：整行原样保留
      out.push(rawLine);
      continue;
    }
    if (AD_SYMBOL_HEAD.test(line)) continue; // 符号包头的横幅行，整行都是广告
    const prefix = line.slice(0, cut).trim();
    const tail = line.slice(cut);
    // 前缀本身就是广告（空、含引流残片、品牌名堆叠、停在未闭合的括号里）→ 整行删
    const prefixClean = !!prefix && !adPrefixTrailsInOpenBracket(prefix) && !AD_PREFIX_RESIDUE.test(prefix) && adBrandCount(prefix) <= 1;
    if (!prefixClean) continue;
    // 广告尾巴的特征：短、且不带句末标点。长过一句或自带 。！？ 说明它后面还有正文。
    const tailIsAdRun = tail.length <= 80 && !/[。！？]/.test(tail);
    if (!tailIsAdRun) {
      // 尾巴长过一句或自带句末标点：把尾巴里所有广告片段挖掉，剩下的是不是还有成句正文。
      // 剩下 ≥8 个实词字且不带引流话术 → 广告只是插在正文里的一小截，整行不动（宁留广告不吃正文）；
      // 否则整行都是广告（【月漪】提醒您：合理安排阅读时间…尽在【xx免费外群】。）。
      const residue = line.slice(cut).replace(AD_CUE_UNION_G, " ");
      if (adCjkLen(residue) >= 8 && !AD_MARKETING.test(residue)) out.push(rawLine);
      continue;
    }
    // 前缀够长（或本身就是「“好。”」这类带句末标点的短对话）就保留正文、只裁尾巴；
    // 前缀只是「5:」这种引子，说明整行都是广告 → 删行。
    if (adContentLen(prefix) >= 6 || (AD_PROSE_TAIL.test(prefix) && adContentLen(prefix) >= 1)) out.push(prefix);
  }
  return out.join("\n");
};

// 合并同章重复标题：相邻（"同章标题 / 同章标题"）或隔一行（"同章标题 / 单行 / 同章标题"）两种形态，
// 删除多余行，保留较长（更完整）的标题，等长留靠前者。在"去空行后"的序列上判断（忽略空行），贪心吸收链式重复。
export const collapseDuplicateChapterTitles = (lines: string[]): string[] => {
  const nonEmpty = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.trim());
  const drop = new Set<number>();
  // 将 from..to（含）之间所有原始行索引加入 drop，但跳过 except
  const dropRange = (from: number, to: number, except: number) => {
    for (let k = from; k <= to; k++) {
      if (k !== except) drop.add(k);
    }
  };
  let p = 0;
  while (p < nonEmpty.length) {
    if (!isTitleLine(nonEmpty[p].l)) {
      p += 1;
      continue;
    }
    let keepIdx = nonEmpty[p].i;
    let keepText = nonEmpty[p].l;
    let q = p;
    for (;;) {
      // 找下一个「同章重复标题」：gap=0 相邻（中间仅空行，已被过滤）；或 gap=1（同章标题 / 一行内容 / 同章标题）。
      // 相邻情形覆盖「半角() 与 全角（） 等仅标点宽度不同」的同章标题——它们逃过精确比较的 dedupeAdjacentLines，靠 isSameChapter 识别。
      let nextPos: number | null = null;
      if (q + 1 < nonEmpty.length && isTitleLine(nonEmpty[q + 1].l) && isSameChapter(keepText, nonEmpty[q + 1].l)) {
        nextPos = q + 1;
      } else if (q + 2 < nonEmpty.length && !isTitleLine(nonEmpty[q + 1].l) && isTitleLine(nonEmpty[q + 2].l) && isSameChapter(keepText, nonEmpty[q + 2].l)) {
        nextPos = q + 2;
      }
      if (nextPos === null) break;
      const next = nonEmpty[nextPos];
      if (next.l.trim().length > keepText.trim().length) {
        // 新标题更长：淘汰旧标题及其到新标题之间的所有行，保留新标题
        dropRange(keepIdx, next.i, next.i);
        keepIdx = next.i;
        keepText = next.l;
      } else {
        // 旧标题更长或等长：淘汰中间行到新标题之间的所有行，保留旧标题
        dropRange(keepIdx + 1, next.i, keepIdx);
      }
      q = nextPos;
    }
    p = q + 1;
  }
  return lines.filter((_, i) => !drop.has(i));
};

export interface NovelFormatOptions {
  enableChapterSplit: boolean;
  filterText: string;
  maxFilterLineLength: number;
  enableLineEndNumbers: boolean;
  enableParagraphSplit: boolean;
  smartLineBreak: boolean;
  enableTrim: boolean;
  mergeDuplicateChapterTitles: boolean;
  removeDuplicateLines: boolean;
  enableIndent: boolean;
  specialStart: string;
}

// 小说文本处理主管线（繁简转换在调用方完成后传入）：规范化 → 清杂质 → 半角 → 章节标记/分割/筛选/行尾数字 → 智能分段 → 行级去冗余 → 智能排版/压缩换行。
export const formatNovelText = async (text: string, opts: NovelFormatOptions): Promise<string> => {
  // 规范换行与清除常见小说杂质
  let processedInput = normalizeNewlines(text);
  processedInput = stripNovelArtifacts(processedInput);

  // 全角字符转半角
  processedInput = toHalfWidth(processedInput);

  // 排版标签先转断点，再做广告清理：让广告判据看到的是干净文本，
  // 而 <img> 等白名单外标签仍在，stripAdLines 的"标签内不下刀"守卫继续生效。
  processedInput = collapseHtmlLayoutTags(processedInput);

  // 广告行清理：整行横幅删除、正文行只裁广告尾巴。放在半角化之后 —— 群号与
  // 符号包裹横幅的判据都按半角数字/等号写，全角１０１２５１３０４７要先落地。
  processedInput = stripAdLines(processedInput);

  // 格式化章节标记和空格
  processedInput = processedInput
    .replace(new RegExp(`([${CHAPTER_MARKERS}])[、：:]`, "g"), "$1 ")
    .replace(/([\u4e00-\u9fa5]) {2,}([\u4e00-\u9fa5])/g, (match, g1, g2) => {
      // 压缩两个及以上连续空格为单个空格（保留单个空格，可能是人名/地名分隔），同时保留章节标记后的空格
      return CHAPTER_MARKERS.includes(g1) ? match : g1 + " " + g2;
    });

  if (opts.enableChapterSplit) {
    processedInput = splitInlineChapterTitles(processedInput);
  }
  if (opts.filterText) {
    processedInput = filterLines(processedInput, opts.filterText, { maxLen: opts.maxFilterLineLength });
  }
  if (opts.enableLineEndNumbers) {
    processedInput = removeLineEndNumbers(processedInput, 10);
  }
  if (opts.enableParagraphSplit) {
    processedInput = await splitParagraph(processedInput);
  }

  // 准备行数据
  let lines: string[];
  if (opts.smartLineBreak) {
    lines = cleanLines(processedInput, opts.enableTrim);
  } else {
    lines = splitTextIntoLines(processedInput);
    if (opts.enableTrim) {
      lines = lines.map((line) => line.trim());
    }
  }

  // 合并重复章节标题（噪声/分隔符处理已并入 smart 循环，非 smart 分支单独处理）
  const prepared = opts.mergeDuplicateChapterTitles ? collapseDuplicateChapterTitles(lines) : lines;

  // 删除相邻重复行
  const processedLines = opts.removeDuplicateLines ? dedupeAdjacentLines(prepared) : prepared;

  if (opts.smartLineBreak) {
    const result: string[] = [];
    const specialStartRegex = opts.specialStart ? new RegExp(`^${escapeRegExp(opts.specialStart)}`) : null;

    for (let i = 0; i < processedLines.length; i++) {
      const currentLine = processedLines[i];
      // 分卷阅读 导航标记(网文抓取常见)是噪声,剥离。但要像下方 isSeparatorBar 一样
      // 补段落断点 —— 否则标记前后两段会被 join("") 焊成一行(前句无尾标点时直接粘死),
      // 丢失卷/段边界。
      if (currentLine.startsWith("分卷阅读") && currentLine.length <= 10) {
        result.push("\n\n");
        continue;
      }

      // 分隔横幅（≥5 同符号）→ 段落断点：丢符号、保证上下不合并
      if (isSeparatorBar(currentLine)) {
        result.push("\n\n");
        continue;
      }

      const previousLine = i > 0 ? processedLines[i - 1].trim() : "";
      const isChapterOrNumber = isTitleLine(currentLine) || pureNumberRegex.test(currentLine);
      const isSpecialStart = novelSectionHeaderRegex.test(currentLine) || specialStartRegex?.test(currentLine.trim()) || (opts.specialStart && previousLine.startsWith(opts.specialStart));
      const startsWithSpecialChar = specialLineStartRegex.test(currentLine) || numberStartRegex.test(currentLine);
      const prevEndsWithPunctuation = punctuationEndRegex.test(previousLine) || numberEndRegex.test(previousLine) || isSeparatorBar(previousLine);

      if (isChapterOrNumber) {
        result.push("\n\n" + currentLine + (opts.enableIndent ? "\n\n　　" : "\n\n"));
      } else if (isSpecialStart) {
        result.push("\n\n" + currentLine);
      } else if (startsWithSpecialChar || prevEndsWithPunctuation) {
        result.push(opts.enableIndent ? "\n\n　　" + currentLine : "\n\n" + currentLine);
      } else {
        result.push(currentLine);
      }
    }

    processedInput = result.join("");
    // 先处理含段首缩进（两个全角空格）的特殊换行组合，避免被统一压缩破坏结构
    processedInput = processedInput.replace(/\n{2,}　　\n{2,}　　/g, "\n\n　　").replace(/\n{2,}　　\n{2,}/g, "\n\n");
    processedInput = compressNewlines(processedInput, 2).trim();
  } else {
    const kept = processedLines.filter((l) => !isSeparatorBar(l));
    processedInput = kept.join("\n");
    processedInput = compressNewlines(processedInput, 1).trim();
  }

  return processedInput;
};
