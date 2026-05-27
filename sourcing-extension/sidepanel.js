// sidepanel.js

// ─── 이미지 상태 ─────────────────────────────────────────
// { id, type: 'url'|'file', src: string|null, file: File|null, name: string|null, selected: boolean }
let imageState = [];
let blobUrls = []; // 페이지 언로드 시 정리용

function makeImageId() {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function revokeBlobUrls() {
  blobUrls.forEach((u) => URL.revokeObjectURL(u));
  blobUrls = [];
}

function getDisplaySrc(img) {
  if (img.type === 'url') return img.src;
  if (img.type === 'file' && img.file) {
    const u = URL.createObjectURL(img.file);
    blobUrls.push(u);
    return u;
  }
  return '';
}

function getSelectedImages() {
  return imageState.filter((i) => i.selected);
}

// ─── 이미지 그리드 렌더링 ────────────────────────────────

function renderImageGrid() {
  const grid = document.getElementById('imageGrid');
  const selCountEl = document.getElementById('imgSelCount');
  if (!grid || !selCountEl) return;

  revokeBlobUrls();
  grid.innerHTML = '';

  const selected = getSelectedImages();
  selCountEl.textContent = selected.length > 0 ? '✓ 대표 선택됨' : '클릭해서 선택';

  if (imageState.length === 0) {
    grid.innerHTML = '<div class="img-empty">이미지 없음 — 아래에서 직접 추가하세요</div>';
    return;
  }

  imageState.forEach((img) => {
    const isSelected = img.selected;
    const displaySrc = getDisplaySrc(img);

    const cell = document.createElement('div');
    cell.className = `img-cell${isSelected ? ' selected' : ' unselected'}`;
    cell.dataset.id = img.id;

    if (displaySrc) {
      const imgEl = document.createElement('img');
      imgEl.src = displaySrc;
      imgEl.onerror = () => { imgEl.style.visibility = 'hidden'; };
      cell.appendChild(imgEl);
    }

    // 제거 버튼
    const removeBtn = document.createElement('button');
    removeBtn.className = 'img-remove';
    removeBtn.title = '제거';
    removeBtn.textContent = '✕';
    cell.appendChild(removeBtn);

    // URL 복사 버튼 (url 타입만)
    if (img.type === 'url' && img.src) {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'img-copy-url';
      copyBtn.title = img.src;
      copyBtn.textContent = 'URL';
      cell.appendChild(copyBtn);

      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(img.src);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = img.src;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        copyBtn.textContent = '✓';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = 'URL';
          copyBtn.classList.remove('copied');
        }, 1500);
      });
    }

    // 대표 배지 — 선택된 이미지에만
    if (isSelected) {
      const badge = document.createElement('div');
      badge.className = 'img-badge-main';
      badge.textContent = '대표';
      cell.appendChild(badge);
    }

    // 클릭 → 단일 선택 (이 이미지만 선택, 나머지 해제)
    cell.addEventListener('click', (e) => {
      if (e.target === removeBtn) return;
      imageState.forEach((i) => { i.selected = false; });
      const target = imageState.find((i) => i.id === img.id);
      if (target) target.selected = true;
      renderImageGrid();
    });

    // 제거 버튼 — 선택된 이미지 제거 시 첫 번째 이미지 자동 선택
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasSelected = img.selected;
      imageState = imageState.filter((i) => i.id !== img.id);
      if (wasSelected && imageState.length > 0) imageState[0].selected = true;
      renderImageGrid();
    });

    grid.appendChild(cell);
  });
}

// ─── 이미지 직접 추가 ────────────────────────────────────

// 파일 추가 — 추가된 첫 번째 파일만 선택 (기존 선택 해제)
function addFiles(files) {
  const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
  if (arr.length === 0) return;
  imageState.forEach((i) => { i.selected = false; });
  arr.forEach((file, idx) => {
    imageState.push({
      id: makeImageId(),
      type: 'file',
      src: null,
      file,
      name: file.name,
      selected: idx === 0,
    });
  });
  renderImageGrid();
}

// URL 추가 — 추가된 이미지만 선택 (기존 선택 해제)
function addUrlImage(url) {
  url = url.trim();
  if (!url) return;
  if (imageState.some((i) => i.src === url)) return;
  imageState.forEach((i) => { i.selected = false; });
  imageState.push({
    id: makeImageId(),
    type: 'url',
    src: url,
    file: null,
    name: null,
    selected: true,
  });
  renderImageGrid();
}

// ─── 직접 추가 패널 UI ───────────────────────────────────

document.getElementById('btnDirectAdd').addEventListener('click', () => {
  const panel = document.getElementById('directAddPanel');
  const btn = document.getElementById('btnDirectAdd');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : '';
  btn.classList.toggle('open', !isOpen);
  btn.textContent = isOpen ? '＋ 이미지 직접 추가' : '✕ 닫기';
});

// 탭 전환
document.querySelectorAll('.dtab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.dtab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.dataset.tab;
    document.getElementById('dtabFile').style.display = which === 'file' ? '' : 'none';
    document.getElementById('dtabUrl').style.display = which === 'url' ? '' : 'none';
  });
});

// 파일 드롭존 클릭
document.getElementById('fileDropZone').addEventListener('click', () => {
  document.getElementById('directFile').click();
});
document.getElementById('directFile').addEventListener('change', (e) => {
  addFiles(e.target.files);
  e.target.value = '';
});

// 드래그 앤 드롭
const dropZone = document.getElementById('fileDropZone');
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.style.background = '#fff8f5';
});
dropZone.addEventListener('dragleave', () => {
  dropZone.style.background = '';
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.style.background = '';
  addFiles(e.dataTransfer.files);
});

// URL 추가 버튼
document.getElementById('btnAddUrl').addEventListener('click', () => {
  const input = document.getElementById('directUrl');
  addUrlImage(input.value);
  input.value = '';
});
document.getElementById('directUrl').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addUrlImage(e.target.value);
    e.target.value = '';
  }
});

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

  if (!isSupported) { showState('stateNotProduct'); return; }

  let data;
  try {
    data = await chrome.tabs.sendMessage(tab.id, { action: 'parseProduct' });
  } catch {
    await new Promise((r) => setTimeout(r, 800));
    try {
      data = await chrome.tabs.sendMessage(tab.id, { action: 'parseProduct' });
    } catch {
      showState('stateNotProduct');
      return;
    }
  }

  if (!data) { showState('stateNotProduct'); return; }

  // 폼 채우기
  document.getElementById('inpTitle').value = data.title || '';
  document.getElementById('inpProductUrl').value = data.productUrl || '';

  // 이미지 상태 초기화 — 첫 번째 이미지만 선택
  const parsedUrls = Array.isArray(data.images) ? data.images : (data.imageUrl ? [data.imageUrl] : []);
  imageState = parsedUrls.map((src, idx) => ({
    id: makeImageId(),
    type: 'url',
    src,
    file: null,
    name: null,
    selected: idx === 0,
  }));
  renderImageGrid();

  // 직접 추가 패널 닫기
  document.getElementById('directAddPanel').style.display = 'none';
  document.getElementById('btnDirectAdd').classList.remove('open');
  document.getElementById('btnDirectAdd').textContent = '＋ 이미지 직접 추가';

  showState('statePreview');
}

// ─── 탭 전환 감지 ────────────────────────────────────────

chrome.tabs.onActivated.addListener(() => { loadProduct(); });

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id === tabId) loadProduct();
    });
  }
});

// ─── 알리익스프레스 어필리에이트 링크 변환 ───────────────

async function convertToAffiliateLink(productUrl) {
  const res = await fetch(
    `${CONFIG.SITE_URL}/api/aliexpress/parse?url=${encodeURIComponent(productUrl)}`
  );
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || `API 오류 ${res.status}`);
  }
  return res.json(); // { product_id, title, images, price, affiliate_link }
}

// ─── 큐에 추가 ──────────────────────────────────────────

document.getElementById('btnAdd').addEventListener('click', async () => {
  const btn = document.getElementById('btnAdd');
  btn.disabled = true;

  const rawProductUrl = document.getElementById('inpProductUrl').value.trim();
  const isAliExpress = rawProductUrl.includes('aliexpress.com');
  let finalProductUrl = rawProductUrl;
  let affiliateConverted = false;

  // 알리익스프레스 URL → 어필리에이트 링크 자동 변환
  if (isAliExpress) {
    btn.textContent = '링크 변환 중...';
    try {
      const result = await convertToAffiliateLink(rawProductUrl);
      if (result.affiliate_link) {
        finalProductUrl = result.affiliate_link;
        affiliateConverted = true;
        // 폼 URL 필드도 업데이트
        document.getElementById('inpProductUrl').value = finalProductUrl;
      }
    } catch (err) {
      console.warn('[어필리에이트 변환 실패]', err.message);
      // 실패해도 원본 URL로 계속 진행
    }
  }

  btn.textContent = '저장 중...';

  try {
    const count = await dbCount();

    const imagesToSave = imageState.map((img) => ({
      id: img.id,
      type: img.type,
      src: img.type === 'url' ? img.src : null,
      file: img.type === 'file' ? img.file : null,
      name: img.name,
      selected: img.selected,
    }));

    const selectedImages = imagesToSave.filter((i) => i.selected);
    const mainImageUrl = selectedImages.find((i) => i.type === 'url')?.src || '';

    const platform = rawProductUrl.includes('aliexpress.com')
      ? 'aliexpress'
      : rawProductUrl.includes('coupang.com')
      ? 'coupang'
      : null;

    const item = {
      id: Date.now(),
      title: document.getElementById('inpTitle').value.trim() || '(제목 없음)',
      productUrl: finalProductUrl,
      affiliateConverted,   // 변환 여부 기록
      platform,
      category: document.getElementById('selCategory').value,
      images: imagesToSave,
      imageUrl: mainImageUrl,
      videoFile: null,
      videoName: null,
      order: count,
      addedAt: Date.now(),
    };

    await dbAdd(item);
    await refreshBadge();

    // 성공 화면에 변환 결과 표시
    const sub = document.querySelector('#stateSuccess .success-sub');
    if (sub) {
      sub.innerHTML = isAliExpress
        ? (affiliateConverted
            ? '✅ 어필리에이트 링크로 자동 변환됐어요.<br>다음 상품으로 이동하면 자동 파싱됩니다.'
            : '⚠️ 링크 변환 실패 — 원본 URL로 저장됐어요.<br>큐에서 직접 수정하세요.')
        : '다음 상품 페이지로 이동하면<br>자동으로 파싱됩니다.';
    }

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
document.getElementById('btnRefresh').addEventListener('click', loadProduct);
document.getElementById('btnAddMore').addEventListener('click', loadProduct);

window.addEventListener('unload', revokeBlobUrls);

// ─── 초기화 ─────────────────────────────────────────────
(async () => {
  await refreshBadge();
  await loadProduct();
})();
