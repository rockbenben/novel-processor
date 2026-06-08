"use client";

import { useMemo, useState, useCallback } from "react";
import { dedupRules, effectiveCount, findEmpty, findShadowed } from "./ruleAnalysis";
import type { Direction, IssueKind, Issues, ProtectedRule, RuleRow, SortMode, Stats } from "./types";

// PUA Plane 0 是 js-opencc 内部占位符段 — 用户输入需剔除
const sanitizeRuleField = (s: string): string =>
  Array.from(s)
    .filter((c) => {
      const cp = c.codePointAt(0)!;
      return cp < 0xe000 || cp > 0xf8ff;
    })
    .join("");

export type RuleManagerAPI = {
  activeKey: Direction;
  setActiveKey: (key: Direction) => void;

  currentRules: ProtectedRule[];

  searchText: string;
  setSearchText: (text: string) => void;

  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;

  selectedKeys: number[];
  setSelectedKeys: (keys: number[]) => void;

  issueFilter: IssueKind | null;
  setIssueFilter: (kind: IssueKind | null) => void;

  filteredSorted: RuleRow[];
  issues: Issues;
  stats: Stats;
  counts: { s2t: number; t2s: number };

  updateRule: (idx: number, field: "from" | "to", val: string) => { sanitized: boolean };
  addRule: () => void;
  removeRules: (indices: number[]) => void;
  clearAll: () => void;
  importRules: (incoming: ProtectedRule[]) => { added: number; removedDup: number };
  // 传 selectedKeys 时只导出选中行；否则导出全部。两条路径走相同的 dedup + filter-empty。
  exportableRules: (selectedKeys?: number[]) => ProtectedRule[];
  // 对两个方向都跑 dedup，返回总共去除的条数。用于 Drawer 关闭时整理持久化数据。
  dedupAllDirections: () => number;
};

export function useRuleManager(
  s2tRules: ProtectedRule[],
  setS2tRules: (rules: ProtectedRule[]) => void,
  t2sRules: ProtectedRule[],
  setT2sRules: (rules: ProtectedRule[]) => void,
): RuleManagerAPI {
  const [activeKey, setActiveKeyRaw] = useState<Direction>("s2t");
  const [searchText, setSearchTextRaw] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("original");
  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);
  const [issueFilter, setIssueFilterRaw] = useState<IssueKind | null>(null);

  const currentRules = activeKey === "s2t" ? s2tRules : t2sRules;
  const setCurrentRules = activeKey === "s2t" ? setS2tRules : setT2sRules;

  // 切方向时清掉方向相关状态
  const setActiveKey = useCallback((key: Direction) => {
    setActiveKeyRaw(key);
    setSelectedKeys([]);
    setIssueFilterRaw(null);
  }, []);

  // 搜索和 issueFilter 互斥
  const setSearchText = useCallback((text: string) => {
    setSearchTextRaw(text);
    if (text) setIssueFilterRaw(null);
  }, []);

  const setIssueFilter = useCallback((kind: IssueKind | null) => {
    setIssueFilterRaw(kind);
    if (kind) setSearchTextRaw("");
  }, []);

  const issues = useMemo<Issues>(
    () => ({
      emptyRows: findEmpty(currentRules),
      shadowedRows: findShadowed(currentRules),
    }),
    [currentRules]
  );

  const stats = useMemo<Stats>(() => {
    const total = currentRules.length;
    const empty = issues.emptyRows.size;
    const shadowed = issues.shadowedRows.size;
    // valid = 实际在 trie 中生效的条数（剔除空值和被覆盖）
    const valid = total - empty - shadowed;
    return { total, valid, empty, shadowed };
  }, [currentRules, issues]);

  const counts = useMemo(
    () => ({ s2t: effectiveCount(s2tRules), t2s: effectiveCount(t2sRules) }),
    [s2tRules, t2sRules]
  );

  const filteredSorted = useMemo<RuleRow[]>(() => {
    const rows: RuleRow[] = currentRules.map((r, i) => ({ ...r, __originalIdx: i, key: i }));

    let filtered = rows;
    if (issueFilter === "empty") {
      filtered = rows.filter((r) => issues.emptyRows.has(r.__originalIdx));
    } else if (issueFilter === "shadowed") {
      filtered = rows.filter((r) => issues.shadowedRows.has(r.__originalIdx));
    } else if (searchText) {
      const needle = searchText.toLowerCase();
      filtered = rows.filter((r) => r.from.toLowerCase().includes(needle) || r.to.toLowerCase().includes(needle));
    }

    if (sortMode === "from-asc") {
      filtered = [...filtered].sort((a, b) => a.from.localeCompare(b.from));
    } else if (sortMode === "recent") {
      filtered = [...filtered].sort((a, b) => b.__originalIdx - a.__originalIdx);
    }
    return filtered;
  }, [currentRules, issues, issueFilter, searchText, sortMode]);

  const updateRule = useCallback(
    (idx: number, field: "from" | "to", rawValue: string) => {
      const sanitized = sanitizeRuleField(rawValue);
      const next = currentRules.map((rule, i) => (i === idx ? { ...rule, [field]: sanitized } : rule));
      setCurrentRules(next);
      return { sanitized: sanitized !== rawValue };
    },
    [currentRules, setCurrentRules]
  );

  const addRule = useCallback(() => {
    setCurrentRules([...currentRules, { from: "", to: "" }]);
  }, [currentRules, setCurrentRules]);

  const removeRules = useCallback(
    (indices: number[]) => {
      const toRemove = new Set(indices);
      setCurrentRules(currentRules.filter((_, i) => !toRemove.has(i)));
      // 删除后行索引整体左移,但 selectedKeys 存的是删除前的索引 —— 仅过滤
      // 被删 key 会让选中悄悄漂移到其它行,后续批量删除/导出命中错误规则。
      // 重映射:每个保留的选中索引减去其前方被删元素的数量。
      setSelectedKeys((prev) => prev.filter((k) => !toRemove.has(k)).map((k) => k - indices.filter((removed) => removed < k).length));
    },
    [currentRules, setCurrentRules]
  );

  const clearAll = useCallback(() => {
    setCurrentRules([]);
    setSelectedKeys([]);
    setIssueFilterRaw(null);
  }, [setCurrentRules]);

  const importRules = useCallback(
    (incoming: ProtectedRule[]) => {
      const sanitized = incoming.map((r) => ({ from: sanitizeRuleField(r.from), to: sanitizeRuleField(r.to) }));
      const merged = [...currentRules, ...sanitized];
      const { deduped, removed } = dedupRules(merged);
      setCurrentRules(deduped);
      return { added: sanitized.length, removedDup: removed };
    },
    [currentRules, setCurrentRules]
  );

  const exportableRules = useCallback(
    (selectedKeys?: number[]) => {
      const source = selectedKeys ? currentRules.filter((_, i) => selectedKeys.includes(i)) : currentRules;
      const { deduped } = dedupRules(source);
      return deduped.filter((r) => r.from && r.to);
    },
    [currentRules]
  );

  const dedupAllDirections = useCallback(() => {
    const s2tResult = dedupRules(s2tRules);
    const t2sResult = dedupRules(t2sRules);
    if (s2tResult.removed > 0) setS2tRules(s2tResult.deduped);
    if (t2sResult.removed > 0) setT2sRules(t2sResult.deduped);
    return s2tResult.removed + t2sResult.removed;
  }, [s2tRules, t2sRules, setS2tRules, setT2sRules]);

  return {
    activeKey,
    setActiveKey,
    currentRules,
    searchText,
    setSearchText,
    sortMode,
    setSortMode,
    selectedKeys,
    setSelectedKeys,
    issueFilter,
    setIssueFilter,
    filteredSorted,
    issues,
    stats,
    counts,
    updateRule,
    addRule,
    removeRules,
    clearAll,
    importRules,
    exportableRules,
    dedupAllDirections,
  };
}
