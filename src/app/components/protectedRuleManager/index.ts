// Public API of the ProtectedRuleManager module.
// Used by any chinese-conversion-style tool that needs OpenCC protectedDict management
// (chinese-conversion, novel-processor, etc.).
export { default as ProtectedRuleDrawer } from "./ProtectedRuleDrawer";
export { default as ProtectedRulePanel } from "./ProtectedRulePanel";
export type { ProtectedRule, Direction, SortMode, IssueKind, Issues, Stats, RuleRow } from "./types";
export { dedupRules, effectiveCount, findEmpty, findShadowed } from "./ruleAnalysis";
