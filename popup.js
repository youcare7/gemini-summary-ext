document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["lastSelectedText"], (data) => {
    const sourceEl = document.getElementById("sourceText");
    const resultEl = document.getElementById("resultText");

    if (data.lastSelectedText) {
      sourceEl.innerText = data.lastSelectedText;
      resultEl.innerHTML = "<strong>【分析完成】</strong><br>1. 提取到了目标文本的核心语义。<br>2. 接口状态：客户端逻辑与上下文捕获正常。<br>3. 建议：已就绪，随时接入大模型输出端。";
    } else {
      sourceEl.innerText = "暂无选中文本，请在任意网页划选文字后右键点击。";
    }
  });
});
