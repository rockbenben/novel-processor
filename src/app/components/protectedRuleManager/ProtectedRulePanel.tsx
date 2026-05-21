"use client";

import React from "react";
import { Button, Flex, Switch, Tooltip, Typography, theme } from "antd";
import { EditOutlined, InboxOutlined, WarningOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import PageCard from "@/app/components/styled/PageCard";

interface ProtectedRulePanelProps {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  s2tCount: number;
  t2sCount: number;
  onOpenDrawer: () => void;
  /** When `enabled` is true but rules wouldn't apply in the current context
   *  (e.g. novel-processor with conversion turned off), pass a localized hint
   *  string here. Rendered as a subtle warning beneath the toggle row. */
  inactiveHint?: React.ReactNode;
}

/**
 * Compact status panel for the OpenCC custom-replacement rule manager.
 * Renders inside a PageCard so callers just drop it into their settings column.
 *
 * Shared between chinese-conversion and novel-processor (the two tools that
 * apply protectedDict during OpenCC conversion). i18n via the shared
 * "ProtectedRuleManager" namespace.
 */
const ProtectedRulePanel = ({ enabled, onEnabledChange, s2tCount, t2sCount, onOpenDrawer, inactiveHint }: ProtectedRulePanelProps) => {
  const t = useTranslations("ProtectedRuleManager");
  const { token } = theme.useToken();
  const totalCount = s2tCount + t2sCount;
  const dimStyle = { opacity: enabled ? 1 : 0.5, transition: "opacity 0.2s" };
  const showInactiveHint = enabled && Boolean(inactiveHint);

  return (
    <PageCard
      title={
        <Tooltip title={t("customReplaceTooltip")}>
          <span>{t("customReplace")}</span>
        </Tooltip>
      }
      extra={
        <Tooltip title={t("enableProtectedRulesTooltip")}>
          <Switch size="small" checked={enabled} onChange={onEnabledChange} aria-label={t("enableProtectedRules")} />
        </Tooltip>
      }>
      <Flex vertical gap="small">
        {showInactiveHint && (
          <Flex align="center" gap={6}>
            <WarningOutlined style={{ color: token.colorWarning, fontSize: 12 }} />
            <Typography.Text type="warning" className="!text-xs">
              {inactiveHint}
            </Typography.Text>
          </Flex>
        )}

        {totalCount === 0 ? (
          <Flex align="center" gap={6} style={dimStyle}>
            <InboxOutlined style={{ color: token.colorTextTertiary, fontSize: 12 }} />
            <Typography.Text type="secondary" className="!text-xs">
              {t("noRulesYet")}
            </Typography.Text>
          </Flex>
        ) : (
          <Flex vertical gap={4} style={dimStyle}>
            <Flex justify="space-between" align="center">
              <Typography.Text type="secondary" className="!text-xs">
                {t("directionS2t")}
              </Typography.Text>
              <Typography.Text strong className="!text-xs">
                {s2tCount}
              </Typography.Text>
            </Flex>
            <Flex justify="space-between" align="center">
              <Typography.Text type="secondary" className="!text-xs">
                {t("directionT2s")}
              </Typography.Text>
              <Typography.Text strong className="!text-xs">
                {t2sCount}
              </Typography.Text>
            </Flex>
          </Flex>
        )}

        <Button block icon={<EditOutlined />} onClick={onOpenDrawer}>
          {t("manageRules")}
        </Button>
      </Flex>
    </PageCard>
  );
};

export default ProtectedRulePanel;
