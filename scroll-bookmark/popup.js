// ── IndexedDB ──────────────────────────────────────────────
const DB_NAME = 'scroll-bookmarks';
const STORE = 'bookmarks';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE, { keyPath: 'url' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function dbGet(url) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(url);
    req.onsuccess = e => resolve(e.target.result ?? null);
    req.onerror = e => reject(e.target.error);
  });
}

async function dbPut(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function dbDelete(url) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(url);
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

// ── Helpers ────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;');
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname !== '/' ? u.pathname : '';
    return u.hostname + path;
  } catch {
    return url;
  }
}

function calcPct(scrollY, scrollHeight, clientHeight) {
  const scrollable = scrollHeight - clientHeight;
  return scrollable > 0 ? Math.round((scrollY / scrollable) * 100) : 0;
}

// ── 페이지 조작 (executeScript) ────────────────────────────
async function getPageInfo(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        scrollY: Math.round(window.scrollY),
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: window.innerHeight,
        title: document.title || location.href,
      }),
    });
    return result;
  } catch {
    return null;
  }
}

// 'done' | 'stuck' | 'error' 반환
async function doScrollTo(tabId, y) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (targetY) => new Promise((resolve) => {
        const POLL_MS = 200;
        const TOLERANCE = 5;
        const MAX_SAME = 3;
        const MAX_ITER = 40; // 최대 8초

        let sameCount = 0;
        let lastY = Math.round(window.scrollY);
        let iterations = 0;

        window.scrollTo({ top: targetY, behavior: 'smooth' });

        const timer = setInterval(() => {
          const currentY = Math.round(window.scrollY);
          iterations++;

          // 목표 도달
          if (Math.abs(currentY - targetY) <= TOLERANCE) {
            clearInterval(timer);
            resolve('done');
            return;
          }

          // 안전 타임아웃
          if (iterations >= MAX_ITER) {
            clearInterval(timer);
            resolve('stuck');
            return;
          }

          // 위치 변화 없음 체크
          if (Math.abs(currentY - lastY) <= 1) {
            sameCount++;
            if (sameCount >= MAX_SAME) {
              clearInterval(timer);
              resolve('stuck');
              return;
            }
            // 멈췄지만 목표 미달 → 재시도
            window.scrollTo({ top: targetY, behavior: 'smooth' });
          } else {
            sameCount = 0;
          }

          lastY = currentY;
        }, POLL_MS);
      }),
      args: [y],
    });
    return result; // 'done' | 'stuck'
  } catch {
    return 'error';
  }
}

// ── 전역 상태 ──────────────────────────────────────────────
let currentTab = null;
let currentBookmark = null;

// ── 현재 페이지 섹션 렌더 ──────────────────────────────────
async function renderCurrentSection() {
  const el = document.getElementById('current-content');
  const { url, id: tabId } = currentTab;

  // 북마크 불가 페이지 (chrome://, about:, 확장 페이지 등)
  if (!url || /^(chrome|about|edge|chrome-extension):/.test(url)) {
    el.innerHTML = `<div class="unavailable-text">이 페이지는 북마크할 수 없습니다.</div>`;
    return;
  }

  const [pageInfo, saved] = await Promise.all([getPageInfo(tabId), dbGet(url)]);
  currentBookmark = saved;

  if (!pageInfo) {
    el.innerHTML = `<div class="unavailable-text">이 페이지에는 접근할 수 없습니다.</div>`;
    return;
  }

  let html = `
    <div class="page-title">${escHtml(pageInfo.title)}</div>
    <div class="page-url">${escHtml(shortUrl(url))}</div>
  `;

  if (currentBookmark) {
    const pct = calcPct(currentBookmark.scrollY, currentBookmark.scrollHeight, currentBookmark.clientHeight);
    html += `
      <div class="saved-info">
        <span class="saved-info-icon">📍</span>
        <span class="saved-info-text">저장된 위치: ${pct}% &middot; ${timeAgo(currentBookmark.savedAt)}</span>
      </div>
      <button class="btn btn-secondary" id="btn-goto">저장된 위치로 이동 ↓</button>
    `;
  }

  html += `<button class="btn btn-primary" id="btn-save">여기까지 봤다 📌</button>`;
  el.innerHTML = html;

  // 저장 버튼
  document.getElementById('btn-save').addEventListener('click', async () => {
    if (!confirm('현재 위치로 덮어쓸까요?')) return;
    const info = await getPageInfo(tabId);
    if (!info) return;
    await dbPut({
      url,
      title: info.title,
      scrollY: info.scrollY,
      scrollHeight: info.scrollHeight,
      clientHeight: info.clientHeight,
      savedAt: new Date().toISOString(),
    });
    const btn = document.getElementById('btn-save');
    btn.textContent = '저장됨 ✓';
    btn.className = 'btn btn-success';
    btn.disabled = true;
    currentBookmark = await dbGet(url);
    await renderList();
  });

  // 이동 버튼 (북마크 있을 때만)
  document.getElementById('btn-goto')?.addEventListener('click', async () => {
    const gotoBtn = document.getElementById('btn-goto');
    if (gotoBtn) {
      gotoBtn.textContent = '이동 중...';
      gotoBtn.disabled = true;
    }
    const result = await doScrollTo(tabId, currentBookmark.scrollY);
    if (result === 'stuck' || result === 'error') {
      if (gotoBtn) {
        gotoBtn.textContent = '여기까지가 최대 위치예요';
        gotoBtn.className = 'btn btn-secondary';
        gotoBtn.disabled = true;

        if (!document.getElementById('btn-goto-reset')) {
          const resetBtn = document.createElement('button');
          resetBtn.id = 'btn-goto-reset';
          resetBtn.className = 'btn btn-reset';
          resetBtn.textContent = '🔄 다시 시도';
          gotoBtn.insertAdjacentElement('afterend', resetBtn);
          resetBtn.addEventListener('click', () => {
            gotoBtn.textContent = '저장된 위치로 이동 ↓';
            gotoBtn.className = 'btn btn-secondary';
            gotoBtn.disabled = false;
            resetBtn.remove();
          });
        }
      }
    } else {
      window.close();
    }
  });
}

// ── 북마크 목록 렌더 ───────────────────────────────────────
async function renderList() {
  const listEl = document.getElementById('bookmark-list');
  const countEl = document.getElementById('bookmark-count');

  const all = await dbGetAll();
  // 최신 저장 순으로 정렬
  all.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

  countEl.textContent = all.length;

  if (all.length === 0) {
    listEl.innerHTML = `<div class="empty-text">저장된 북마크가 없습니다.</div>`;
    return;
  }

  listEl.innerHTML = all.map(bm => {
    const pct = calcPct(bm.scrollY, bm.scrollHeight, bm.clientHeight);
    const isCurrent = currentTab && bm.url === currentTab.url;
    return `
      <div class="bookmark-item${isCurrent ? ' current-page' : ''}">
        <div class="bookmark-item-main" data-url="${escAttr(bm.url)}">
          <div class="bookmark-item-title">${escHtml(bm.title || bm.url)}</div>
          <div class="bookmark-item-url">${escHtml(shortUrl(bm.url))}</div>
          <div class="bookmark-item-meta">
            <span class="scroll-badge">${pct}%</span>
            <span class="time-text">${timeAgo(bm.savedAt)}</span>
          </div>
        </div>
        <button class="delete-btn" data-url="${escAttr(bm.url)}" title="삭제">&times;</button>
      </div>
    `;
  }).join('');

  // 목록 아이템 클릭 → 해당 URL로 현재 탭 이동
  listEl.querySelectorAll('.bookmark-item-main').forEach(el => {
    el.addEventListener('click', () => {
      chrome.tabs.update(currentTab.id, { url: el.dataset.url });
      window.close();
    });
  });

  // 개별 삭제
  listEl.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const url = btn.dataset.url;
      await dbDelete(url);
      if (currentTab && url === currentTab.url) {
        currentBookmark = null;
        await renderCurrentSection();
      }
      await renderList();
    });
  });
}

// ── 초기화 ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  await renderCurrentSection();
  await renderList();
});
