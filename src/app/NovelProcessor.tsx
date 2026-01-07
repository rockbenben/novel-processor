"use client";

import React, { useState } from "react";
import { Button, Input, Typography, Space, Checkbox, Flex, App, Tooltip, Upload, Card, Switch, Spin, Row, Col, Collapse, Divider, Tag } from "antd";
import { CopyOutlined, InboxOutlined, DownloadOutlined, SettingOutlined, FileTextOutlined, ScissorOutlined, ClearOutlined, OrderedListOutlined, RocketOutlined } from "@ant-design/icons";
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
} from "@/app/utils";
import { useTextStats } from "@/app/hooks/useTextStats";
import { useCopyToClipboard } from "@/app/hooks/zh/useCopyToClipboard";
import { reorderChaptersByTitle, splitInlineChapterTitles, removeLineEndNumbers, stripNovelArtifacts } from "./novelUtils";
import useFileUpload from "@/app/hooks/useFileUpload";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import { createConverter } from "js-opencc";

const { TextArea } = Input;
const { Dragger } = Upload;
const { Text } = Typography;

const NovelProcessor = () => {
  const { message } = App.useApp();
  const { copyToClipboard } = useCopyToClipboard();
  const [filterText, setFilterText] = useState("");
  const [maxFilterLineLength, setMaxFilterLineLength] = useState<number | undefined>(undefined);
  const [smartLineBreak, setSmartLineBreak] = useState(true);
  const [enableIndent, setEnableIndent] = useState(true);
  const [enableChapterSplit, setEnableChapterSplit] = useState(true);
  const [enableLineEndNumbers, setEnableLineEndNumbers] = useState(false);
  const [specialStart, setSpecialStart] = useLocalStorage("novel-processor-specialStart", "");
  const [convertToSimplified, setConvertToSimplified] = useState(false);
  const [enableTrim, setEnableTrim] = useState(true);
  const [enableParagraphSplit, setEnableParagraphSplit] = useState(false);
  const [removeDuplicateLines, setRemoveDuplicateLines] = useState(true);

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
  const [largeMode, setLargeMode] = useState(false);
  const [result, setResult] = useState("");
  const [directExport, setDirectExport] = useState(false);

  const sourceStats = useTextStats(sourceText);
  const resultStats = useTextStats(result);

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
      message.error("请输入或粘贴待处理文本");
      return;
    }
    let processedInput = sourceText;

    if (convertToSimplified) {
      const converter = await createConverter({ from: "tw", to: "cn" });
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
      .replace(//g, " ")
      .replace(/&nbsp/g, " ")
      .replace(/([\u4e00-\u9fa5]) +([\u4e00-\u9fa5])/g, (match, g1, g2) => {
        // 保留章节标记后的空格，移除其他中文间的空格
        return /[章节卷集部篇]/.test(g1) ? match : g1 + g2;
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

      // 预编译正则表达式以提高性能
      const specialStartRegex = specialStart ? new RegExp(`^${specialStart}`) : null;

      for (let i = 0; i < processedLines.length; i++) {
        const currentLine = processedLines[i];
        // 如果行以“分卷阅读”开头且长度不超过10个字符，则跳过该行
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
      message.success(`导出成功：${dfileName}`);
      return;
    }

    setResult(processedInput);
    copyToClipboard(processedInput);
  };

  const handleMultipleProcess = async () => {
    if (multipleFiles.length === 0) {
      message.error("请上传要处理的文件");
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
    message.success("处理完成，文件已自动下载", 10);
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
      message.warning("请先输入或粘贴文本");
      return;
    }
    const { output, chapters } = reorderChaptersByTitle(text);
    if (!chapters) {
      message.info("未识别到有效章节标题，无法重排");
      return;
    }
    setResult(output);
    message.success(`章节重排完成（共 ${chapters} 章）`);
  };

  return (
    <Spin spinning={isFileProcessing} tip="正在加载文件，请稍候..." size="large">
      <Row gutter={[16, 16]}>
        {/* Left Column: Input and Main Actions */}
        <Col xs={24} lg={15}>
          <Flex vertical gap="middle">
            <Card
              title={
                <Space>
                  <FileTextOutlined />
                  <span>文本输入</span>
                </Space>
              }
              extra={
                <Tooltip title="清空输入内容和上传的文件">
                  <Button
                    type="text"
                    danger
                    onClick={() => {
                      resetUpload();
                      message.success("已清空");
                    }}
                    icon={<ClearOutlined />}>
                    清空
                  </Button>
                </Tooltip>
              }
              variant="borderless"
              className="shadow-sm">
              <Flex vertical gap="small">
                <Dragger
                  customRequest={({ file }) => handleFileUpload(file as File)}
                  accept=".txt,.md,.markdown"
                  multiple={!singleFileMode}
                  showUploadList
                  beforeUpload={singleFileMode ? resetUpload : undefined}
                  onRemove={handleUploadRemove}
                  onChange={handleUploadChange}
                  fileList={fileList}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
                  <p className="ant-upload-hint">支持的格式：.txt .md .markdown</p>
                </Dragger>

                {uploadMode === "single" && !largeMode && (
                  <TextArea
                    placeholder="请输入或粘贴待处理文本..."
                    value={sourceStats.isEditable ? sourceText : sourceStats.displayText}
                    onChange={sourceStats.isEditable ? (e) => setSourceText(e.target.value) : undefined}
                    rows={8}
                    allowClear
                    readOnly={!sourceStats.isEditable}
                    aria-label="文本输入"
                  />
                )}

                {sourceText && (
                  <Flex justify="space-between" align="center" style={{ marginTop: -6 }}>
                    <Tag color="blue">输入：{sourceStats.charCount || 0} 字符</Tag>
                    <Tag color="cyan">{sourceStats.lineCount || 0} 行</Tag>
                  </Flex>
                )}
              </Flex>
            </Card>

            {result && (
              <Card
                title={
                  <Space>
                    <RocketOutlined />
                    <span>处理结果</span>
                  </Space>
                }
                variant="borderless"
                className="shadow-sm"
                extra={
                  <Space>
                    <Button type="text" icon={<CopyOutlined />} onClick={() => copyToClipboard(result)}>
                      复制
                    </Button>
                    <Button
                      type="text"
                      icon={<DownloadOutlined />}
                      onClick={() => {
                        const fileName = handleExportFile(result);
                        message.success(`已导出文件：${fileName}`);
                      }}>
                      导出
                    </Button>
                  </Space>
                }>
                <TextArea
                  value={resultStats.displayText || ""}
                  onChange={!resultStats.isTooLong ? (e) => setResult(e.target.value) : undefined}
                  rows={12}
                  readOnly={resultStats.isTooLong}
                  style={{ fontSize: 14, fontFamily: "monospace" }}
                  aria-label="处理结果"
                />
                <Flex justify="end">
                  <Space>
                    <Tag color="green">输出：{resultStats.charCount || 0} 字符</Tag>
                    <Tag color="geekblue">{resultStats.lineCount || 0} 行</Tag>
                  </Space>
                </Flex>
              </Card>
            )}
          </Flex>
        </Col>

        {/* Right Column: Settings */}
        <Col xs={24} lg={9}>
          <Flex vertical gap="middle">
            <Card
              title={
                <Space>
                  <SettingOutlined />
                  <span>处理选项</span>
                </Space>
              }
              variant="borderless"
              styles={{
                body: { padding: "12px 24px" },
              }}
              className="shadow-sm">
              <Collapse
                defaultActiveKey={["1"]}
                ghost
                expandIconPlacement="end"
                items={[
                  {
                    key: "1",
                    label: (
                      <Space>
                        <ScissorOutlined />
                        <span>排版优化</span>
                      </Space>
                    ),
                    children: (
                      <Flex vertical gap="small">
                        <Flex justify="space-between" align="center">
                          <Tooltip title="智能换行：依据标点符号自动优化换行，合并破碎段落">
                            <span>智能换行</span>
                          </Tooltip>
                          <Switch checked={smartLineBreak} onChange={setSmartLineBreak} aria-label="智能换行" />
                        </Flex>

                        {smartLineBreak && (
                          <Flex justify="space-between" align="center">
                            <Tooltip title="段落缩进：段首自动添加两个全角空格">
                              <span>段落缩进</span>
                            </Tooltip>
                            <Switch checked={enableIndent} onChange={setEnableIndent} size="small" aria-label="段落缩进" />
                          </Flex>
                        )}

                        <Flex justify="space-between" align="center">
                          <Tooltip title="智能清理：自动移除每行首尾空格">
                            <span>智能清理空格</span>
                          </Tooltip>
                          <Switch checked={enableTrim} onChange={setEnableTrim} size="small" aria-label="智能清理空格" />
                        </Flex>

                        <Flex justify="space-between" align="center">
                          <Tooltip title="去重：移除相邻的重复行">
                            <span>去除重复行</span>
                          </Tooltip>
                          <Checkbox checked={removeDuplicateLines} onChange={(e) => setRemoveDuplicateLines(e.target.checked)} />
                        </Flex>

                        <Flex justify="space-between" align="center">
                          <Tooltip title="长段落优化：自动拆分过长段落，提升移动端阅读体验">
                            <span>长段落优化</span>
                          </Tooltip>
                          <Checkbox checked={enableParagraphSplit} onChange={(e) => setEnableParagraphSplit(e.target.checked)} />
                        </Flex>

                        <Flex justify="space-between" align="center">
                          <span>繁体转简体</span>
                          <Checkbox checked={convertToSimplified} onChange={(e) => setConvertToSimplified(e.target.checked)} />
                        </Flex>
                      </Flex>
                    ),
                  },
                  {
                    key: "2",
                    label: (
                      <Space>
                        <ClearOutlined />
                        <span>内容清洗</span>
                      </Space>
                    ),
                    children: (
                      <Flex vertical gap="small">
                        <Tooltip title="章节识别：自动识别并格式化“第X章”标题">
                          <Checkbox checked={enableChapterSplit} onChange={(e) => setEnableChapterSplit(e.target.checked)}>
                            识别并处理章节标题
                          </Checkbox>
                        </Tooltip>

                        <Tooltip title="清除行尾数字：移除行末的页码或统计数字（仅限该行长度超过10）">
                          <Checkbox checked={enableLineEndNumbers} onChange={(e) => setEnableLineEndNumbers(e.target.checked)}>
                            清除行尾数字
                          </Checkbox>
                        </Tooltip>

                        <Divider style={{ margin: "8px 0" }} />

                        <Space orientation="vertical" className="w-full">
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            特殊起始行（不合并）
                          </Text>
                          <Input value={specialStart || ""} onChange={(e) => setSpecialStart(e.target.value)} placeholder="例如：书名、卷首语..." allowClear aria-label="特殊起始行" />
                        </Space>

                        <Space orientation="vertical" className="w-full">
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            内容筛选
                          </Text>
                          <Input placeholder="输入筛选关键词（逗号分隔）" value={filterText || ""} onChange={(e) => setFilterText(e.target.value)} allowClear aria-label="内容筛选" />
                          <Space.Compact className="w-full">
                            <Space.Addon style={{ minWidth: 55 }}>阈值</Space.Addon>
                            <Input
                              type="number"
                              placeholder="长度阈值（可选）"
                              value={maxFilterLineLength ?? ""}
                              onChange={(e) => {
                                const value = parseInt(e.target.value, 10);
                                setMaxFilterLineLength(isNaN(value) ? undefined : value);
                              }}
                              aria-label="长度阈值"
                            />
                          </Space.Compact>
                        </Space>
                      </Flex>
                    ),
                  },
                  {
                    key: "3",
                    label: (
                      <Space>
                        <SettingOutlined />
                        <span>文件设置</span>
                      </Space>
                    ),
                    children: (
                      <Flex vertical gap="small">
                        <Tooltip title="每次只处理一个文件，上传新文件时自动替换">
                          <Checkbox checked={singleFileMode} onChange={(e) => setSingleFileMode(e.target.checked)}>
                            单文件模式
                          </Checkbox>
                        </Tooltip>
                        <Tooltip title="关闭预览以加快处理速度，适合处理大文件">
                          <Checkbox checked={largeMode} onChange={(e) => setLargeMode(e.target.checked)}>
                            大文件模式
                          </Checkbox>
                        </Tooltip>
                        {multipleFiles.length < 2 && (
                          <Checkbox checked={directExport} onChange={(e) => setDirectExport(e.target.checked)}>
                            处理后自动导出
                          </Checkbox>
                        )}
                      </Flex>
                    ),
                  },
                ]}
              />

              <Divider />

              <Button type="primary" size="large" className="mb-4" onClick={handleProcess} block icon={<RocketOutlined />}>
                开始处理
              </Button>
              <Flex gap="small">
                <Tooltip title="仅分割章节：仅对章节标题进行分行，不修改其他内容">
                  <Button
                    block
                    onClick={() => {
                      const processed = splitInlineChapterTitles(sourceText);
                      setResult(processed);
                      message.success("章节分割完成");
                    }}
                    icon={<ScissorOutlined />}>
                    章节分割
                  </Button>
                </Tooltip>
                <Tooltip title="章节重排：依据章节序号重新排序整本小说">
                  <Button block icon={<OrderedListOutlined />} onClick={handleReorderChapters}>
                    章节重排
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
