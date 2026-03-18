import type { Metadata } from "next";
import ClientPage from "./client";
import { generateChineseToolMetadata } from "@/app/lib/chineseSeo";

export async function generateStaticParams() {
  return [{ locale: "zh" }, { locale: "zh-hant" }];
}
// autocorrect: false
export async function generateMetadata({ params }: { params: Promise<{ locale?: string }> }): Promise<Metadata> {
  const { locale = "zh" } = await params;
  return generateChineseToolMetadata({
    locale,
    title: "小说文本整理神器 - 一键修复格式问题，智能排版工具 | Tools by AI",
    description: "下载的小说格式乱成一团？小说文本整理器一键解决！智能换行、章节分割、章节重排、段落缩进、繁简转换、去重复行、垃圾过滤全搞定，让杂乱网络小说秒变整齐易读，阅读体验瞬间提升！",
    keywords: "小说文本处理器, 网络小说格式整理, 智能换行, 章节标题分割, 繁体转简体, 删除重复行, 垃圾内容过滤, 段落缩进, 批量处理, TXT文件处理, 小说排版工具",
    path: "novel-processor",
  });
}

export default function Page() {
  return <ClientPage />;
}
