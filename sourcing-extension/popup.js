// popup.js — 팝업 UI 로직

let parsedData = null;

// 큐 아이템 수 배지 업데이트
async function refreshBadge() {
  try {
    const count = await dbCount();
    document.getElementById('queueCount').textContent = count;
  } catch {}
}

// 상태 전환 헬퍼
function showState(id) {
  ['stateLoading', 'stateNotProduct', 'statePreview', 'stateSuccess'].forEach((s) => {
    document.getElementById(s).style.display = s === id ? '' : 'none';
  });
}

// 팝업 초기화
async function init() {
  await refreshBadge();

  // 현재 탭에 content script 메시지 전송
  let tab;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs[0];
  } catch {
    showState('stateNotProduct');
    return;
  }

  if (!tab) { showState('stateNotProduct'); return; }

  // 지원 페이지인지 URL로 먼저 확인
  const url = tab.url || '';
  const isSupported =
    url.includes('aliexpress.com/item') ||
    url.includes('aliexpress.us/item') ||
    url.includes('coupang.com/vp/products');

  if (!isSupported) {
    showState('stateNotProduct');
    return;
  }

  // content script에 파싱 요청
  try {
    parsedData = await chrome.tabs.sendMessage(tab.id, { action: 'parseProduct' });
  } catch {
    showState('stateNotProduct');
    return;
  }

  if (!parsedData) { showState('stateNotProduct'); return; }

  // 폼에 데이터 채우기
  const img = document.getElementById('previewImg');
  if (parsedData.imageUrl) {
    img.src = parsedData.imageUrl;
    img.onerror = () => { img.src = ''; img.style.display = 'none'; };
  } else {
    img.style.display = 'none';
  }

  document.getElementById('inpTitle').value = parsedData.title || '';
  document.getElementById('inpImageUrl').value = parsedData.imageUrl || '';
  document.getElementById('inpProductUrl').value = parsedData.productUrl || '';

  showState('statePreview');
}

// 큐에 추가
document.getElementById('btnAdd').addEventListener('click', async () => {
  const btn = document.getElementById('btnAdd');
  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    const count = await dbCount();
    const item = {
      id: Date.now(),
      title: document.getElementById('inpTitle').value.trim() || '(제목 없음)',
      imageUrl: document.getElementById('inpImageUrl').value.trim(),
      productUrl: document.getElementById('inpProductUrl').value.trim(),
      category: document.getElementById('selCategory').value,
      videoFile: null,
      videoName: null,
      order: count,
      addedAt: Date.now(),
    };

    await dbAdd(item);
    await refreshBadge();
    showState('stateSuccess');
  } catch (err) {
    alert('저장 실패: ' + err.message);
    btn.disabled = false;
    btn.textContent = '큐에 추가';
  }
});

// 큐 관리 열기
function openQueue() {
  chrome.tabs.create({ url: chrome.runtime.getURL('queue.html') });
}

document.getElementById('btnQueue').addEventListener('click', openQueue);
document.getElementById('btnGoQueue').addEventListener('click', openQueue);

// 다른 상품 추가 — 상태 초기화
document.getElementById('btnAddMore').addEventListener('click', () => {
  showState('stateLoading');
  init();
});

init();
