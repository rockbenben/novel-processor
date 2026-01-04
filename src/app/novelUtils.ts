import { splitTextIntoLines, compressNewlines, chapterPattern, chapterTitleRegex, numberTitleRegex } from "@/app/utils";

// 将中文数字转为阿拉伯数字（支持到千级）
export const chineseNumeralToNumber = (input: string): number | null => {
  const map: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const unit: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
  let total = 0;
  let current = 0;
  let has = false;
  for (const ch of input) {
    if (map[ch] !== undefined) {
      current = current + map[ch];
      has = true;
    } else if (unit[ch] !== undefined) {
      if (current === 0) current = 1; // 十、百、千前省略“一”
      total += current * unit[ch];
      current = 0;
      has = true;
    } else if (/\d/.test(ch)) {
      return parseInt((input.match(/\d+/) || [""])[0], 10);
    }
  }
  if (!has) return null;
  return total + current;
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
  // 常见：第十二章 / 第12章 / 第三卷 第四章 / Chapter 5 / CH 5
  const m = title.match(/第([〇零一二三四五六七八九十百千两\d]+)\s*[章节回卷部篇节]/);
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

  const isTitle = (line: string) => chapterTitleRegex.test(line) || numberTitleRegex.test(line);

  for (const line of lines) {
    if (isTitle(line)) {
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
