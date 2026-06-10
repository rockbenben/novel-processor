import type { ProtectedRule } from "./types";

export function dedupRules(rules: ProtectedRule[]): { deduped: ProtectedRule[]; removed: number } {
  const lastIdxByFrom = new Map<string, number>();
  rules.forEach((r, i) => {
    if (r.from) lastIdxByFrom.set(r.from, i);
  });
  const deduped = rules.filter((r, i) => !r.from || lastIdxByFrom.get(r.from) === i);
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

// loserIdx -> winnerIdx：同 from 的行里，最后一条（trie 实际生效）是 winner，其余都是 shadowed loser。
export function findShadowed(rules: ProtectedRule[]): Map<number, number> {
  const lastIdxByFrom = new Map<string, number>();
  rules.forEach((r, i) => {
    if (r.from) lastIdxByFrom.set(r.from, i);
  });
  const shadowed = new Map<number, number>();
  rules.forEach((r, i) => {
    if (!r.from) return;
    const winner = lastIdxByFrom.get(r.from)!;
    if (winner !== i) shadowed.set(i, winner);
  });
  return shadowed;
}
