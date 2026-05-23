// queue.js — 큐 관리 페이지 로직

let allItems = [];
let dragSrcId = null;

// ─── 이미지 헬퍼 ─────────────────────────────────────────

// 카드에 표시할 대표 이미지 URL (blob URL 포함)
function getCardImageSrc(item) {
  if (Array.isArray(item.images) && item.images.length > 0) {
    const sel = item.images.filter((i) => i.selected);
    const main = sel[0] || item.images[0];
    if (main.type === 'url' && main.src) return main.src;
    if (main.type === 'file' && main.file) return URL.createObjectURL(main.file);
  }
  return item.imageUrl || '';
}

// 업로드 시 첫 번째 선택 이미지를 R2에 올리고 URL 반환
async function getMainR2Url(item) {
  // 새 구조: item.images 배열
  if (Array.isArray(item.images) && item.images.length > 0) {
    const sel = item.images.filter((i) => i.selected);
    const main = sel[0] || item.images[0];

    if (main.type === 'url' && main.src) {
      const res = await fetch(`${CONFIG.SITE_URL}/api/extension/proxy-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': CONFIG.ADMIN_KEY },
        body: JSON.stringify({ imageUrl: main.src }),
      });
      if (!res.ok) throw new Error(`이미지 업로드 실패: ${res.status}`);
      return (await res.json()).r2Url;
    }

    if (main.type === 'file' && main.file) {
      const fd = new FormData();
      fd.append('file', main.file, main.name || 'image.jpg');
      const res = await fetch(`${CONFIG.SITE_URL}/api/upload`, {
        method: 'POST',
        headers: { 'X-Admin-Key': CONFIG.ADMIN_KEY },
        body: fd,
      });
      if (!res.ok) throw new Error(`이미지 파일 업로드 실패: ${res.status}`);
      return (await res.json()).url;
    }
  }

  // 하위 호환: 구버전 item.imageUrl
  if (item.imageUrl) {
    const res = await fetch(`${CONFIG.SITE_URL}/api/extension/proxy-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': CONFIG.ADMIN_KEY },
      body: JSON.stringify({ imageUrl: item.imageUrl }),
    });
    if (!res.ok) throw new Error(`이미지 업로드 실패: ${res.status}`);
    return (await res.json()).r2Url;
  }

  return '';
}

// ─── 초기화 ─────────────────────────────────────────────

async function init() {
  allItems = await dbGetAll();
  renderGrid();
  updateTopbar();
}

// ─── 렌더링 ─────────────────────────────────────────────

function renderGrid() {
  const grid = document.getElementById('grid');
  const empty = document.getElementById('emptyState');

  // 기존 카드 제거 (빈 상태 유지)
  Array.from(grid.children).forEach((el) => {
    if (el !== empty) el.remove();
  });

  if (allItems.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  allItems.forEach((item) => {
    const card = makeCard(item);
    grid.appendChild(card);
  });
}

function makeCard(item) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = item.id;
  card.draggable = true;

  // 이미지 영역
  const mainSrc = getCardImageSrc(item);
  const imgCount = Array.isArray(item.images) ? item.images.filter((i) => i.selected).length : 0;
  const imgArea = `
    <div class="card-image">
      ${mainSrc
        ? `<img src="${escHtml(mainSrc)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : ''}
      <div class="no-image" style="${mainSrc ? 'display:none' : ''}">🖼️</div>
      ${imgCount > 1 ? `<div class="video-badge">🖼️ ${imgCount}장</div>` : ''}
      ${item.videoFile ? '<div class="video-badge" style="bottom:26px">🎬 영상</div>' : ''}
    </div>`;

  // 카테고리 옵션
  const catOpts = [
    ['mild', '순한맛 — 이게 머고?'],
    ['medium', '보통맛 — 이게? 머고???'],
    ['hot', '매운맛 — 이게??? 머고???????'],
  ]
    .map(([val, label]) => `<option value="${val}"${item.category === val ? ' selected' : ''}>${label}</option>`)
    .join('');

  card.innerHTML = `
    <div class="card-top">
      <input type="checkbox" class="card-checkbox">
      <button class="card-delete" title="삭제">✕</button>
    </div>
    ${imgArea}
    <div class="drag-handle" title="드래그해서 순서 변경">⣿</div>
    <div class="card-body">
      <textarea class="editable card-title" rows="2" placeholder="제목">${escHtml(item.title)}</textarea>
      <input type="text" class="editable card-price" placeholder="₩0,000" value="${escHtml(item.price)}">
      <select class="card-category">${catOpts}</select>
    </div>
    <div class="card-footer">
      <button class="card-video-btn ${item.videoFile ? 'has-video' : ''}">
        ${item.videoFile ? `🎬 ${escHtml(item.videoName || '영상 있음')}` : '+ 영상 추가'}
      </button>
    </div>
    <div class="card-error-msg"></div>`;

  // ── 이벤트 바인딩 ──

  // 체크박스
  const chk = card.querySelector('.card-checkbox');
  chk.addEventListener('change', () => {
    card.classList.toggle('selected', chk.checked);
    updateTopbar();
  });

  // 삭제
  card.querySelector('.card-delete').addEventListener('click', async () => {
    if (!confirm(`"${item.title}" 을(를) 삭제할까요?`)) return;
    await dbDelete(item.id);
    allItems = allItems.filter((i) => i.id !== item.id);
    card.remove();
    if (allItems.length === 0) document.getElementById('emptyState').style.display = '';
    updateTopbar();
  });

  // 제목 인라인 수정
  const titleEl = card.querySelector('.card-title');
  titleEl.addEventListener('blur', async () => {
    item.title = titleEl.value.trim() || '(제목 없음)';
    await dbPut(item);
  });

  // 가격 인라인 수정
  const priceEl = card.querySelector('.card-price');
  priceEl.addEventListener('blur', async () => {
    item.price = priceEl.value.trim();
    await dbPut(item);
  });

  // 카테고리 변경
  const catEl = card.querySelector('.card-category');
  catEl.addEventListener('change', async () => {
    item.category = catEl.value;
    await dbPut(item);
  });

  // 영상 추가 버튼
  const videoBtn = card.querySelector('.card-video-btn');
  videoBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 500 * 1024 * 1024) {
        alert('500MB 이상 영상은 관리자 페이지에서 업로드해 주세요.');
        return;
      }
      item.videoFile = file;
      item.videoName = file.name;
      await dbPut(item);
      videoBtn.textContent = `🎬 ${file.name}`;
      videoBtn.classList.add('has-video');
      const badge = card.querySelector('.video-badge');
      if (badge) badge.remove();
      // 이미지 영역에 뱃지 추가
      const imgArea = card.querySelector('.card-image');
      const b = document.createElement('div');
      b.className = 'video-badge';
      b.textContent = '🎬 영상';
      imgArea.appendChild(b);
    };
    input.click();
  });

  // 드래그 앤 드롭
  card.addEventListener('dragstart', (e) => {
    dragSrcId = item.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging', 'drag-over');
    dragSrcId = null;
  });
  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (dragSrcId !== item.id) card.classList.add('drag-over');
  });
  card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
  card.addEventListener('drop', async (e) => {
    e.preventDefault();
    card.classList.remove('drag-over');
    if (dragSrcId == null || dragSrcId === item.id) return;

    // DOM 내 현재 카드 순서를 기준으로 드래그 소스를 현재 위치 앞에 삽입
    const grid = document.getElementById('grid');
    const cards = Array.from(grid.querySelectorAll('.card'));
    const srcCard = grid.querySelector(`.card[data-id="${dragSrcId}"]`);
    if (srcCard) {
      grid.insertBefore(srcCard, card);
    }

    // 새 순서를 DB에 반영
    const newOrder = Array.from(grid.querySelectorAll('.card')).map((c) =>
      Number(c.dataset.id)
    );
    await dbReorder(newOrder);
    allItems = await dbGetAll();
  });

  return card;
}

// ─── 상단 바 업데이트 ───────────────────────────────────

function updateTopbar() {
  const checked = document.querySelectorAll('.card-checkbox:checked').length;
  const total = allItems.length;
  document.getElementById('totalCount').textContent = `${total}개`;
  document.getElementById('selectedCount').textContent = checked;
  document.getElementById('btnUpload').disabled = checked === 0;
  document.getElementById('btnDeleteSelected').disabled = checked === 0;
}

// ─── 전체 선택 ──────────────────────────────────────────

document.getElementById('btnSelectAll').addEventListener('click', () => {
  const all = document.querySelectorAll('.card-checkbox');
  const anyUnchecked = Array.from(all).some((c) => !c.checked);
  all.forEach((c) => {
    c.checked = anyUnchecked;
    c.closest('.card').classList.toggle('selected', anyUnchecked);
  });
  updateTopbar();
});

// ─── 선택 삭제 ──────────────────────────────────────────

document.getElementById('btnDeleteSelected').addEventListener('click', async () => {
  const checked = document.querySelectorAll('.card-checkbox:checked');
  if (checked.length === 0) return;
  if (!confirm(`선택한 ${checked.length}개를 삭제할까요?`)) return;

  for (const chk of checked) {
    const id = Number(chk.closest('.card').dataset.id);
    await dbDelete(id);
    chk.closest('.card').remove();
  }
  allItems = await dbGetAll();
  if (allItems.length === 0) document.getElementById('emptyState').style.display = '';
  updateTopbar();
});

// ─── 업로드 ─────────────────────────────────────────────

document.getElementById('btnUpload').addEventListener('click', async () => {
  const checked = Array.from(document.querySelectorAll('.card-checkbox:checked'));
  if (checked.length === 0) return;

  const selectedIds = checked.map((c) => Number(c.closest('.card').dataset.id));
  const selectedItems = allItems.filter((i) => selectedIds.includes(i.id));

  // UI 비활성화
  document.getElementById('btnUpload').disabled = true;
  document.getElementById('progressBar').style.display = '';
  setStatus('업로드 준비 중...');

  let done = 0;
  for (const item of selectedItems) {
    const card = document.querySelector(`.card[data-id="${item.id}"]`);
    setStatus(`(${done + 1}/${selectedItems.length}) "${item.title}" 업로드 중...`);
    setProgress(done / selectedItems.length);

    try {
      // 1. 대표 이미지 R2 업로드
      const r2ImageUrl = await getMainR2Url(item);

      // 2. 영상 R2 업로드 (있을 경우)
      let r2VideoUrl = null;
      if (item.videoFile) {
        r2VideoUrl = await uploadVideoFile(item.videoFile);
      }

      // 3. Supabase insert
      const supaRes = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/products`, {
        method: 'POST',
        headers: {
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          title: item.title,
          category: item.category,
          image_url: r2ImageUrl,
          video_url: r2VideoUrl,
          price: item.price,
          affiliate_link: item.productUrl,
          is_active: true,
        }),
      });
      if (!supaRes.ok) {
        const errText = await supaRes.text();
        throw new Error(`DB 저장 실패: ${errText}`);
      }

      // 4. 큐에서 제거
      await dbDelete(item.id);
      card?.remove();
      allItems = allItems.filter((i) => i.id !== item.id);
      done++;
    } catch (err) {
      console.error('업로드 실패:', item.title, err);
      card?.classList.add('error');
      const errMsg = card?.querySelector('.card-error-msg');
      if (errMsg) errMsg.textContent = err.message;
    }
  }

  setProgress(1);
  setStatus(
    done === selectedItems.length
      ? `✅ ${done}개 업로드 완료!`
      : `⚠️ ${done}/${selectedItems.length}개 완료 (일부 실패)`
  );

  if (allItems.length === 0) document.getElementById('emptyState').style.display = '';
  updateTopbar();
  document.getElementById('btnUpload').disabled = false;

  setTimeout(() => {
    document.getElementById('progressBar').style.display = 'none';
    setStatus('');
  }, 3000);
});

// 영상 파일 → R2 업로드 (presigned URL 방식)
async function uploadVideoFile(file) {
  // presigned URL 발급
  const presignRes = await fetch(`${CONFIG.SITE_URL}/api/upload`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': CONFIG.ADMIN_KEY,
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'video/mp4',
    }),
  });
  if (!presignRes.ok) throw new Error(`Presign 실패: ${presignRes.status}`);
  const { uploadUrl, publicUrl } = await presignRes.json();

  // R2 직접 PUT 업로드
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'video/mp4' },
    body: file,
  });
  if (!putRes.ok) throw new Error(`R2 영상 업로드 실패: ${putRes.status}`);

  return publicUrl;
}

function setStatus(msg) {
  document.getElementById('statusMsg').textContent = msg;
}
function setProgress(ratio) {
  document.getElementById('progressFill').style.width = `${Math.round(ratio * 100)}%`;
}

// ─── 영상으로 상품 추가 모달 ────────────────────────────

document.getElementById('btnAddVideo').addEventListener('click', () => {
  document.getElementById('videoModal').style.display = 'flex';
});
document.getElementById('vmCancel').addEventListener('click', closeVideoModal);
document.getElementById('videoModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('videoModal')) closeVideoModal();
});

function closeVideoModal() {
  document.getElementById('videoModal').style.display = 'none';
  document.getElementById('vmTitle').value = '';
  document.getElementById('vmPrice').value = '';
  document.getElementById('vmImageUrl').value = '';
  document.getElementById('vmProductUrl').value = '';
  document.getElementById('videoFile').value = '';
  document.getElementById('vmCategory').value = 'mild';
}

document.getElementById('vmAdd').addEventListener('click', async () => {
  const file = document.getElementById('videoFile').files[0];
  const title = document.getElementById('vmTitle').value.trim();

  if (!file) { alert('MP4 파일을 선택해 주세요.'); return; }
  if (!title) { alert('제목을 입력해 주세요.'); return; }

  if (file.size > 500 * 1024 * 1024) {
    alert('500MB 이상 영상은 관리자 페이지에서 업로드해 주세요.');
    return;
  }

  const item = {
    id: Date.now(),
    title,
    price: document.getElementById('vmPrice').value.trim(),
    imageUrl: document.getElementById('vmImageUrl').value.trim(),
    productUrl: document.getElementById('vmProductUrl').value.trim(),
    category: document.getElementById('vmCategory').value,
    videoFile: file,
    videoName: file.name,
    order: allItems.length,
    addedAt: Date.now(),
  };

  await dbAdd(item);
  allItems.push(item);

  const grid = document.getElementById('grid');
  document.getElementById('emptyState').style.display = 'none';
  grid.appendChild(makeCard(item));

  updateTopbar();
  closeVideoModal();
});

// ─── 유틸 ───────────────────────────────────────────────

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── 시작 ───────────────────────────────────────────────
init();
