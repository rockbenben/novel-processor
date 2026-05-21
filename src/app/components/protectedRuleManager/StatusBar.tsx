"use client";

import React from "react";
import { Flex, Tag, Typography, Button } from "antd";
import { useTranslations } from "next-intl";
import type { IssueKind, Stats } from "./types";

type Props = {
  stats: Stats;
  issueFilter: IssueKind | null;
  onJumpToIssue: (kind: IssueKind) => void;
  onClearIssueFilter: () => void;
};

const StatusBar: React.FC<Props> = ({ stats, issueFilter, onJumpToIssue, onClearIssueFilter }) => {
  const t = useTranslations("ProtectedRuleManager");

  if (stats.total === 0) return null;

  const filteredCount = issueFilter === "empty" ? stats.empty : issueFilter === "shadowed" ? stats.shadowed : 0;
  const hasProblem = stats.empty > 0 || stats.shadowed > 0;

  return (
    <Flex vertical gap={4} className="px-2 py-1 bg-[var(--ant-color-fill-quaternary)] rounded">
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

export default StatusBar;
