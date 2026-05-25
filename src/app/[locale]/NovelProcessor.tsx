"use client";

import React, { useState } from "react";
import { Button, Input, InputNumber, Typography, Space, Flex, App, Tooltip, Upload, Switch, Spin, Row, Col, Collapse, Divider, Segmented } from "antd";
import { InboxOutlined, FileTextOutlined, ScissorOutlined, ClearOutlined, OrderedListOutlined, PlayCircleOutlined, ControlOutlined } from "@ant-design/icons";
import {
  splitTextIntoLines,
  cleanLines,
  splitParagraph,
  downloadFile,
  toHalfWidth,
  dedupeAdjacentLines,
  filterLines as filterLinesUtil,
  normalizeNewlines,
  compressNewlines,
  punctuationEndRegex,
  numberEndRegex,
  specialLineStartRegex,
  pureNumberRegex,
  numberStartRegex,
  chapterTitleRegex,
  numberTitleRegex,
  novelSectionHeaderRegex,
  escapeRegExp,
  getFileTypePresetConfig,
} from "@/app/utils";
import { useTextStats } from "@/app/hooks/useTextStats";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";
import { reorderChaptersByTitle, splitInlineChapterTitles, removeLineEndNumbers, stripNovelArtifacts } from "./novelUtils";
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
  const [collapseKeys, setCollapseKeys] = useLocalStorage<string[]>("novel-processor-collapseKeys", ["1"]);
  const [conversionMode, setConversionMode] = useState<"none" | "t2s" | "s2t">("none");
  const [enableTrim, setEnableTrim] = useState(true);
  const [enableParagraphSplit, setEnableParagraphSplit] = useState(false);
  const [removeDuplicateLines, setRemoveDuplicateLines] = useLocalStorage("novel-processor-removeDuplicateLines", false);

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
    downloadFile(text, fileName);
    return fileName;
  };

  const handleNovelProcessing = async (sourceText: string, fileName?: string) => {
    setResult("");
    if (!sourceText.trim()) {
      message.error(t("errorNoInput"));
      return;
    }
    let processedInput = sourceText;

    if (conversionMode === "t2s" || conversionMode === "s2t") {
      const direction = conversionMode;
      const rules = enableProtectedRules ? (direction === "s2t" ? s2tRules : t2sRules) : [];
      const protectedDict: string[][] = rules.filter((r) => r.from && r.to).map((r) => [r.from, r.to]);
      const fromTo = direction === "t2s" ? ({ from: "tw" as const, to: "cn" as const }) : ({ from: "cn" as const, to: "tw" as const });
      const converter = await createConverter(fromTo, protectedDict.length > 0 ? protectedDict : undefined);
      processedInput = converter(processedInput);
    }

    // 第一步：规范换行与清除常见小说杂质
    processedInput = normalizeNewlines(processedInput);
    processedInput = stripNovelArtifacts(processedInput);

    // 第二步：处理全角字符转半角
    processedInput = toHalfWidth(processedInput);

    // 第三步：格式化章节标记和空格
    processedInput = processedInput
      // 章节标记后的标点符号替换为空格
      .replace(/([章节卷集部篇])[、：:]/g, "$1 ")
      // 替换乱码字符
      .replace(/\uE4C6/g, " ")
      .replace(/&nbsp/g, " ")
      .replace(/([\u4e00-\u9fa5]) {2,}([\u4e00-\u9fa5])/g, (match, g1, g2) => {
        // 仅压缩两个及以上连续空格为单个空格（保留单个空格，可能是人名/地名分隔）
        // 同时保留章节标记后的空格
        return /[章节卷集部篇]/.test(g1) ? match : g1 + " " + g2;
      })
      // 删除整行为五个或多个=的行
      .replace(/^={5,}(\n|$)/gm, "");

    if (enableChapterSplit) {
      processedInput = splitInlineChapterTitles(processedInput);
    }
    // 处理过滤词
    if (filterText) {
      processedInput = filterLinesUtil(processedInput, filterText, maxFilterLineLength);
    }
    // 清除行尾数字
    if (enableLineEndNumbers) {
      processedInput = removeLineEndNumbers(processedInput, 10);
    }
    // 智能分段
    if (enableParagraphSplit) {
      processedInput = await splitParagraph(processedInput);
    }

    // 准备行数据
    let lines: string[];
    if (smartLineBreak) {
      // 智能换行模式下，使用 cleanLines 过滤空行并根据选项修剪
      lines = cleanLines(processedInput, enableTrim);
    } else {
      // 非智能换行模式，保留原始行结构，但根据选项修剪
      lines = splitTextIntoLines(processedInput);
      if (enableTrim) {
        lines = lines.map((line) => line.trim());
      }
    }

    // 删除相邻重复行（如果启用）
    const processedLines = removeDuplicateLines ? dedupeAdjacentLines(lines) : lines;

    if (smartLineBreak) {
      const result = [];

      // 预编译正则表达式，使用 escapeRegExp 转义用户输入防止正则注入
      const specialStartRegex = specialStart ? new RegExp(`^${escapeRegExp(specialStart)}`) : null;

      for (let i = 0; i < processedLines.length; i++) {
        const currentLine = processedLines[i];
        // 如果行以"分卷阅读"开头且长度不超过10个字符，则跳过该行
        if (currentLine.startsWith("分卷阅读") && currentLine.length <= 10) {
          continue;
        }

        const previousLine = i > 0 ? processedLines[i - 1].trim() : "";

        // Check if line is a chapter title, or a pure number (grouped together)
        const isChapterOrNumber = chapterTitleRegex.test(currentLine) || numberTitleRegex.test(currentLine) || pureNumberRegex.test(currentLine);

        // 检查是否为特殊起始行，数字开头
        const isSpecialStart = novelSectionHeaderRegex.test(currentLine) || specialStartRegex?.test(currentLine.trim()) || (specialStart && previousLine.startsWith(specialStart));

        // 检查其他特殊情况
        const startsWithSpecialChar = specialLineStartRegex.test(currentLine) || numberStartRegex.test(currentLine);
        const prevEndsWithPunctuation = punctuationEndRegex.test(previousLine) || numberEndRegex.test(previousLine);

        // 根据不同条件添加格式
        if (isChapterOrNumber) {
          // 对于标题不进行换行处理
          result.push("\n\n" + currentLine + (enableIndent ? "\n\n\t" : "\n\n"));
        } else if (isSpecialStart) {
          result.push("\n\n" + currentLine);
        } else if (startsWithSpecialChar || prevEndsWithPunctuation) {
          result.push(enableIndent ? "\n\n\t" + currentLine : "\n\n" + currentLine);
        } else {
          result.push(currentLine);
        }
      }

      // 合并结果并规范化多余的换行
      processedInput = result.join("");
      // 先处理包含缩进(\t)的特殊换行组合，避免被统一压缩破坏结构
      processedInput = processedInput.replace(/\n{2,}\t\n{2,}\t/g, "\n\n\t").replace(/\n{2,}\t\n{2,}/g, "\n\n");
      // 再统一将 3 个及以上换行压缩为 2 个
      processedInput = compressNewlines(processedInput, 2).trim();
    } else {
      // 如果不应用智能换行，仅合并行并压缩换行
      processedInput = processedLines.join("\n");
      processedInput = compressNewlines(processedInput, 1).trim();
    }

    if (fileName) {
      await downloadFile(processedInput, fileName);
      return;
    }

    if (directExport) {
      const dfileName = handleExportFile(processedInput);
      message.success(tCommon("exportSuccess", { fileName: dfileName }));
      return;
    }

    setResult(processedInput);
    copyToClipboard(processedInput);
  };

  const handleMultipleProcess = async () => {
    if (multipleFiles.length === 0) {
      message.error(t("errorNoFile"));
      return;
    }

    for (let i = 0; i < multipleFiles.length; i++) {
      const currentFile = multipleFiles[i];
      await new Promise<void>((resolve) => {
        readFile(currentFile, async (text) => {
          await handleNovelProcessing(text, currentFile.name);
          resolve();
        });
      });
    }

    message.success(tCommon("batchDownloaded"), 10);
  };

  const handleProcess = () => {
    if (uploadMode === "single") {
      handleNovelProcessing(sourceText);
    } else {
      handleMultipleProcess();
    }
  };

  // 依据章节名重排
  const handleReorderChapters = () => {
    const text = sourceText || "";
    const lines = splitTextIntoLines(text);
    if (lines.length === 0) {
      message.warning(t("warningNoText"));
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

            <Button type="primary" size="large" onClick={handleProcess} block icon={<PlayCircleOutlined />}>
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
                onExport={() => {
                  const fileName = handleExportFile(result);
                  message.success(tCommon("fileExported", { fileName }));
                }}
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
                        <Flex justify="space-between" align="center">
                          <Tooltip title={t("tooltipSmartLineBreak")}>
                            <span>{tCommon("smartLineBreak")}</span>
                          </Tooltip>
                          <Switch size="small" checked={smartLineBreak} onChange={setSmartLineBreak} aria-label={tCommon("smartLineBreak")} />
                        </Flex>

                        {smartLineBreak && (
                          <Flex justify="space-between" align="center" style={{ paddingLeft: 16 }}>
                            <Tooltip title={t("tooltipIndent")}>
                              <span>{t("indent")}</span>
                            </Tooltip>
                            <Switch checked={enableIndent} onChange={setEnableIndent} size="small" aria-label={t("indent")} />
                          </Flex>
                        )}

                        <Flex justify="space-between" align="center">
                          <Tooltip title={t("tooltipParagraphSplit")}>
                            <span>{t("paragraphSplit")}</span>
                          </Tooltip>
                          <Switch size="small" checked={enableParagraphSplit} onChange={setEnableParagraphSplit} aria-label={t("paragraphSplit")} />
                        </Flex>
                      </Flex>
                    ),
                  },
                  {
                    key: "2",
                    label: (
                      <Space>
                        <ClearOutlined />
                        <Typography.Text strong>{t("contentCleaning")}</Typography.Text>
                      </Space>
                    ),
                    children: (
                      <Flex vertical gap="small">
                        <Flex justify="space-between" align="center">
                          <Tooltip title={t("tooltipChapterSplit")}>
                            <span>{t("chapterSplit")}</span>
                          </Tooltip>
                          <Switch size="small" checked={enableChapterSplit} onChange={setEnableChapterSplit} aria-label={t("chapterSplit")} />
                        </Flex>

                        <Flex justify="space-between" align="center">
                          <Tooltip title={t("tooltipLineEndNumbers")}>
                            <span>{t("lineEndNumbers")}</span>
                          </Tooltip>
                          <Switch size="small" checked={enableLineEndNumbers} onChange={setEnableLineEndNumbers} aria-label={t("lineEndNumbers")} />
                        </Flex>

                        <Flex justify="space-between" align="center">
                          <Tooltip title={t("tooltipTrim")}>
                            <span>{t("trimSpaces")}</span>
                          </Tooltip>
                          <Switch checked={enableTrim} onChange={setEnableTrim} size="small" aria-label={t("trimSpaces")} />
                        </Flex>

                        <Flex justify="space-between" align="center">
                          <Tooltip title={t("tooltipDedup")}>
                            <span>{t("removeDuplicates")}</span>
                          </Tooltip>
                          <Switch size="small" checked={removeDuplicateLines} onChange={setRemoveDuplicateLines} aria-label={t("removeDuplicates")} />
                        </Flex>

                        <Divider className="!my-0" />

                        <Flex vertical gap={4}>
                          <Text>{t("specialStartLabel")}</Text>
                          <Input value={specialStart || ""} onChange={(e) => setSpecialStart(e.target.value)} placeholder={t("specialStartPlaceholder")} allowClear aria-label={t("specialStartAria")} />
                        </Flex>

                        <Flex vertical gap={4}>
                          <Text>{t("filterLabel")}</Text>
                          <Input placeholder={t("filterPlaceholder")} value={filterText || ""} onChange={(e) => setFilterText(e.target.value)} allowClear aria-label={t("filterLabel")} />
                          <Flex vertical gap={4}>
                            <Text type="secondary" className="!text-xs">
                              {t("thresholdLabel")}
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
                        </Flex>
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
                        <Flex justify="space-between" align="center">
                          <Tooltip title={t("tooltipConversion")}>
                            <span>{t("conversion")}</span>
                          </Tooltip>
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
                        </Flex>

                        <Flex justify="space-between" align="center">
                          <Tooltip title={tCommon("singleFileModeTooltip")}>
                            <span>{tCommon("singleFileMode")}</span>
                          </Tooltip>
                          <Switch size="small" checked={singleFileMode} onChange={setSingleFileMode} aria-label={tCommon("singleFileMode")} />
                        </Flex>

                        {multipleFiles.length < 2 && (
                          <Flex justify="space-between" align="center">
                            <span>{tCommon("directExport")}</span>
                            <Switch size="small" checked={directExport} onChange={setDirectExport} aria-label={tCommon("directExport")} />
                          </Flex>
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
