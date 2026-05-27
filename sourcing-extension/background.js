// 아이콘 클릭 시 Side Panel 열기/닫기
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
