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
  revokeBlobUrls();
  grid.innerHTML = '';

  const selected = getSelectedImages();
  const firstSelected = selected[0];
  document.getElementById('imgSelCount').textContent = `${selected.length}개 선택`;

  if (imageState.length === 0) {
    grid.innerHTML = '<div class="img-empty">이미지 없음 — 아래에서 직접 추가하세요</div>';
    return;
  }

  imageState.forEach((img) => {
    const isSelected = img.selected;
    const isMain = isSelected && firstSelected?.id === img.id;
    const src = getDisplaySrc(img);

    const cell = document.createElement('div');
    cell.className = `img-cell${isSelected ? ' selected' : ' unselected'}`;
    cell.dataset.id = img.id;

    cell.innerHTML = `
      ${src ? `<img src="${src}" onerror="this.style.visibility='hidden'">` : ''}
      <button class="img-remove" title="제거">✕</button>
      ${isSelected ? '<div class="img-check">✓</div>' : ''}
      ${isMain ? '<div class="img-badge-main">대표</div>' : ''}`;

    // 클릭 → 선택/해제 토글
    cell.addEventListener('click', (e) => {
      if (e.target.classList.contains('img-remove')) return;
      const target = imageState.find((i) => i.id === img.id);
      if (target) target.selected = !target.selected;
      renderImageGrid();
    });

    // 제거 버튼
    cell.querySelector('.img-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      imageState = imageState.filter((i) => i.id !== img.id);
      renderImageGrid();
    });

    grid.appendChild(cell);
  });
}

// ─── 이미지 직접 추가 ────────────────────────────────────

// 파일 추가
function addFiles(files) {
  Array.from(files).forEach((file) => {
    if (!file.type.startsWith('image/')) return;
    imageState.push({
      id: makeImageId(),
      type: 'file',
      src: null,
      file,
      name: file.name,
      selected: true,
    });
  });
  renderImageGrid();
}

// URL 추가
function addUrlImage(url) {
  url = url.trim();
  if (!url) return;
  // 간단 중복 체크
  if (imageState.some((i) => i.src === url)) return;
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
  document.getElementById('inpPrice').value = data.price || '';
  document.getElementById('inpProductUrl').value = data.productUrl || '';

  // 이미지 상태 초기화 — 파싱된 이미지 모두 선택 상태로
  const parsedUrls = Array.isArray(data.images) ? data.images : (data.imageUrl ? [data.imageUrl] : []);
  imageState = parsedUrls.map((src) => ({
    id: makeImageId(),
    type: 'url',
    src,
    file: null,
    name: null,
    selected: true,
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

    const item = {
      id: Date.now(),
      title: document.getElementById('inpTitle').value.trim() || '(제목 없음)',
      price: document.getElementById('inpPrice').value.trim(),
      productUrl: finalProductUrl,
      affiliateConverted,   // 변환 여부 기록
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
