"use client";

import React from "react";
import { FontSizeOutlined } from "@ant-design/icons";
import { useTranslations, useLocale } from "next-intl";
import { getDocUrl } from "@/app/utils";
import ToolPage from "@/app/components/styled/ToolPage";
import NovelProcessor from "./NovelProcessor";

const ClientPage = () => {
  const t = useTranslations("NovelProcessor");
  const locale = useLocale();
  const userGuideUrl = getDocUrl("guide/tools/novel-processor.html", locale);

  return (
    <ToolPage icon={<FontSizeOutlined />} toolKey="novelProcessor" description={t("description")} guideUrl={userGuideUrl}>
      <NovelProcessor />
    </ToolPage>
  );
};

export default ClientPage;
