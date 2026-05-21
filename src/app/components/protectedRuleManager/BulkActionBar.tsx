"use client";

import React from "react";
import { Button, Flex, Popconfirm, Typography } from "antd";
import { DeleteOutlined, ExportOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";

type Props = {
  selectedCount: number;
  onDeleteSelected: () => void;
  onExportSelected: () => void;
  onClearSelection: () => void;
};

const BulkActionBar: React.FC<Props> = ({ selectedCount, onDeleteSelected, onExportSelected, onClearSelection }) => {
  const t = useTranslations("ProtectedRuleManager");
  const tCommon = useTranslations("common");
  if (selectedCount === 0) return null;

  return (
    <Flex gap="small" align="center" className="px-2 py-1 bg-[var(--ant-color-info-bg)] rounded">
      <Typography.Text className="!text-xs">
        {t("selectedCount", { count: selectedCount })}
      </Typography.Text>
      <Popconfirm
        title={t("confirmDeleteSelected", { count: selectedCount })}
        onConfirm={onDeleteSelected}
        okText={tCommon("remove")}
        cancelText={tCommon("cancel")}
        okButtonProps={{ danger: true }}>
        <Button size="small" danger icon={<DeleteOutlined />}>
          {t("deleteSelected")}
        </Button>
      </Popconfirm>
      <Button size="small" icon={<ExportOutlined />} onClick={onExportSelected}>
        {t("exportSelected", { count: selectedCount })}
      </Button>
      <Button size="small" type="link" className="!p-0" onClick={onClearSelection}>
        {t("clearSelection")}
      </Button>
    </Flex>
  );
};

export default BulkActionBar;
