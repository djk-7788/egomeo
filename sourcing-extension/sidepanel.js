// sidepanel.js — 사이드 패널 UI 로직

// ─── 상태 헬퍼 ──────────────────────────────────────────

function showState(id) {
  ['stateLoading', 'stateNotProduct', 'statePreview', 'stateSuccess'].forEach((s) => {
    const el = document.getElementById(s);
    el.style.display = s === id ? (s === 'statePreview' ? 'block' : 'flex') : 'none';
  });
}

async function refreshBadge() {
  try {
    const count = await dbCount();
    document.getElementById('queueCount').textContent = count;
  } catch {}
}

// ─── 상품 파싱 ──────────────────────────────────────────

async function loadProduct() {
  showState('stateLoading');

  let tab;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs[0];
  } catch {
    showState('stateNotProduct');
    return;
  }

  if (!tab) { showState('stateNotProduct'); return; }

  const url = tab.url || '';
  const isSupported =
    url.includes('aliexpress.com/item') ||
    url.includes('aliexpress.us/item') ||
    url.includes('coupang.com/vp/products');

  if (!isSupported) {
    showState('stateNotProduct');
    return;
  }

  let data;
  try {
    data = await chrome.tabs.sendMessage(tab.id, { action: 'parseProduct' });
  } catch {
    // content script 아직 주입 안 된 경우 잠시 후 재시도
    await new Promise((r) => setTimeout(r, 800));
    try {
      data = await chrome.tabs.sendMessage(tab.id, { action: 'parseProduct' });
    } catch {
      showState('stateNotProduct');
      return;
    }
  }

  if (!data) { showState('stateNotProduct'); return; }

  fillForm(data);
  showState('statePreview');
}

function fillForm(data) {
  const img = document.getElementById('previewImg');
  const placeholder = document.getElementById('imgPlaceholder');

  if (data.imageUrl) {
    img.src = data.imageUrl;
    img.style.display = 'block';
    placeholder.style.display = 'none';
    img.onerror = () => {
      img.style.display = 'none';
      placeholder.style.display = 'flex';
    };
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'flex';
  }

  document.getElementById('inpTitle').value = data.title || '';
  document.getElementById('inpPrice').value = data.price || '';
  document.getElementById('inpImageUrl').value = data.imageUrl || '';
  document.getElementById('inpProductUrl').value = data.productUrl || '';
}

// ─── 탭 전환 감지 — 자동으로 새 상품 파싱 ───────────────

chrome.tabs.onActivated.addListener(() => {
  // 성공 상태에서 탭 이동 시에도 즉시 파싱
  loadProduct();
});

// 같은 탭에서 URL 바뀔 때 (SPA 내비게이션 등)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id === tabId) loadProduct();
    });
  }
});

// ─── 큐에 추가 ──────────────────────────────────────────

document.getElementById('btnAdd').addEventListener('click', async () => {
  const btn = document.getElementById('btnAdd');
  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    const count = await dbCount();
    const item = {
      id: Date.now(),
      title: document.getElementById('inpTitle').value.trim() || '(제목 없음)',
      price: document.getElementById('inpPrice').value.trim(),
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
  } finally {
    btn.disabled = false;
    btn.textContent = '큐에 추가';
  }
});

// ─── 버튼 이벤트 ─────────────────────────────────────────

function openQueue() {
  chrome.tabs.create({ url: chrome.runtime.getURL('queue.html') });
}

document.getElementById('btnQueue').addEventListener('click', openQueue);
document.getElementById('btnGoQueue').addEventListener('click', openQueue);

// 새로고침 버튼 — 현재 탭 다시 파싱
document.getElementById('btnRefresh').addEventListener('click', loadProduct);

// 성공 후 다시 파싱 버튼
document.getElementById('btnAddMore').addEventListener('click', loadProduct);

// ─── 초기화 ─────────────────────────────────────────────

(async () => {
  await refreshBadge();
  await loadProduct();
})();
