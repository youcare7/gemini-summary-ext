// 复制结果文本：优先 Clipboard API，失败时使用临时 textarea + execCommand 兜底。
// 不读取或写入浏览器存储；临时节点立即移除。

/** 将纯文本写入剪贴板，返回用户可见反馈文案。 */
export async function writeClipboardText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return '已复制';
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    try {
      document.execCommand('copy');
      return '已复制';
    } catch {
      return '复制失败，请手动选择文本复制。';
    } finally {
      ta.remove();
    }
  }
}
