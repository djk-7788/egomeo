// 아이콘 클릭 시 Side Panel 열기/닫기
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// 쿠팡 이미지 프록시: 사이드패널에서 직접 로드 시 Referer 차단되는 이미지를
// background service worker에서 fetch(Referer 제한 없음) 후 data URL로 변환해 반환
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'fetchImageAsBlob') {
    fetch(msg.url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => sendResponse({ dataUrl: reader.result });
        reader.onerror = () => sendResponse({ error: 'FileReader 오류' });
        reader.readAsDataURL(blob);
      })
      .catch((err) => sendResponse({ error: err.message }));
    return true; // 비동기 응답을 위해 채널 유지
  }
});
