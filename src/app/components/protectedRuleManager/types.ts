export type ProtectedRule = { from: string; to: string };

export type Direction = "s2t" | "t2s";

export type SortMode = "original" | "from-asc" | "recent";

export type IssueKind = "empty" | "shadowed";

export type Issues = {
  emptyRows: Set<number>;
  shadowedRows: Map<number, number>; // loserIdx -> winnerIdx
};

export type Stats = {
  total: number;
  valid: number;
  empty: number;
  shadowed: number;
};

// Table row type: base rule + original index (so sorted rows can still mutate the underlying array by originalIdx)
export type RuleRow = ProtectedRule & {
  __originalIdx: number;
  key: number;
};
