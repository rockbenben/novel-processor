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

// trie 中实际生效的条数 = 总数 - 空值 - 被覆盖。两端 UI（ChineseConversion.tsx PageCard、Drawer tab）共用。
export function effectiveCount(rules: ProtectedRule[]): number {
  return rules.length - findEmpty(rules).size - findShadowed(rules).size;
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
