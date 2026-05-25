"use client";

import React from "react";
import { Table, Input, Button, Empty, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { Issues, ProtectedRule, RuleRow } from "./types";

// Switch antd Table to virtual scroll above this row count — below it the
// DOM is cheap enough that virtual scroll's per-row overhead is a net loss.
const VIRTUAL_THRESHOLD = 100;

type Props = {
  rows: RuleRow[];
  allRules: ProtectedRule[];
  issues: Issues;
  selectedKeys: number[];
  onSelectedKeysChange: (keys: number[]) => void;
  onUpdate: (originalIdx: number, field: "from" | "to", value: string) => void;
  onRemove: (originalIdx: number) => void;
};

const RuleTable: React.FC<Props> = ({ rows, allRules, issues, selectedKeys, onSelectedKeysChange, onUpdate, onRemove }) => {
  const t = useTranslations("ProtectedRuleManager");
  const tCommon = useTranslations("common");
  const useVirtual = allRules.length > VIRTUAL_THRESHOLD;

  const columns: ColumnsType<RuleRow> = [
    {
      title: t("colFrom"),
      dataIndex: "from",
      key: "from",
      width: 180,
      render: (_text, record) => {
        const winnerIdx = issues.shadowedRows.get(record.__originalIdx);
        const winner = winnerIdx !== undefined ? allRules[winnerIdx] : null;
        const tooltipText = !record.from
          ? t("fromEmpty")
          : winner
            ? t("shadowedTooltip", { rowNumber: winnerIdx! + 1, winnerTo: winner.to })
            : null;
        return (
          <Input
            size="small"
            value={record.from}
            onChange={(e) => onUpdate(record.__originalIdx, "from", e.target.value)}
            placeholder={t("fromPlaceholder")}
            suffix={
              <span style={{ display: "inline-flex", width: 14, justifyContent: "center" }}>
                {tooltipText && (
                  <Tooltip title={tooltipText}>
                    <WarningOutlined style={{ color: "var(--ant-color-warning)" }} />
                  </Tooltip>
                )}
              </span>
            }
          />
        );
      },
    },
    {
      title: t("colTo"),
      dataIndex: "to",
      key: "to",
      width: 180,
      render: (_text, record) => (
        <Input
          size="small"
          value={record.to}
          onChange={(e) => onUpdate(record.__originalIdx, "to", e.target.value)}
          placeholder={t("toPlaceholder")}
          suffix={
            <span style={{ display: "inline-flex", width: 14, justifyContent: "center" }}>
              {!record.to && (
                <Tooltip title={t("toEmpty")}>
                  <WarningOutlined style={{ color: "var(--ant-color-warning)" }} />
                </Tooltip>
              )}
            </span>
          }
        />
      ),
    },
    {
      title: "",
      key: "action",
      width: 48,
      render: (_text, record) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => onRemove(record.__originalIdx)}
          aria-label={tCommon("remove")}
        />
      ),
    },
  ];

  return (
    <Table<RuleRow>
      columns={columns}
      dataSource={rows}
      pagination={false}
      size="small"
      virtual={useVirtual}
      scroll={useVirtual ? { y: 480, x: 408 } : undefined}
      rowSelection={{
        selectedRowKeys: selectedKeys,
        onChange: (keys) => onSelectedKeysChange(keys.map((k) => Number(k))),
      }}
      locale={{
        emptyText: <Empty description={t("emptyTable")} image={Empty.PRESENTED_IMAGE_SIMPLE} />,
      }}
    />
  );
};

export default RuleTable;
