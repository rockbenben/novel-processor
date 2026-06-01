"use client";

import React, { useState } from "react";
import { Button, Input, InputNumber, Typography, Space, Flex, App, Tooltip, Upload, Switch, Spin, Row, Col, Collapse, Divider, Segmented } from "antd";
import { InboxOutlined, FileTextOutlined, ScissorOutlined, ClearOutlined, OrderedListOutlined, PlayCircleOutlined, ControlOutlined } from "@ant-design/icons";
import {
  splitTextIntoLines,
  downloadFile,
  getFileTypePresetConfig,
} from "@/app/utils";
import { useTextStats } from "@/app/hooks/useTextStats";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";
import { reorderChaptersByTitle, splitInlineChapterTitles, formatNovelText } from "./novelUtils";
import useFileUpload from "@/app/hooks/useFileUpload";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import { createConverter } from "js-opencc";
import ResultCard from "@/app/components/ResultCard";
import PageCard from "@/app/components/styled/PageCard";
import SourceArea from "@/app/components/SourceArea";
import { useTranslations } from "next-intl";
import { ProtectedRuleDrawer, ProtectedRulePanel, effectiveCount, type ProtectedRule } from "@/app/components/protectedRuleManager";

const { Dragger } = Upload;
const { Text } = Typography;

const uploadFileTypes = getFileTypePresetConfig("markdownText");

// 配置项行：标签 + 控件一行，可选在下方显示一行灰色说明（免去逐个悬停 tooltip）；sub 表示从属缩进项
const ToggleRow = ({ label, hint, sub, children }: { label: React.ReactNode; hint?: React.ReactNode; sub?: boolean; children: React.ReactNode }) => (
  <Flex vertical gap={2} style={sub ? { paddingInlineStart: 16 } : undefined}>
    <Flex justify="space-between" align="center" gap="small">
      <span>{label}</span>
      {children}
    </Flex>
    {hint ? (
      <Text type="secondary" className="!text-xs">
        {hint}
      </Text>
    ) : null}
  </Flex>
);

const NovelProcessor = () => {
  const { message } = App.useApp();
  const { copyToClipboard } = useCopyToClipboard();
  const t = useTranslations("NovelProcessor");
  const tCommon = useTranslations("common");
  const tPR = useTranslations("ProtectedRuleManager");
  const [filterText, setFilterText] = useState("");
  // 0 = 禁用阈值（不启用"超长行豁免"规则）；min=0 阻挡负数
  const [maxFilterLineLength, setMaxFilterLineLength] = useState<number>(0);
  const [smartLineBreak, setSmartLineBreak] = useState(true);
  const [enableIndent, setEnableIndent] = useState(true);
  const [enableChapterSplit, setEnableChapterSplit] = useState(true);
  const [enableLineEndNumbers, setEnableLineEndNumbers] = useState(false);
  const [specialStart, setSpecialStart] = useLocalStorage("novel-processor-specialStart", "");
  const [collapseKeys, setCollapseKeys] = useLocalStorage<string[]>("novel-processor-collapseKeys", ["1", "2"]);
  const [conversionMode, setConversionMode] = useState<"none" | "t2s" | "s2t">("none");
  const [enableTrim, setEnableTrim] = useState(true);
  const [enableParagraphSplit, setEnableParagraphSplit] = useState(false);
  const [removeDuplicateLines, setRemoveDuplicateLines] = useLocalStorage("novel-processor-removeDuplicateLines", true);
  const [mergeDuplicateChapterTitles, setMergeDuplicateChapterTitles] = useLocalStorage("novel-processor-mergeDuplicateChapterTitles", true);

  // Custom replacement rules — shared with chinese-conversion tool via the
  // same localStorage keys so a user's protected dictionary applies in both.
  const [s2tRules, setS2tRules] = useLocalStorage<ProtectedRule[]>("chinese-conversion-protectedRules-s2t", []);
  const [t2sRules, setT2sRules] = useLocalStorage<ProtectedRule[]>("chinese-conversion-protectedRules-t2s", []);
  const [enableProtectedRules, setEnableProtectedRules] = useLocalStorage("novel-processor-enableProtectedRules", true);
  const [ruleDrawerOpen, setRuleDrawerOpen] = useState(false);
  const activeS2tCount = effectiveCount(s2tRules);
  const activeT2sCount = effectiveCount(t2sRules);

  const {
    isFileProcessing,
    fileList,
    multipleFiles,
    readFile,
    sourceText,
    setSourceText,
    uploadMode,
    singleFileMode,
    setSingleFileMode,
    handleFileUpload,
    handleUploadRemove,
    handleUploadChange,
    resetUpload,
  } = useFileUpload();
  const [result, setResult] = useState("");
  const [directExport, setDirectExport] = useState(false);
  // Processing is async (cold js-opencc load + formatNovelText) and isn't covered by the
  // file-reading Spin — track it so the process button shows progress and blocks re-clicks.
  const [processing, setProcessing] = useState(false);

  const sourceStats = useTextStats(sourceText);
  const resultStats = useTextStats(result);

  const [prevSourceText, setPrevSourceText] = useState(sourceText);
  if (sourceText !== prevSourceText) {
    setPrevSourceText(sourceText);
    setResult("");
  }

  const handleExportFile = (text: string) => {
    const uploadFileName = multipleFiles[0]?.name;
    const fileName = uploadFileName || "novel.txt";
    void downloadFile(text, fileName);
    message.success(tCommon("fileExported", { fileName }));
  };

  const handleNovelProcessing = async (sourceText: string, fileName?: string): Promise<boolean> => {
    setResult("");
    if (!sourceText.trim()) {
      message.warning(tCommon("noSourceText"));
      return false;
    }
    // Guard the whole async pipeline: createConverter lazy-loads js-opencc, formatNovelText
    // and downloadFile can all throw. Without this an error vanished silently (single mode)
    // or hung the multi-file loop (the resolve() below was skipped). Surface the real cause.
    try {
      let processedInput = sourceText;

      if (conversionMode === "t2s" || conversionMode === "s2t") {
        const direction = conversionMode;
        const rules = enableProtectedRules ? (direction === "s2t" ? s2tRules : t2sRules) : [];
        const protectedDict: string[][] = rules.filter((r) => r.from && r.to).map((r) => [r.from, r.to]);
        const fromTo = direction === "t2s" ? ({ from: "tw" as const, to: "cn" as const }) : ({ from: "cn" as const, to: "tw" as const });
        const converter = await createConverter(fromTo, protectedDict.length > 0 ? protectedDict : undefined);
        processedInput = converter(processedInput);
      }

      processedInput = await formatNovelText(processedInput, {
        enableChapterSplit,
        filterText,
        maxFilterLineLength,
        enableLineEndNumbers,
        enableParagraphSplit,
        smartLineBreak,
        enableTrim,
        mergeDuplicateChapterTitles,
        removeDuplicateLines,
        enableIndent,
        specialStart,
      });

      if (fileName) {
        await downloadFile(processedInput, fileName);
        return true;
      }

      if (directExport) {
        handleExportFile(processedInput);
        return true;
      }

      setResult(processedInput);
      copyToClipboard(processedInput);
      return true;
    } catch (error) {
      console.error("小说处理失败:", error);
      const detail = error instanceof Error ? error.message : String(error);
      message.error(detail ? `${t("processFailed")}: ${detail}` : t("processFailed"), 10);
      return false;
    }
  };

  const handleMultipleProcess = async () => {
    if (multipleFiles.length === 0) {
      message.error(t("errorNoFile"));
      return;
    }

    const results: boolean[] = [];
    for (let i = 0; i < multipleFiles.length; i++) {
      const currentFile = multipleFiles[i];
      await new Promise<void>((resolve) => {
        readFile(
          currentFile,
          async (text) => {
            // Always resolve, even if processing throws, so one bad file can't hang the loop.
            try {
              results.push(await handleNovelProcessing(text, currentFile.name));
            } finally {
              resolve();
            }
          },
          // Decode/read failure: count it as a failed file and unblock the loop.
          () => {
            results.push(false);
            resolve();
          }
        );
      });
    }

    // Only claim success when every file processed+downloaded; per-file failures already
    // fired their own error toast, so a flat "batchDownloaded" would contradict them.
    if (results.length === multipleFiles.length && results.every(Boolean)) {
      message.success(tCommon("batchDownloaded"), 10);
    } else {
      message.error(t("processFailed"), 10);
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      if (uploadMode === "single") {
        await handleNovelProcessing(sourceText);
      } else {
        await handleMultipleProcess();
      }
    } finally {
      setProcessing(false);
    }
  };

  // 依据章节名重排
  const handleReorderChapters = () => {
    const text = sourceText || "";
    const lines = splitTextIntoLines(text);
    if (lines.length === 0) {
      message.warning(tCommon("noSourceText"));
      return;
    }
    const { output, chapters } = reorderChaptersByTitle(text);
    if (!chapters) {
      message.info(t("infoNoChapters"));
      return;
    }
    setResult(output);
    message.success(t("reorderComplete", { chapters }));
  };

  return (
    <Spin spinning={isFileProcessing} description={tCommon("pleaseWait")} size="large">
      <Row gutter={[16, 16]}>
        {/* Left Column: Input and Main Actions */}
        <Col xs={24} lg={14}>
          <Flex vertical gap="middle">
            <PageCard
              title={
                <Space>
                  <FileTextOutlined />
                  <span>{t("textInput")}</span>
                </Space>
              }
              extra={
                <Tooltip title={tCommon("clearInputTooltip")}>
                  <Button
                    type="text"
                    danger
                    onClick={() => {
                      resetUpload();
                      message.success(tCommon("resetUploadSuccess"));
                    }}
                    icon={<ClearOutlined />}>
                    {tCommon("clearAll")}
                  </Button>
                </Tooltip>
              }
              variant="borderless">
              <Flex vertical gap="small">
                <Dragger
                  customRequest={({ file }) => handleFileUpload(file as File)}
                  accept={uploadFileTypes.accept}
                  multiple={!singleFileMode}
                  showUploadList
                  beforeUpload={singleFileMode ? resetUpload : undefined}
                  onRemove={handleUploadRemove}
                  onChange={handleUploadChange}
                  fileList={fileList}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">{tCommon("dragAndDropText")}</p>
                  <p className="ant-upload-hint">
                    {tCommon("supportedFormats")}
                    {uploadFileTypes.label}
                  </p>
                </Dragger>

                {uploadMode === "single" && (
                  <SourceArea
                    sourceText={sourceText}
                    setSourceText={setSourceText}
                    stats={sourceStats}
                    placeholder={tCommon("sourceTextPlaceholder")}
                    ariaLabel={t("textInput")}
                  />
                )}
              </Flex>
            </PageCard>

            <Button type="primary" size="large" loading={processing} onClick={handleProcess} block icon={<PlayCircleOutlined />}>
              {tCommon("startProcess")}
            </Button>
            <Flex gap="small">
              <Tooltip title={t("tooltipChapterSplitOnly")}>
                <Button
                  block
                  variant="outlined"
                  onClick={() => {
                    const processed = splitInlineChapterTitles(sourceText);
                    setResult(processed);
                    message.success(t("chapterSplitDone"));
                  }}
                  icon={<ScissorOutlined />}>
                  {t("chapterSplitBtn")}
                </Button>
              </Tooltip>
              <Tooltip title={t("tooltipChapterReorder")}>
                <Button block variant="outlined" icon={<OrderedListOutlined />} onClick={handleReorderChapters}>
                  {t("chapterReorderBtn")}
                </Button>
              </Tooltip>
            </Flex>

            {result && (
              <ResultCard
                content={result}
                stats={resultStats}
                onChange={setResult}
                onCopy={() => copyToClipboard(result)}
                onExport={() => handleExportFile(result)}
                rows={12}
              />
            )}
          </Flex>
        </Col>

        {/* Right Column: Settings */}
        <Col xs={24} lg={10}>
          <Flex vertical gap="middle">
            <PageCard
              title={
                <Space>
                  <ControlOutlined />
                  <Typography.Text strong>{tCommon("configuration")}</Typography.Text>
                </Space>
              }
              variant="borderless"
              styles={{
                body: { padding: "12px 24px" },
              }}>
              <Collapse
                ghost
                size="small"
                activeKey={collapseKeys}
                onChange={(keys) => setCollapseKeys(keys as string[])}
                items={[
                  {
                    key: "1",
                    label: (
                      <Space>
                        <ScissorOutlined />
                        <Typography.Text strong>{t("typesetting")}</Typography.Text>
                      </Space>
                    ),
                    children: (
                      <Flex vertical gap="small">
                        <ToggleRow label={tCommon("smartLineBreak")} hint={t("hintSmartLineBreak")}>
                          <Switch size="small" checked={smartLineBreak} onChange={setSmartLineBreak} aria-label={tCommon("smartLineBreak")} />
                        </ToggleRow>
                        {smartLineBreak && (
                          <ToggleRow label={t("indent")} sub>
                            <Switch size="small" checked={enableIndent} onChange={setEnableIndent} aria-label={t("indent")} />
                          </ToggleRow>
                        )}
                        <ToggleRow label={t("paragraphSplit")} hint={t("hintParagraphSplit")}>
                          <Switch size="small" checked={enableParagraphSplit} onChange={setEnableParagraphSplit} aria-label={t("paragraphSplit")} />
                        </ToggleRow>
                        <ToggleRow label={t("trimSpaces")}>
                          <Switch size="small" checked={enableTrim} onChange={setEnableTrim} aria-label={t("trimSpaces")} />
                        </ToggleRow>
                      </Flex>
                    ),
                  },
                  {
                    key: "2",
                    label: (
                      <Space>
                        <OrderedListOutlined />
                        <Typography.Text strong>{t("chapterGroup")}</Typography.Text>
                      </Space>
                    ),
                    children: (
                      <Flex vertical gap="small">
                        <ToggleRow label={t("chapterSplit")} hint={t("hintChapterSplit")}>
                          <Switch size="small" checked={enableChapterSplit} onChange={setEnableChapterSplit} aria-label={t("chapterSplit")} />
                        </ToggleRow>
                        <ToggleRow label={t("mergeDuplicateChapterTitles")} hint={t("hintMergeChapterTitles")}>
                          <Switch size="small" checked={mergeDuplicateChapterTitles} onChange={setMergeDuplicateChapterTitles} aria-label={t("mergeDuplicateChapterTitles")} />
                        </ToggleRow>
                        <ToggleRow label={t("removeDuplicates")}>
                          <Switch size="small" checked={removeDuplicateLines} onChange={setRemoveDuplicateLines} aria-label={t("removeDuplicates")} />
                        </ToggleRow>
                      </Flex>
                    ),
                  },
                  {
                    key: "3",
                    label: (
                      <Space>
                        <ControlOutlined />
                        <Typography.Text strong>{tCommon("advancedSettings")}</Typography.Text>
                      </Space>
                    ),
                    children: (
                      <Flex vertical gap="small">
                        <ToggleRow label={t("lineEndNumbers")} hint={t("hintLineEndNumbers")}>
                          <Switch size="small" checked={enableLineEndNumbers} onChange={setEnableLineEndNumbers} aria-label={t("lineEndNumbers")} />
                        </ToggleRow>
                        <ToggleRow label={t("conversion")}>
                          <Segmented
                            value={conversionMode}
                            onChange={(value) => setConversionMode(value as "none" | "t2s" | "s2t")}
                            size="small"
                            options={[
                              { label: t("conversionNone"), value: "none" },
                              { label: tPR("directionT2s"), value: "t2s" },
                              { label: tPR("directionS2t"), value: "s2t" },
                            ]}
                          />
                        </ToggleRow>

                        <Divider className="!my-0" />

                        <Flex vertical gap={4}>
                          <Text>{t("specialStartLabel")}</Text>
                          <Text type="secondary" className="!text-xs">
                            {t("hintSpecialStart")}
                          </Text>
                          <Input value={specialStart || ""} onChange={(e) => setSpecialStart(e.target.value)} placeholder={t("specialStartPlaceholder")} allowClear aria-label={t("specialStartAria")} />
                        </Flex>

                        <Flex vertical gap={4}>
                          <Text>{t("filterLabel")}</Text>
                          <Text type="secondary" className="!text-xs">
                            {t("hintFilter")}
                          </Text>
                          <Input placeholder={t("filterPlaceholder")} value={filterText || ""} onChange={(e) => setFilterText(e.target.value)} allowClear aria-label={t("filterLabel")} />
                          {filterText ? (
                            <Flex vertical gap={4} style={{ paddingInlineStart: 16 }}>
                              <Text>{t("thresholdLabel")}</Text>
                              <Text type="secondary" className="!text-xs">
                                {t("hintThreshold")}
                              </Text>
                              <InputNumber
                                min={0}
                                placeholder={t("thresholdPlaceholder")}
                                value={maxFilterLineLength}
                                onChange={(value) => setMaxFilterLineLength(value ?? 0)}
                                suffix={
                                  maxFilterLineLength === 0 ? (
                                    <Text type="secondary" className="!text-xs">
                                      {t("thresholdDisabled")}
                                    </Text>
                                  ) : null
                                }
                                className="!w-full"
                                aria-label={t("thresholdAria")}
                              />
                            </Flex>
                          ) : null}
                        </Flex>

                        <Divider className="!my-0" />

                        <ToggleRow label={tCommon("singleFileMode")} hint={tCommon("singleFileModeTooltip")}>
                          <Switch size="small" checked={singleFileMode} onChange={setSingleFileMode} aria-label={tCommon("singleFileMode")} />
                        </ToggleRow>
                        {multipleFiles.length < 2 && (
                          <ToggleRow label={tCommon("directExport")}>
                            <Switch size="small" checked={directExport} onChange={setDirectExport} aria-label={tCommon("directExport")} />
                          </ToggleRow>
                        )}
                      </Flex>
                    ),
                  },
                ]}
              />
            </PageCard>

            <ProtectedRulePanel
              enabled={enableProtectedRules}
              onEnabledChange={setEnableProtectedRules}
              s2tCount={activeS2tCount}
              t2sCount={activeT2sCount}
              onOpenDrawer={() => setRuleDrawerOpen(true)}
              inactiveHint={conversionMode === "none" ? t("rulesInactiveHint") : undefined}
            />
          </Flex>
        </Col>
      </Row>
      <ProtectedRuleDrawer open={ruleDrawerOpen} onClose={() => setRuleDrawerOpen(false)} s2tRules={s2tRules} setS2tRules={setS2tRules} t2sRules={t2sRules} setT2sRules={setT2sRules} />
    </Spin>
  );
};

export default NovelProcessor;
