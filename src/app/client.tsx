"use client";

import React from "react";
import { Typography } from "antd";
import { QuestionCircleOutlined, FontSizeOutlined } from "@ant-design/icons";
import NovelProcessor from "./NovelProcessor";

const { Title, Paragraph, Link } = Typography;

const ClientPage = () => {
  return (
    <>
      <Title level={3}>
        <FontSizeOutlined /> 小说文本整理器
      </Title>
      <Paragraph type="secondary" ellipsis={{ rows: 3, expandable: true, symbol: "more" }}>
        <Link href="https://docs.newzone.top/guide/others/novel-processor.html" target="_blank" rel="noopener noreferrer">
          <QuestionCircleOutlined /> 使用说明
        </Link>{" "}
        专为网络小说文本整理设计，一键修复下载小说的格式问题。集成智能换行、章节分割、段落缩进、繁简转换、删除重复行、垃圾内容过滤等功能，让杂乱的小说文本变得整齐易读。
      </Paragraph>
      <NovelProcessor />
    </>
  );
};

export default ClientPage;
