// 아이콘 클릭 시 새 탭으로 열기
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
});
