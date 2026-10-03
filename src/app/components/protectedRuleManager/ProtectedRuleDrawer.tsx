"use client";

import React, { useRef } from "react";
import { Drawer, Tabs, Button, Popconfirm, Typography, Flex, App, Input, Segmented, Tag } from "antd";
import { PlusOutlined, ClearOutlined, ImportOutlined, ExportOutlined, DeleteOutlined, SearchOutlined } from "@ant-design/icons";
import { downloadFile, readTextFile, getErrorMessage } from "@/app/utils";
import { useTranslations } from "next-intl";
import { useRuleManager } from "./useRuleManager";
import RuleTable from "./RuleTable";
import type { Direction, IssueKind, ProtectedRule, SortMode, Stats } from "./types";

// 三条只在这个抽屉里用的工具栏(状态 / 搜索排序 / 批量操作),曾各占一个文件。
type StatusBarProps = {
  stats: Stats;
  issueFilter: IssueKind | null;
  onJumpToIssue: (kind: IssueKind) => void;
  onClearIssueFilter: () => void;
};

const StatusBar: React.FC<StatusBarProps> = ({ stats, issueFilter, onJumpToIssue, onClearIssueFilter }) => {
  const t = useTranslations("ProtectedRuleManager");

  if (stats.total === 0) return null;

  const filteredCount = issueFilter === "empty" ? stats.empty : issueFilter === "shadowed" ? stats.shadowed : 0;
  const hasProblem = stats.empty > 0 || stats.shadowed > 0;

  return (
    <Flex vertical gap={4} className="px-2 py-1 bg-[var(--ant-color-fill-quaternary)]">
      <Typography.Text type="secondary" className="!text-xs">
        {t("statusCounts", { total: stats.total, valid: stats.valid })}
      </Typography.Text>

      {issueFilter ? (
        <Flex align="center" gap="small">
          <Tag color="processing" className="!m-0">
            {t("showingIssues", { count: filteredCount })}
          </Tag>
          <Button size="small" type="link" className="!p-0" onClick={onClearIssueFilter}>
            {t("clearFilter")}
          </Button>
        </Flex>
      ) : (
        hasProblem && (
          <Flex gap="small" align="center" wrap>
            {stats.empty > 0 && (
              <Button size="small" type="link" className="!p-0 !h-auto" onClick={() => onJumpToIssue("empty")}>
                <Typography.Text type="warning" className="!text-xs">
                  {t("emptyCount", { count: stats.empty })}
                </Typography.Text>
              </Button>
            )}
            {stats.shadowed > 0 && (
              <Button size="small" type="link" className="!p-0 !h-auto" onClick={() => onJumpToIssue("shadowed")}>
                <Typography.Text type="warning" className="!text-xs">
                  {t("shadowedCount", { count: stats.shadowed })}
                </Typography.Text>
              </Button>
            )}
          </Flex>
        )
      )}
    </Flex>
  );
};

type SearchSortBarProps = {
  searchText: string;
  onSearchTextChange: (text: string) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  totalCount: number;
  filteredCount: number;
};

const SearchSortBar: React.FC<SearchSortBarProps> = ({ searchText, onSearchTextChange, sortMode, onSortModeChange, totalCount, filteredCount }) => {
  const t = useTranslations("ProtectedRuleManager");
  const filtering = Boolean(searchText) && filteredCount !== totalCount;

  return (
    <Flex gap="small" align="center" wrap>
      <Input
        size="small"
        prefix={<SearchOutlined />}
        placeholder={t("searchPlaceholder")}
        value={searchText}
        onChange={(e) => onSearchTextChange(e.target.value)}
        allowClear
        className="flex-1 !min-w-[180px]"
        aria-label={t("searchAriaLabel")}
      />
      <Segmented<SortMode>
        size="small"
        value={sortMode}
        onChange={onSortModeChange}
        options={[
          { label: t("sortOriginal"), value: "original" },
          { label: t("sortAlphabetical"), value: "from-asc" },
          { label: t("sortRecent"), value: "recent" },
        ]}
      />
      {filtering && (
        <Typography.Text type="secondary" className="!text-xs">
          {t("filteringCount", { filtered: filteredCount, total: totalCount })}
        </Typography.Text>
      )}
    </Flex>
  );
};

type BulkActionBarProps = {
  selectedCount: number;
  onDeleteSelected: () => void;
  onExportSelected: () => void;
  onClearSelection: () => void;
};

const BulkActionBar: React.FC<BulkActionBarProps> = ({ selectedCount, onDeleteSelected, onExportSelected, onClearSelection }) => {
  const t = useTranslations("ProtectedRuleManager");
  const tCommon = useTranslations("common");
  if (selectedCount === 0) return null;

  return (
    <Flex gap="small" align="center" className="px-2 py-1 bg-[var(--ant-color-info-bg)]">
      <Typography.Text className="!text-xs">
        {t("selectedCount", { count: selectedCount })}
      </Typography.Text>
      <Popconfirm
        title={t("confirmDeleteSelected", { count: selectedCount })}
        onConfirm={onDeleteSelected}
        okText={tCommon("remove")}
        cancelText={tCommon("cancel")}
        okButtonProps={{ danger: true }}>
        <Button size="small" danger icon={<DeleteOutlined aria-hidden />}>
          {t("deleteSelected")}
        </Button>
      </Popconfirm>
      <Button size="small" icon={<ExportOutlined aria-hidden />} onClick={onExportSelected}>
        {t("exportSelected", { count: selectedCount })}
      </Button>
      <Button size="small" type="link" className="!p-0" onClick={onClearSelection}>
        {t("clearSelection")}
      </Button>
    </Flex>
  );
};

type Props = {
  open: boolean;
  onClose: () => void;
  s2tRules: ProtectedRule[];
  setS2tRules: (rules: ProtectedRule[]) => void;
  t2sRules: ProtectedRule[];
  setT2sRules: (rules: ProtectedRule[]) => void;
};

const ProtectedRuleDrawer: React.FC<Props> = ({ open, onClose, s2tRules, setS2tRules, t2sRules, setT2sRules }) => {
  const t = useTranslations("ProtectedRuleManager");
  const tCommon = useTranslations("common");
  const { message } = App.useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rm = useRuleManager(s2tRules, setS2tRules, t2sRules, setT2sRules);

  const directionLabel = rm.activeKey === "s2t" ? t("directionS2t") : t("directionT2s");

  const handleUpdate = (idx: number, field: "from" | "to", val: string) => {
    const { sanitized } = rm.updateRule(idx, field, val);
    // Keyed: editing several cells in a row collapses repeats into one toast.
    if (sanitized) message.warning({ content: t("puaSanitized"), key: "pua-sanitized" });
  };

  const handleClearAll = () => {
    rm.clearAll();
    message.success(t("clearedDirection", { direction: directionLabel }));
  };

  const handleDeleteSelected = () => {
    const count = rm.selectedKeys.length;
    rm.removeRules(rm.selectedKeys);
    message.success(t("deletedNRules", { count }));
  };

  const writeExport = async (rules: ProtectedRule[], suffix: string) => {
    const lines = rules.map((r) => `${r.from}\t${r.to}`);
    if (lines.length === 0) {
      message.warning(t("exportEmpty"));
      return;
    }
    const header = `# js-opencc protected dictionary (${rm.activeKey} direction)\n# Format: <key><TAB><value>\n# Exported from chinese-conversion tool\n\n`;
    try {
      await downloadFile(header + lines.join("\n") + "\n", `protected_${rm.activeKey}${suffix}.txt`);
      message.success(t("exportedNRules", { count: lines.length }));
    } catch {
      message.error(tCommon("exportSettingError"));
    }
  };

  const handleExportAll = () => {
    writeExport(rm.exportableRules(), "");
  };

  const handleExportSelected = () => {
    writeExport(rm.exportableRules(rm.selectedKeys), "_selected");
  };

  const handleClose = () => {
    const removed = rm.dedupAllDirections();
    if (removed > 0) message.info(t("autoDeduped", { count: removed }));
    onClose();
  };

  const handleImportFile = async (file: File) => {
    // readTextFile(decodeFileBytes)而非 readAsText:readAsText 只按 UTF-8 解,GBK/ANSI
    // 词典(中文 Windows 导出常态)被解成 U+FFFD 乱码后仍能过非空过滤 —— 损坏规则被
    // 静默持久化还报导入成功,转换时永不匹配。
    let text: string;
    try {
      text = await readTextFile(file);
    } catch (error) {
      console.error("Rule import failed:", error);
      // 【带上原始消息】,同 useFileUpload / GlossaryDrawer:decodeFileBytes 判不出
      // 编码时抛的是可操作指引("re-save the file as UTF-8"),裸 fileReadFailed
      // 把它吞掉,而本抽屉同样没有手动选编码的入口。
      message.error(`${tCommon("fileReadFailed")}: ${getErrorMessage(error)}`);
      return;
    }
    // 按【首个 TAB】切,target 整体保留(含空格)。parseOpenCCDict 的
    // OpenCC 语义把空格当"多候选值"分隔符 —— 本工具导出的
    // `纽约\tNew York` round-trip 会被截成 `New`(空格 target 是保护词典
    // 的核心用例)。无 TAB 时退化按首个空格切,余下整体作 target。
    const parsed = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l): [string, string] | null => {
        const tab = l.indexOf("\t");
        const sep = tab !== -1 ? tab : l.indexOf(" ");
        if (sep === -1) return null;
        return [l.slice(0, sep).trim(), l.slice(sep + 1).trim()];
      })
      .filter((p): p is [string, string] => p !== null && !!p[0] && !!p[1]);
    if (parsed.length === 0) {
      message.warning(t("importNoRules"));
      return;
    }
    const incoming: ProtectedRule[] = parsed.map(([from, to]) => ({ from, to }));
    const { added, removedDup } = rm.importRules(incoming);
    if (removedDup > 0) {
      message.success(t("importedWithDedup", { added, direction: directionLabel, dedup: removedDup }));
    } else {
      message.success(t("imported", { added, direction: directionLabel }));
    }
  };

  return (
    <Drawer
      title={t("drawerTitle")}
      open={open}
      onClose={handleClose}
      size="large"
      destroyOnHidden={false}
      extra={
        rm.currentRules.length > 0 && (
          <Popconfirm
            title={t("confirmClearAll")}
            onConfirm={handleClearAll}
            okText={tCommon("clearAll")}
            cancelText={tCommon("cancel")}
            okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<ClearOutlined aria-hidden />}>
              {tCommon("clearAll")}
            </Button>
          </Popconfirm>
        )
      }>
      <Flex vertical gap="small">
        <Typography.Paragraph type="secondary" className="!text-xs !mb-0">
          {t("description")}
        </Typography.Paragraph>

        <Tabs
          activeKey={rm.activeKey}
          onChange={(k) => rm.setActiveKey(k as Direction)}
          items={[
            { key: "s2t", label: `${t("directionS2t")} (${rm.counts.s2t})` },
            { key: "t2s", label: `${t("directionT2s")} (${rm.counts.t2s})` },
          ]}
        />

        <StatusBar
          stats={rm.stats}
          issueFilter={rm.issueFilter}
          onJumpToIssue={rm.setIssueFilter}
          onClearIssueFilter={() => rm.setIssueFilter(null)}
        />

        <SearchSortBar
          searchText={rm.searchText}
          onSearchTextChange={rm.setSearchText}
          sortMode={rm.sortMode}
          onSortModeChange={rm.setSortMode}
          totalCount={rm.currentRules.length}
          filteredCount={rm.filteredSorted.length}
        />

        <BulkActionBar
          selectedCount={rm.selectedKeys.length}
          onDeleteSelected={handleDeleteSelected}
          onExportSelected={handleExportSelected}
          onClearSelection={() => rm.setSelectedKeys([])}
        />

        <RuleTable
          rows={rm.filteredSorted}
          allRules={rm.currentRules}
          issues={rm.issues}
          selectedKeys={rm.selectedKeys}
          onSelectedKeysChange={rm.setSelectedKeys}
          onUpdate={handleUpdate}
          onRemove={(idx) => rm.removeRules([idx])}
        />

        <Flex gap="small">
          <Button block icon={<PlusOutlined aria-hidden />} onClick={rm.addRule}>
            {t("addRule")}
          </Button>
          <Button icon={<ImportOutlined aria-hidden />} onClick={() => fileInputRef.current?.click()}>
            {t("importBtn")}
          </Button>
          <Button icon={<ExportOutlined aria-hidden />} onClick={handleExportAll} disabled={rm.selectedKeys.length > 0}>
            {t("exportAll")}
          </Button>
        </Flex>

        <Typography.Paragraph type="secondary" className="!text-xs !mb-0">
          {t("importHint")}
        </Typography.Paragraph>

        <input
          type="file"
          ref={fileInputRef}
          hidden
          accept=".txt,text/plain"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImportFile(f);
            e.target.value = "";
          }}
        />
      </Flex>
    </Drawer>
  );
};

export default ProtectedRuleDrawer;
