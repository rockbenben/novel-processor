"use client";

import React, { useState } from "react";
import { Button, Input, Typography, Space, Flex, App, Tooltip, Upload, Card, Switch, Spin, Row, Col, Collapse, Divider, Segmented } from "antd";
import { InboxOutlined, FileTextOutlined, ScissorOutlined, ClearOutlined, OrderedListOutlined, RocketOutlined, ControlOutlined } from "@ant-design/icons";
import {
  splitTextIntoLines,
  cleanLines,
  splitParagraph,
  downloadFile,
  toHalfWidth,
  removeAdjacentDuplicateLines,
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
import { useCopyToClipboard } from "@/app/hooks/zh/useCopyToClipboard";
import { reorderChaptersByTitle, splitInlineChapterTitles, removeLineEndNumbers, stripNovelArtifacts } from "./novelUtils";
import useFileUpload from "@/app/hooks/useFileUpload";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import { createConverter } from "js-opencc";
import ZhResultCard from "@/app/components/zh/ZhResultCard";
import { useZhText } from "@/app/hooks/zh/useZhText";

const { TextArea } = Input;
const { Dragger } = Upload;
const { Text } = Typography;

const uploadFileTypes = getFileTypePresetConfig("markdownText");

const NovelProcessor = () => {
  const { message } = App.useApp();
  const { copyToClipboard } = useCopyToClipboard();
  const z = useZhText();
  const [filterText, setFilterText] = useState("");
  const [maxFilterLineLength, setMaxFilterLineLength] = useState<number | undefined>(undefined);
  const [smartLineBreak, setSmartLineBreak] = useState(true);
  const [enableIndent, setEnableIndent] = useState(true);
  const [enableChapterSplit, setEnableChapterSplit] = useState(true);
  const [enableLineEndNumbers, setEnableLineEndNumbers] = useState(false);
  const [specialStart, setSpecialStart] = useLocalStorage("novel-processor-specialStart", "");
  const [activeCollapseKeys, setActiveCollapseKeys] = useLocalStorage<string[]>("novel-processor-collapseKeys", ["1"]);
  const [conversionMode, setConversionMode] = useState<"none" | "t2s" | "s2t">("none");
  const [enableTrim, setEnableTrim] = useState(true);
  const [enableParagraphSplit, setEnableParagraphSplit] = useState(false);
  const [removeDuplicateLines, setRemoveDuplicateLines] = useLocalStorage("novel-proc-removeDuplicateLines", false);

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

  const [prevSourceText, setPrevSourceText] = useState(sourceText);
  if (sourceText !== prevSourceText) {
    setPrevSourceText(sourceText);
    setResult("");
  }

  // 导出文件辅助函数
  const handleExportFile = (text: string) => {
    const uploadFileName = multipleFiles[0]?.name;
    const fileName = uploadFileName || "novel.txt";
    downloadFile(text, fileName);
    return fileName;
  };

  // 小说文本处理
  const handleNovelProcessing = async (sourceText: string, fileName?: string) => {
    setResult("");
    if (!sourceText.trim()) {
      message.error(z("请输入或粘贴待处理文本"));
      return;
    }
    let processedInput = sourceText;

    if (conversionMode === "t2s") {
      const converter = await createConverter({ from: "tw", to: "cn" });
      processedInput = converter(processedInput);
    } else if (conversionMode === "s2t") {
      const converter = await createConverter({ from: "cn", to: "tw" });
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

    // 只对以"第"开头且包含"章"的行进行处理
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
    const processedLines = removeDuplicateLines ? removeAdjacentDuplicateLines(lines) : lines;

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
      message.success(z(`导出成功：${dfileName}`));
      return;
    }

    setResult(processedInput);
    copyToClipboard(processedInput);
  };

  const handleMultipleProcess = async () => {
    if (multipleFiles.length === 0) {
      message.error(z("请上传要处理的文件"));
      return;
    }

    //setTranslateInProgress(true);
    //setProgressPercent(0);

    for (let i = 0; i < multipleFiles.length; i++) {
      const currentFile = multipleFiles[i];
      await new Promise<void>((resolve) => {
        readFile(currentFile, async (text) => {
          await handleNovelProcessing(text, currentFile.name);
          resolve();
        });
      });
    }

    //setTranslateInProgress(false);
    message.success(z("处理完成，文件已自动下载"), 10);
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
      message.warning(z("请先输入或粘贴文本"));
      return;
    }
    const { output, chapters } = reorderChaptersByTitle(text);
    if (!chapters) {
      message.info(z("未识别到有效章节标题，无法重排"));
      return;
    }
    setResult(output);
    message.success(z(`章节重排完成（共 ${chapters} 章）`));
  };

  return (
    <Spin spinning={isFileProcessing} description={z("请稍候...")} size="large">
      <Row gutter={[16, 16]}>
        {/* Left Column: Input and Main Actions */}
        <Col xs={24} lg={15}>
          <Flex vertical gap="middle">
            <Card
              title={
                <Space>
                  <FileTextOutlined />
                  <span>{z("文本输入")}</span>
                </Space>
              }
              extra={
                <Tooltip title={z("清空输入内容和上传的文件")}>
                  <Button
                    type="text"
                    danger
                    onClick={() => {
                      resetUpload();
                      message.success(z("已清空"));
                    }}
                    icon={<ClearOutlined />}>
                    {z("清空")}
                  </Button>
                </Tooltip>
              }
              variant="borderless"
              className="shadow-md border-transparent hover:shadow-lg transition-shadow duration-300">
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
                  <p className="ant-upload-text">{z("点击或拖拽文件到此处上传")}</p>
                  <p className="ant-upload-hint">{z("支持的格式：")}{uploadFileTypes.label}</p>
                </Dragger>

                {uploadMode === "single" && (
                  <TextArea
                    placeholder={z("请输入或粘贴待处理文本...")}
                    value={sourceStats.isEditable ? sourceText : sourceStats.displayText}
                    onChange={sourceStats.isEditable ? (e) => setSourceText(e.target.value) : undefined}
                    rows={8}
                    allowClear
                    readOnly={!sourceStats.isEditable}
                    aria-label={z("文本输入")}
                  />
                )}

                {sourceText && (
                  <Flex justify="end" className="mt-2">
                    <Typography.Text type="secondary" className="!text-xs">
                      {z(`${sourceStats.charCount || 0} 字符 / ${sourceStats.lineCount || 0} 行`)}
                    </Typography.Text>
                  </Flex>
                )}
              </Flex>
            </Card>

            {result && (
              <ZhResultCard
                value={result}
                onChange={setResult}
                onCopy={() => copyToClipboard(result)}
                onExport={() => {
                  const fileName = handleExportFile(result);
                  message.success(z(`已导出文件：${fileName}`));
                }}
                rows={12}
              />
            )}
          </Flex>
        </Col>

        {/* Right Column: Settings */}
        <Col xs={24} lg={9}>
          <Flex vertical gap="middle">
            <Card
              title={
                <Space>
                  <ControlOutlined />
                  <Typography.Text strong>{z("高级设置")}</Typography.Text>
                </Space>
              }
              variant="borderless"
              styles={{
                body: { padding: "12px 24px" },
              }}
              className="shadow-md border-transparent hover:shadow-lg transition-shadow duration-300">
              <Collapse
                ghost
                size="small"
                activeKey={activeCollapseKeys}
                onChange={(keys) => setActiveCollapseKeys(keys as string[])}
                items={[
                  {
                    key: "1",
                    label: (
                      <Space>
                        <ScissorOutlined />
                        <Typography.Text strong>{z("排版优化")}</Typography.Text>
                      </Space>
                    ),
                    children: (
                      <Flex vertical gap="small">
                        <Flex justify="space-between" align="center">
                          <Tooltip title={z("智能换行：依据标点符号自动优化换行，合并破碎段落")}>
                            <span>{z("智能换行")}</span>
                          </Tooltip>
                          <Switch size="small" checked={smartLineBreak} onChange={setSmartLineBreak} aria-label={z("智能换行")} />
                        </Flex>

                        {smartLineBreak && (
                          <Flex justify="space-between" align="center" style={{ paddingLeft: 16 }}>
                            <Tooltip title={z("段落缩进：段首自动添加两个全角空格")}>
                              <span>{z("段落缩进")}</span>
                            </Tooltip>
                            <Switch checked={enableIndent} onChange={setEnableIndent} size="small" aria-label={z("段落缩进")} />
                          </Flex>
                        )}

                        <Flex justify="space-between" align="center">
                          <Tooltip title={z("智能清理：自动移除每行首尾空格")}>
                            <span>{z("智能清理空格")}</span>
                          </Tooltip>
                          <Switch checked={enableTrim} onChange={setEnableTrim} size="small" aria-label={z("智能清理空格")} />
                        </Flex>

                        <Flex justify="space-between" align="center">
                          <Tooltip title={z("去重：移除相邻的重复行")}>
                            <span>{z("去除重复行")}</span>
                          </Tooltip>
                          <Switch size="small" checked={removeDuplicateLines} onChange={setRemoveDuplicateLines} aria-label={z("去除重复行")} />
                        </Flex>

                        <Flex justify="space-between" align="center">
                          <Tooltip title={z("长段落优化：自动拆分过长段落，提升移动端阅读体验")}>
                            <span>{z("长段落优化")}</span>
                          </Tooltip>
                          <Switch size="small" checked={enableParagraphSplit} onChange={setEnableParagraphSplit} aria-label={z("长段落优化")} />
                        </Flex>

                        <Flex justify="space-between" align="center">
                          <span>{z("繁简转换")}</span>
                          <Segmented
                            value={conversionMode}
                            onChange={(value) => setConversionMode(value as "none" | "t2s" | "s2t")}
                            size="small"
                            options={[
                              { label: z("不变"), value: "none" },
                              { label: z("繁→简"), value: "t2s" },
                              { label: z("简→繁"), value: "s2t" },
                            ]}
                          />
                        </Flex>
                      </Flex>
                    ),
                  },
                  {
                    key: "2",
                    label: (
                      <Space>
                        <ClearOutlined />
                        <Typography.Text strong>{z("内容清洗")}</Typography.Text>
                      </Space>
                    ),
                    children: (
                      <Flex vertical gap="small">
                        <Flex justify="space-between" align="center">
                          <Tooltip title={z('章节识别：自动识别并格式化"第X章"标题')}>
                            <span>{z("识别并处理章节标题")}</span>
                          </Tooltip>
                          <Switch size="small" checked={enableChapterSplit} onChange={setEnableChapterSplit} aria-label={z("识别并处理章节标题")} />
                        </Flex>

                        <Flex justify="space-between" align="center">
                          <Tooltip title={z("清除行尾数字：移除行末的页码或统计数字（仅限该行长度超过10）")}>
                            <span>{z("清除行尾数字")}</span>
                          </Tooltip>
                          <Switch size="small" checked={enableLineEndNumbers} onChange={setEnableLineEndNumbers} aria-label={z("清除行尾数字")} />
                        </Flex>

                        <Divider className="!my-0" />

                        <Flex vertical gap={4}>
                          <Text>{z("特殊起始行（不合并）")}</Text>
                          <Input value={specialStart || ""} onChange={(e) => setSpecialStart(e.target.value)} placeholder={z("例如：书名、卷首语...")} allowClear aria-label={z("特殊起始行")} />
                        </Flex>

                        <Flex vertical gap={4}>
                          <Text>{z("内容筛选")}</Text>
                          <Input placeholder={z("输入筛选关键词（逗号分隔）")} value={filterText || ""} onChange={(e) => setFilterText(e.target.value)} allowClear aria-label={z("内容筛选")} />
                          <Space.Compact className="w-full">
                            <Space.Addon style={{ minWidth: 55 }}>{z("阈值")}</Space.Addon>
                            <Input
                              type="number"
                              placeholder={z("长度阈值（可选）")}
                              value={maxFilterLineLength ?? ""}
                              onChange={(e) => {
                                const value = parseInt(e.target.value, 10);
                                setMaxFilterLineLength(isNaN(value) ? undefined : value);
                              }}
                              aria-label={z("长度阈值")}
                            />
                          </Space.Compact>
                        </Flex>
                      </Flex>
                    ),
                  },
                  {
                    key: "3",
                    label: (
                      <Space>
                        <ControlOutlined />
                        <Typography.Text strong>{z("高级设置")}</Typography.Text>
                      </Space>
                    ),
                    children: (
                      <Flex vertical gap="small">
                        <Flex justify="space-between" align="center">
                          <Tooltip title={z("每次只处理一个文件，上传新文件时自动替换")}>
                            <span>{z("单文件模式")}</span>
                          </Tooltip>
                          <Switch size="small" checked={singleFileMode} onChange={setSingleFileMode} aria-label={z("单文件模式")} />
                        </Flex>

                        {multipleFiles.length < 2 && (
                          <Flex justify="space-between" align="center">
                            <span>{z("处理后自动导出")}</span>
                            <Switch size="small" checked={directExport} onChange={setDirectExport} aria-label={z("处理后自动导出")} />
                          </Flex>
                        )}
                      </Flex>
                    ),
                  },
                ]}
              />

              <Divider />

              <Button type="primary" size="large" className="mb-4" onClick={handleProcess} block icon={<RocketOutlined />}>
                {z("开始处理")}
              </Button>
              <Flex gap="small">
                <Tooltip title={z("仅分割章节：仅对章节标题进行分行，不修改其他内容")}>
                  <Button
                    block
                    variant="outlined"
                    onClick={() => {
                      const processed = splitInlineChapterTitles(sourceText);
                      setResult(processed);
                      message.success(z("章节分割完成"));
                    }}
                    icon={<ScissorOutlined />}>
                    {z("章节分割")}
                  </Button>
                </Tooltip>
                <Tooltip title={z("章节重排：依据章节序号重新排序整本小说")}>
                  <Button block variant="outlined" icon={<OrderedListOutlined />} onClick={handleReorderChapters}>
                    {z("章节重排")}
                  </Button>
                </Tooltip>
              </Flex>
            </Card>
          </Flex>
        </Col>
      </Row>
    </Spin>
  );
};

export default NovelProcessor;
