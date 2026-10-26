// 当插件安装时，在浏览器的鼠标右键菜单里注册一个选项
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "gemini-summarize",
    title: "✨ 使用 Gemini 速审这段内容",
    contexts: ["selection"]
  });
});

// 监听右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "gemini-summarize") {
    const selectedText = info.selectionText;
    console.log("用户划选的文本是：", selectedText);

    chrome.storage.local.set({ lastSelectedText: selectedText }, () => {
      chrome.action.openPopup();
    });
  }
});
