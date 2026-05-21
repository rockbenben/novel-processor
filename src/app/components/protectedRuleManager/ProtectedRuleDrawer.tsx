"use client";

import React, { useRef } from "react";
import { Drawer, Tabs, Button, Popconfirm, Typography, Flex, App } from "antd";
import { PlusOutlined, ClearOutlined, ImportOutlined, ExportOutlined } from "@ant-design/icons";
import { parseOpenCCDict } from "js-opencc";
import { downloadFile } from "@/app/utils";
import { useTranslations } from "next-intl";
import { useRuleManager } from "./useRuleManager";
import StatusBar from "./StatusBar";
import SearchSortBar from "./SearchSortBar";
import BulkActionBar from "./BulkActionBar";
import RuleTable from "./RuleTable";
import type { Direction, ProtectedRule } from "./types";

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
    if (sanitized) message.warning(t("puaSanitized"));
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

  const writeExport = (rules: ProtectedRule[], suffix: string) => {
    const lines = rules.map((r) => `${r.from}\t${r.to}`);
    if (lines.length === 0) {
      message.warning(t("exportEmpty"));
      return;
    }
    const header = `# js-opencc protected dictionary (${rm.activeKey} direction)\n# Format: <key><TAB><value>\n# Exported from chinese-conversion tool\n\n`;
    downloadFile(header + lines.join("\n") + "\n", `protected_${rm.activeKey}${suffix}.txt`);
    message.success(t("exportedNRules", { count: lines.length }));
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

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== "string") {
        message.error(t("fileReadFailed"));
        return;
      }
      const parsed = parseOpenCCDict(text);
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
    reader.onerror = () => message.error(t("fileReadFailed"));
    reader.readAsText(file);
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
            <Button size="small" danger icon={<ClearOutlined />}>
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
          <Button block icon={<PlusOutlined />} onClick={rm.addRule}>
            {t("addRule")}
          </Button>
          <Button icon={<ImportOutlined />} onClick={() => fileInputRef.current?.click()}>
            {t("importBtn")}
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExportAll} disabled={rm.selectedKeys.length > 0}>
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
            if (f) handleImportFile(f);
            e.target.value = "";
          }}
        />
      </Flex>
    </Drawer>
  );
};

export default ProtectedRuleDrawer;
