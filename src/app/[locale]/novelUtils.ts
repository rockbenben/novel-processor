import { splitTextIntoLines, compressNewlines, chapterPattern, chapterTitleRegex, numberTitleRegex, normalizeNewlines, toHalfWidth, cleanLines, filterLines, splitParagraph, dedupeAdjacentLines, isSeparatorBar, escapeRegExp, pureNumberRegex, novelSectionHeaderRegex, specialLineStartRegex, numberStartRegex, punctuationEndRegex, numberEndRegex, CHAPTER_MARKERS } from "@/app/utils";

// 行是否为章节标题（章节标题正则或数字标题正则）
const isTitleLine = (line: string): boolean => chapterTitleRegex.test(line) || numberTitleRegex.test(line);

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
      return parseInt((input.match(/\d+/) || [""])[0], 10);
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
    const raw = m[1];
    if (/\d+/.test(raw)) {
      const match = raw.match(/\d+/);
      return match ? parseInt(match[0], 10) : null;
    }
    const cn = chineseNumeralToNumber(raw);
    if (cn !== null) return cn;
  }
  const en = title.match(/\b(?:chapter|ch)\.?\s*(\d+)\b/i);
  if (en) return parseInt(en[1], 10);

  const roman = title.match(/\b(?:chapter|ch)\.?\s*([ivxlcdm]+)\b/i);
  if (roman) {
    const r = romanToInt(roman[1]);
    if (r !== null) return r;
  }

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
  withIndex.sort((a, b) => {
    if (a.order === null && b.order === null) return a.i - b.i;
    if (a.order === null) return 1;
    if (b.order === null) return -1;
    if (a.order !== b.order) return a.order - b.order;
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
      .replace(/本文是使用怠惰小说下载器（DownloadAllContent）下载的/g, "")
      .replace(/本书由【.*?】整理[\s\S]{0,500}?请在下载后\d+小时内删除[\s\S]{0,500}?本群免费提取全网平台[\s\S]{0,50}?私聊群主。/g, "")
      .replace(/={10,}\n?[\s\S]{0,500}?刺猬猫，飞卢，点娘，少年梦等全网小说资源每日更新[\s\S]{0,500}?如不慎该资源侵犯了您的权益，请麻烦通知我们及时删除。\n?={10,}/g, "")
      // 没有等号包裹的版本
      .replace(/刺猬猫，飞卢，点娘，少年梦等全网小说资源每日更新[\s\S]{0,500}?如不慎该资源侵犯了您的权益，请麻烦通知我们及时删除。/g, "")
  );
  // 站点版权/导航提示类
  // 重复空行压缩交给主流程
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
    processedInput = filterLines(processedInput, opts.filterText, opts.maxFilterLineLength);
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
      if (currentLine.startsWith("分卷阅读") && currentLine.length <= 10) {
        continue;
      }

      // 分隔横幅（≥5 同符号）→ 段落断点：丢符号、保证上下不合并
      if (isSeparatorBar(currentLine)) {
        result.push("\n\n");
        continue;
      }

      const previousLine = i > 0 ? processedLines[i - 1].trim() : "";
      const isChapterOrNumber = chapterTitleRegex.test(currentLine) || numberTitleRegex.test(currentLine) || pureNumberRegex.test(currentLine);
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
