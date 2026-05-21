"use client";

import React from "react";
import { Input, Segmented, Flex, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { SortMode } from "./types";

type Props = {
  searchText: string;
  onSearchTextChange: (text: string) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  totalCount: number;
  filteredCount: number;
};

const SearchSortBar: React.FC<Props> = ({ searchText, onSearchTextChange, sortMode, onSortModeChange, totalCount, filteredCount }) => {
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

export default SearchSortBar;
