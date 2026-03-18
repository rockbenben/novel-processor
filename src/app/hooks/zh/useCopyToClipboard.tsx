import { App } from "antd";
import { useZhText } from "./useZhText";

export const useCopyToClipboard = () => {
  const { message: appMessage } = App.useApp();
  const z = useZhText();

  const copyToClipboard = async (text: string, targetText?: string) => {
    if (!text || text.trim() === "") {
      const warningMsg = targetText ? z(`${targetText} 内容为空，无需复制`) : z("目标内容为空，无需复制");
      appMessage.warning(warningMsg);
      return;
    }

    if (!navigator?.clipboard) {
      appMessage.error(z("当前浏览器不支持剪贴板操作，请尝试手动复制或使用其他浏览器"));
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      const successMsg = targetText ? z(`${targetText} 已复制`) : z("文本已复制");
      appMessage.success(successMsg);
    } catch (err) {
      console.error("复制到剪贴板失败：", err);
      const errorMsg = targetText ? z(`${targetText} 复制失败，请手动复制`) : z("复制失败，请手动复制内容");
      appMessage.error(errorMsg);
    }
  };

  return { copyToClipboard };
};
