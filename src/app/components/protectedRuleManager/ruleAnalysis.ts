import type { ProtectedRule } from "./types";

// 同 from 的「运行时胜者」:转换两端(ChineseConversion / NovelProcessor)都是
// 先 filter(r => r.from && r.to) 再建词典 —— 空 to 的行根本进不了 trie。所以
// 胜者 = 【最后一条 to 非空】的行;该 from 全部 to 为空时退回最后一条(纯草
// 稿,无运行时行为)。⚠ 不能裸用「最后一条」:用户在工作规则(乾→乾)后面
// 加了一行同 from 的空 to 草稿再关抽屉,裸 last-wins 的 dedup 会把唯一生效的
// 那条删掉、只留下无操作的草稿 —— 持久化数据丢失,保护静默失效。
function effectiveWinnerIdxByFrom(rules: ProtectedRule[]): Map<string, number> {
  const winner = new Map<string, number>();
  const lastCompleteIdx = new Map<string, number>();
  rules.forEach((r, i) => {
    if (!r.from) return;
    winner.set(r.from, i);
    if (r.to) lastCompleteIdx.set(r.from, i);
  });
  for (const [from, i] of lastCompleteIdx) winner.set(from, i);
  return winner;
}

export function dedupRules(rules: ProtectedRule[]): { deduped: ProtectedRule[]; removed: number } {
  const winnerIdxByFrom = effectiveWinnerIdxByFrom(rules);
  const deduped = rules.filter((r, i) => !r.from || winnerIdxByFrom.get(r.from) === i);
  return { deduped, removed: rules.length - deduped.length };
}

export function findEmpty(rules: ProtectedRule[]): Set<number> {
  const out = new Set<number>();
  rules.forEach((r, i) => {
    if (!r.from || !r.to) out.add(i);
  });
  return out;
}

// trie 中实际生效的条数 = 总数 - （空值 ∪ 被覆盖）。两端 UI（ChineseConversion.tsx PageCard、Drawer tab）共用。
// 同一行可能【既空值又被覆盖】(非空 from + 空 to + 同 from 有后续胜者) —— 分别相减会把它扣两次，
// 生效数出现错误的负值/偏小值。按并集只扣一次。
export function effectiveCount(rules: ProtectedRule[]): number {
  const ineffective = new Set<number>([...findEmpty(rules), ...findShadowed(rules).keys()]);
  return rules.length - ineffective.size;
}

// loserIdx -> winnerIdx：同 from 的行里，运行时胜者（见 effectiveWinnerIdxByFrom）之外都是 shadowed loser。
export function findShadowed(rules: ProtectedRule[]): Map<number, number> {
  const winnerIdxByFrom = effectiveWinnerIdxByFrom(rules);
  const shadowed = new Map<number, number>();
  rules.forEach((r, i) => {
    if (!r.from) return;
    const winner = winnerIdxByFrom.get(r.from)!;
    if (winner !== i) shadowed.set(i, winner);
  });
  return shadowed;
}
