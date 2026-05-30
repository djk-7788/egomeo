/* ══════════════════════════════════════════════════════
   탭 전환
══════════════════════════════════════════════════════ */
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.toggle("active", p.id === `tab-${target}`);
      p.classList.toggle("hidden", p.id !== `tab-${target}`);
    });
    btn.classList.add("active");
  });
});

/* ══════════════════════════════════════════════════════
   슬라이드쇼 탭
══════════════════════════════════════════════════════ */
let fetchedImages = []; // { url, blobUrl }
let selectedImages = []; // { url, blobUrl }

const aliUrlInput = document.getElementById("ali-url");
const aliUrlClear = document.getElementById("ali-url-clear");
const fetchBtn = document.getElementById("fetch-images-btn");
const fetchError = document.getElementById("fetch-error");
const fetchLoading = document.getElementById("fetch-loading");
const imageGrid = document.getElementById("image-grid");
const selectedCount = document.getElementById("selected-count");
const toStep3Btn = document.getElementById("to-step3-btn");

// 클리어 버튼 표시 토글
aliUrlInput.addEventListener("input", () => {
  aliUrlClear.classList.toggle("visible", aliUrlInput.value.length > 0);
});
aliUrlClear.addEventListener("click", () => {
  aliUrlInput.value = "";
  aliUrlClear.classList.remove("visible");
  aliUrlInput.focus();
});

/* ── step 전환 헬퍼 ── */
function showStep(n) {
  document.querySelectorAll("#tab-slideshow .step").forEach((s) => {
    s.classList.toggle("active", s.id === `step${n}`);
    s.classList.toggle("hidden", s.id !== `step${n}`);
  });
}

/* ── 알리익스프레스 이미지 추출 ── */
fetchBtn.addEventListener("click", () => fetchAliImages());
aliUrlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") fetchAliImages(); });

/* ── 직접 fetch 헬퍼 (extension 페이지는 host_permissions로 CORS 우회 가능) ── */
async function extFetch(url) {
  // chrome-extension:// 페이지는 host_permissions 범위 내 URL을 직접 fetch할 수 있음
  const resp = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
      "Cache-Control": "no-cache",
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} (${url})`);
  return resp;
}

async function fetchImageAsBlob(url) {
  const resp = await fetch(url, {
    headers: { Accept: "image/*" },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  return { url, blobUrl: URL.createObjectURL(blob) };
}

async function fetchAliImages() {
  const rawUrl = aliUrlInput.value.trim();
  if (!rawUrl) return;

  fetchError.classList.add("hidden");
  document.getElementById("js-page-notice").classList.add("hidden");
  fetchLoading.classList.remove("hidden");
  fetchBtn.disabled = true;

  try {
    const productId = extractAliProductId(rawUrl);
    if (!productId) throw new Error("알리익스프레스 URL에서 상품 ID를 찾을 수 없습니다.");

    const pageUrl = `https://www.aliexpress.com/item/${productId}.html`;

    // [1단계] HTML 페이지 fetch
    let html;
    try {
      const resp = await extFetch(pageUrl);
      html = await resp.text();
    } catch (e) {
      throw new Error(`[1단계] 페이지 로드 실패: ${e.message}`);
    }

    // [2단계] 이미지 URL 추출
    const imageUrls = extractImagesFromAliHtml(html);
    if (imageUrls.length === 0) {
      // 추가 진단: JavaScript 렌더링 필요 페이지일 가능성
      const isJsPage = html.includes("__NEXT_DATA__") || html.includes("window.runParams");
      throw new Error(
        `[2단계] 이미지 URL 추출 실패.` +
        (isJsPage ? " (JS 렌더링 페이지 감지됨 — 아래 안내 참고)" : " URL을 다시 확인해주세요.")
      );
    }

    // [3단계] 이미지 blob 변환
    const resolved = await Promise.allSettled(imageUrls.map(fetchImageAsBlob));
    fetchedImages = resolved.filter((r) => r.status === "fulfilled").map((r) => r.value);

    if (fetchedImages.length === 0) {
      const firstErr = resolved.find((r) => r.status === "rejected")?.reason?.message ?? "unknown";
      throw new Error(`[3단계] 이미지 로드 실패 (${imageUrls.length}개 URL 발견). 오류: ${firstErr}`);
    }

    renderImageGrid();
    showStep(2);
  } catch (err) {
    fetchError.textContent = err.message || "알 수 없는 오류가 발생했습니다.";
    fetchError.classList.remove("hidden");
    const jsNotice = document.getElementById("js-page-notice");
    if (err.message && err.message.includes("JS 렌더링")) {
      jsNotice.classList.remove("hidden");
    } else {
      jsNotice.classList.add("hidden");
    }
  } finally {
    fetchLoading.classList.add("hidden");
    fetchBtn.disabled = false;
  }
}

function extractAliProductId(url) {
  const patterns = [
    /aliexpress\.com\/item\/(\d+)\.html/,
    /aliexpress\.com\/i\/(\d+)\.html/,
    /item\/(\d+)/,
    /\/(\d{10,})(?:[/?]|$)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractImagesFromAliHtml(html) {
  const images = new Set();

  // 1. __NEXT_DATA__ (새 알리 페이지 구조)
  const nextDataMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      deepFindImgUrls(JSON.parse(nextDataMatch[1]), images);
    } catch { /* ignore */ }
  }

  // 2. window.runParams
  const runParamsMatch = html.match(/window\.runParams\s*=\s*(\{[\s\S]*?\});\s*(?:window\.|var |let |const |<\/script>)/);
  if (runParamsMatch) {
    try {
      deepFindImgUrls(JSON.parse(runParamsMatch[1]), images);
    } catch { /* ignore */ }
  }

  // 3. imagePathList 배열 (JSON 조각)
  for (const m of html.matchAll(/"imagePathList"\s*:\s*\[([\s\S]*?)\]/g)) {
    for (const u of m[1].matchAll(/"((?:https?:)?\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/g)) {
      images.add(normalizeAliImg(u[1]));
    }
  }

  // 4. alicdn.com URL 직접 추출 (다양한 따옴표/속성 안에 있는 것)
  for (const m of html.matchAll(/["']?(https?:)?\/\/[a-z0-9.-]*alicdn\.com\/[^\s"'<>\\]+\.(?:jpg|jpeg|png|webp)[^\s"'<>\\]*/g)) {
    const raw = m[0].replace(/^["']/, "");
    const clean = normalizeAliImg(raw);
    if (!clean.includes("icon") && !clean.includes("logo") && !clean.includes("banner") && clean.length > 40) {
      images.add(clean);
    }
  }

  // 5. og:image 폴백
  const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
  if (ogMatch) images.add(normalizeAliImg(ogMatch[1]));

  // 유효한 alicdn URL만 반환
  return [...images]
    .filter((u) => u.startsWith("https://") && u.includes("alicdn.com"))
    .slice(0, 30);
}

function deepFindImgUrls(obj, set, depth = 0) {
  if (depth > 12 || !obj || typeof obj !== "object") return;
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "string") {
      const lower = key.toLowerCase();
      if (
        (lower.includes("image") || lower.includes("img") || lower.includes("photo") || lower.includes("pic")) &&
        (val.includes("alicdn.com") || val.match(/\.(jpg|jpeg|png|webp)$/i))
      ) {
        set.add(normalizeAliImg(val));
      }
    } else if (Array.isArray(val)) {
      val.forEach((item) => {
        if (typeof item === "string" && item.includes("alicdn.com")) set.add(normalizeAliImg(item));
        else deepFindImgUrls(item, set, depth + 1);
      });
    } else if (typeof val === "object") {
      deepFindImgUrls(val, set, depth + 1);
    }
  }
}

function normalizeAliImg(url) {
  url = url.replace(/^\/\//, "https://");
  // 썸네일 suffix 제거 → 원본 고해상도
  url = url.replace(/[_.]?\d+x\d+(?:q\d+)?\.(jpg|jpeg|png|webp)$/i, ".$1");
  url = url.replace(/[_.]?\d+x\d+\.(jpg|jpeg|png|webp)$/i, ".$1");
  // 쿼리스트링 제거
  url = url.split("?")[0];
  return url;
}

/* ── 이미지 그리드 렌더링 ── */
function renderImageGrid() {
  imageGrid.innerHTML = "";
  selectedImages = [];
  updateSelectedCount();

  fetchedImages.forEach((img, idx) => {
    const card = document.createElement("div");
    card.className = "img-card";
    card.innerHTML = `
      <img src="${img.blobUrl}" alt="이미지 ${idx + 1}" loading="lazy" />
      <div class="check-overlay"></div>
    `;
    card.addEventListener("click", () => toggleImageSelect(card, img));
    imageGrid.appendChild(card);
  });
}

function toggleImageSelect(card, img) {
  const isSelected = card.classList.contains("selected");
  if (isSelected) {
    card.classList.remove("selected");
    selectedImages = selectedImages.filter((i) => i.url !== img.url);
  } else {
    card.classList.add("selected");
    selectedImages.push(img);
  }
  updateSelectedCount();
}

function updateSelectedCount() {
  selectedCount.textContent = `${selectedImages.length}개 선택됨`;
  toStep3Btn.disabled = selectedImages.length === 0;
}

document.getElementById("select-all-btn").addEventListener("click", () => {
  selectedImages = [...fetchedImages];
  document.querySelectorAll(".img-card").forEach((c) => c.classList.add("selected"));
  updateSelectedCount();
});
document.getElementById("deselect-all-btn").addEventListener("click", () => {
  selectedImages = [];
  document.querySelectorAll(".img-card").forEach((c) => c.classList.remove("selected"));
  updateSelectedCount();
});

document.getElementById("back-to-step1").addEventListener("click", () => showStep(1));
toStep3Btn.addEventListener("click", () => {
  sortableImages = [...selectedImages]; // step3 진입 시에만 초기화
  renderSortableList();
  showStep(3);
});

/* ── STEP 3: 드래그 정렬 ── */
let sortableImages = [];
let dragSrc = null;

function renderSortableList() {
  // sortableImages는 toStep3Btn 핸들러에서만 초기화 — 여기서 리셋하면 drop 후 재정렬이 사라짐
  const list = document.getElementById("sortable-list");
  list.innerHTML = "";

  sortableImages.forEach((img, idx) => {
    const item = document.createElement("div");
    item.className = "sortable-item";
    item.draggable = true;
    item.dataset.idx = idx;
    // img에 draggable="false" — 이미지 자체 드래그가 sortable-item 드래그를 가로채지 않도록
    item.innerHTML = `
      <img src="${img.blobUrl}" alt="이미지 ${idx + 1}" draggable="false" />
      <div class="item-num">${idx + 1}</div>
    `;

    item.addEventListener("dragstart", (e) => {
      dragSrc = item;
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      document.querySelectorAll(".sortable-item").forEach((i) => i.classList.remove("drag-over"));
    });
    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (item !== dragSrc) item.classList.add("drag-over");
    });
    item.addEventListener("dragleave", () => item.classList.remove("drag-over"));
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!dragSrc || dragSrc === item) return;
      const fromIdx = parseInt(dragSrc.dataset.idx);
      const toIdx = parseInt(item.dataset.idx);
      const moved = sortableImages.splice(fromIdx, 1)[0];
      sortableImages.splice(toIdx, 0, moved);
      renderSortableList();
    });

    list.appendChild(item);
  });
}

/* ── 간격 슬라이더 ── */
const intervalSlider = document.getElementById("interval-slider");
const intervalDisplay = document.getElementById("interval-display");
intervalSlider.addEventListener("input", () => {
  intervalDisplay.textContent = (intervalSlider.value / 10).toFixed(1) + "초";
});

/* ── STEP 3 네비 ── */
document.getElementById("back-to-step2").addEventListener("click", () => showStep(2));

/* ── 영상 만들기 ── */
document.getElementById("make-video-btn").addEventListener("click", makeSlideshow);

async function makeSlideshow() {
  const makeBtn = document.getElementById("make-video-btn");
  const makeLoading = document.getElementById("make-loading");
  const makeError = document.getElementById("make-error");
  const makeProgress = document.getElementById("make-progress");
  const resolution = parseInt(document.getElementById("resolution-select").value);
  const intervalMs = (parseInt(intervalSlider.value) / 10) * 1000;

  if (sortableImages.length === 0) return;

  makeBtn.disabled = true;
  makeError.classList.add("hidden");
  makeLoading.classList.remove("hidden");
  makeProgress.textContent = "이미지 로딩 중...";

  try {
    // ① 녹화 전 모든 이미지 미리 로드 (녹화 중 로딩 지연으로 인한 타이밍 오차 제거)
    const imgEls = await Promise.all(
      sortableImages.map((img, i) => loadImage(img.blobUrl).then(el => {
        makeProgress.textContent = `이미지 로딩 중... (${i + 1}/${sortableImages.length})`;
        return el;
      }))
    );

    // 해상도 결정
    let canvasW, canvasH;
    if (resolution === 1920) { canvasW = 1920; canvasH = 1080; }
    else { canvasW = resolution; canvasH = resolution; }

    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d");

    // ② 첫 프레임을 미리 그리고 captureStream 시작 (녹화 시작 시 검은 화면 방지)
    makeProgress.textContent = "녹화 준비 중...";
    renderFrame(ctx, imgEls[0], canvasW, canvasH);

    const mimeType = getSupportedMime();
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.start();

    // ③ 각 이미지를 정확히 intervalMs씩 녹화 (로딩 없이 draw만 수행)
    for (let i = 0; i < imgEls.length; i++) {
      makeProgress.textContent = `녹화 중... (${i + 1}/${imgEls.length})`;
      renderFrame(ctx, imgEls[i], canvasW, canvasH);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    // ④ 마지막 이미지 재드로우 + captureStream 처리 대기 후 종료
    //    renderFrame(캔버스 드로우)은 동기지만 captureStream의 프레임 캡처는 비동기.
    //    대기 없이 바로 stop()하면 마지막 프레임이 캡처되기 전에 녹화가 끊김.
    renderFrame(ctx, imgEls[imgEls.length - 1], canvasW, canvasH);
    await new Promise(r => setTimeout(r, 200)); // captureStream 처리 대기 (~6 프레임)
    recorder.stop();

    await new Promise((resolve) => { recorder.onstop = resolve; });

    makeProgress.textContent = "파일 저장 중...";
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const blob = new Blob(chunks, { type: mimeType });
    downloadBlob(blob, `slideshow.${ext}`);
  } catch (err) {
    makeError.textContent = "영상 생성 실패: " + (err.message || "알 수 없는 오류");
    makeError.classList.remove("hidden");
  } finally {
    makeBtn.disabled = false;
    makeLoading.classList.add("hidden");
  }
}

function getSupportedMime() {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// object-fit: cover 방식으로 캔버스에 그리기 (동기)
function renderFrame(ctx, imgEl, w, h) {
  const scale = Math.max(w / imgEl.naturalWidth, h / imgEl.naturalHeight);
  const sw = imgEl.naturalWidth * scale;
  const sh = imgEl.naturalHeight * scale;
  const sx = (w - sw) / 2;
  const sy = (h - sh) / 2;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(imgEl, sx, sy, sw, sh);
}

/* ══════════════════════════════════════════════════════
   영상 자르기 탭
══════════════════════════════════════════════════════ */
const videoFile = document.getElementById("video-file");
const uploadArea = document.getElementById("upload-area");
const previewVideo = document.getElementById("preview-video");
const timelineWrap = document.getElementById("timeline-wrap");
const trimmerEmpty = document.getElementById("trimmer-empty");
const timelineBar = document.getElementById("timeline-bar");
const timelineSelected = document.getElementById("timeline-selected");
const handleStart = document.getElementById("handle-start");
const handleEnd = document.getElementById("handle-end");
const startTimeInput = document.getElementById("start-time-input");
const endTimeInput = document.getElementById("end-time-input");
const trimDuration = document.getElementById("trim-duration");
const timeStartLabel = document.getElementById("time-start-label");
const timeEndLabel = document.getElementById("time-end-label");
const trimBtn = document.getElementById("trim-btn");

let videoDuration = 0;
let trimStart = 0;
let trimEnd = 0;
let isDragging = null; // 'start' | 'end'
let currentVideoFile = null; // ffmpeg.wasm에 넘길 원본 File 객체
let ffmpegInst = null;
let ffmpegReady = false;

// 크롭 상태 (위치/크기는 비디오 표시 영역의 분율로 저장 → 창 리사이즈에 무관)
let cropEnabled = false;
let cropBox = { xFrac: 0, yFrac: 0, sizeFrac: 1 };
let cropDragMode = null; // null | 'move' | 'resize'
let cropDragStart = { x: 0, y: 0, box: null };

// 드래그 앤 드롭 업로드
uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("drag-over");
});
uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("drag-over"));
uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("video/")) loadVideoFile(file);
});

videoFile.addEventListener("change", () => {
  if (videoFile.files[0]) loadVideoFile(videoFile.files[0]);
});

function loadVideoFile(file) {
  currentVideoFile = file;
  const url = URL.createObjectURL(file);
  previewVideo.src = url;
  previewVideo.classList.remove("hidden");
  uploadArea.style.display = "none";

  previewVideo.onloadedmetadata = () => {
    videoDuration = previewVideo.duration;
    trimStart = 0;
    trimEnd = videoDuration;
    updateTimeline();
    timelineWrap.classList.remove("hidden");
    trimmerEmpty.style.display = "none";
    startTimeInput.max = videoDuration;
    endTimeInput.max = videoDuration;
    startTimeInput.value = "0";
    endTimeInput.value = videoDuration.toFixed(1);
    if (cropEnabled) initCropBox(); // 새 영상 로드 시 크롭 박스 재초기화
  };
}

function updateTimeline() {
  if (videoDuration <= 0) return;
  const startPct = (trimStart / videoDuration) * 100;
  const endPct = (trimEnd / videoDuration) * 100;

  handleStart.style.left = `${startPct}%`;
  handleEnd.style.left = `${endPct}%`;
  timelineSelected.style.left = `${startPct}%`;
  timelineSelected.style.width = `${endPct - startPct}%`;

  timeStartLabel.textContent = formatTime(trimStart);
  timeEndLabel.textContent = formatTime(trimEnd);
  startTimeInput.value = trimStart.toFixed(1);
  endTimeInput.value = trimEnd.toFixed(1);
  trimDuration.textContent = (trimEnd - trimStart).toFixed(1) + "초";
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ══════════════════════════════════════════════════════
   1:1 크롭 오버레이
══════════════════════════════════════════════════════ */
const cropOverlay = document.getElementById("crop-overlay");
const cropBoxEl = document.getElementById("crop-box");
const cropResizeHandle = document.getElementById("crop-resize-handle");
const cropToggleBtn = document.getElementById("crop-toggle-btn");
const cropInfoText = document.getElementById("crop-info-text");

// 비디오 표시 영역 계산 (letterbox/pillarbox 오프셋 포함)
function getVideoRect() {
  const vid = previewVideo;
  const W = vid.clientWidth;
  const H = vid.clientHeight;
  const vW = vid.videoWidth || W;
  const vH = vid.videoHeight || H;
  const vidAspect = vW / vH;
  const elemAspect = W / H;
  let dw, dh, ox, oy;
  if (vidAspect > elemAspect) {
    dw = W; dh = W / vidAspect; ox = 0; oy = (H - dh) / 2;
  } else {
    dh = H; dw = H * vidAspect; ox = (W - dw) / 2; oy = 0;
  }
  return { dw, dh, ox, oy, vw: vW, vh: vH };
}

// 크롭 박스 기본값: 중앙 최대 정사각형
function initCropBox() {
  const { dw, dh } = getVideoRect();
  const minDim = Math.min(dw, dh);
  cropBox.sizeFrac = 1.0;
  cropBox.xFrac = (dw - minDim) / 2 / dw;
  cropBox.yFrac = (dh - minDim) / 2 / dh;
  renderCropBox();
}

// 분율 → 픽셀 변환 후 DOM 반영 + 정보 업데이트
function renderCropBox() {
  if (!cropEnabled) return;
  const { dw, dh, ox, oy, vw } = getVideoRect();
  const minDim = Math.min(dw, dh);
  const sizePx = cropBox.sizeFrac * minDim;
  const xPx = cropBox.xFrac * dw;
  const yPx = cropBox.yFrac * dh;
  cropBoxEl.style.left = (ox + xPx) + "px";
  cropBoxEl.style.top  = (oy + yPx) + "px";
  cropBoxEl.style.width = cropBoxEl.style.height = sizePx + "px";
  const pixelSize = Math.round(sizePx / dw * vw);
  cropInfoText.textContent = `${pixelSize} × ${pixelSize}`;
}

// 토글
cropToggleBtn.addEventListener("click", () => {
  cropEnabled = !cropEnabled;
  if (cropEnabled) {
    initCropBox();
    cropOverlay.classList.remove("hidden");
    cropToggleBtn.textContent = "크롭 해제";
    cropToggleBtn.style.borderColor = "var(--accent)";
    cropToggleBtn.style.color = "var(--accent)";
  } else {
    cropOverlay.classList.add("hidden");
    cropToggleBtn.textContent = "크롭 적용";
    cropToggleBtn.style.borderColor = "";
    cropToggleBtn.style.color = "";
    cropInfoText.textContent = "";
  }
});

// 이동: 크롭 박스 드래그
cropBoxEl.addEventListener("mousedown", (e) => {
  if (e.target === cropResizeHandle) return;
  e.preventDefault();
  cropDragMode = "move";
  cropDragStart = { x: e.clientX, y: e.clientY, box: { ...cropBox } };
});

// 리사이즈: SE 핸들 드래그
cropResizeHandle.addEventListener("mousedown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  cropDragMode = "resize";
  cropDragStart = { x: e.clientX, y: e.clientY, box: { ...cropBox } };
});

document.addEventListener("mousemove", (e) => {
  if (!cropDragMode) return;
  const { dw, dh } = getVideoRect();
  const minDim = Math.min(dw, dh);
  const dx = e.clientX - cropDragStart.x;
  const dy = e.clientY - cropDragStart.y;

  if (cropDragMode === "move") {
    const sizePx = cropDragStart.box.sizeFrac * minDim;
    let xPx = cropDragStart.box.xFrac * dw + dx;
    let yPx = cropDragStart.box.yFrac * dh + dy;
    xPx = Math.max(0, Math.min(dw - sizePx, xPx));
    yPx = Math.max(0, Math.min(dh - sizePx, yPx));
    cropBox.xFrac = xPx / dw;
    cropBox.yFrac = yPx / dh;
  } else {
    // 대각 방향 평균으로 1:1 유지하며 리사이즈
    const delta = (dx + dy) / 2;
    const maxFrac = Math.min(
      (dw - cropDragStart.box.xFrac * dw) / minDim,
      (dh - cropDragStart.box.yFrac * dh) / minDim,
      1.0
    );
    const newFrac = cropDragStart.box.sizeFrac + delta / minDim;
    cropBox.sizeFrac = Math.max(30 / minDim, Math.min(maxFrac, newFrac));
  }
  renderCropBox();
});

document.addEventListener("mouseup", () => { cropDragMode = null; });

// 창 크기 변경 시 픽셀 좌표 재계산 (분율 기반이라 자동 적응)
window.addEventListener("resize", () => { if (cropEnabled) renderCropBox(); });

/* ── 핸들 드래그 ── */
[handleStart, handleEnd].forEach((handle) => {
  handle.addEventListener("mousedown", (e) => {
    isDragging = handle === handleStart ? "start" : "end";
    e.preventDefault();
  });
});

document.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const rect = timelineBar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const t = ratio * videoDuration;

  if (isDragging === "start") {
    trimStart = Math.min(t, trimEnd - 0.1);
  } else {
    trimEnd = Math.max(t, trimStart + 0.1);
  }
  updateTimeline();
});

document.addEventListener("mouseup", () => { isDragging = null; });

/* ── 숫자 입력 동기화 ── */
startTimeInput.addEventListener("change", () => {
  trimStart = Math.max(0, Math.min(parseFloat(startTimeInput.value) || 0, trimEnd - 0.1));
  updateTimeline();
});
endTimeInput.addEventListener("change", () => {
  trimEnd = Math.min(videoDuration, Math.max(parseFloat(endTimeInput.value) || videoDuration, trimStart + 0.1));
  updateTimeline();
});

/* ── 크롭 박스 → ffmpeg crop 필터 문자열 ── */
function buildCropFilter() {
  if (!cropEnabled) return null;
  const { dw, dh, vw, vh } = getVideoRect();
  const minDim = Math.min(dw, dh);
  const sizePx  = cropBox.sizeFrac * minDim;
  const xPx     = cropBox.xFrac * dw;
  const yPx     = cropBox.yFrac * dh;

  // 표시 좌표 → 실제 영상 픽셀 변환
  const scaleX = vw / dw;
  const scaleY = vh / dh;
  const rawSize = Math.min(Math.round(sizePx * scaleX), Math.round(sizePx * scaleY));
  const size = rawSize % 2 === 0 ? rawSize : rawSize - 1; // h264는 짝수 필요
  const cropX = Math.max(0, Math.min(vw - size, Math.round(xPx * scaleX)));
  const cropY = Math.max(0, Math.min(vh - size, Math.round(yPx * scaleY)));

  return `crop=${size}:${size}:${cropX}:${cropY}`;
}

/* ── ffmpeg.wasm 로딩 (최초 1회 캐싱, 로컬 번들 사용) ── */
async function ensureFfmpeg(progressEl) {
  if (ffmpegReady && ffmpegInst) return ffmpegInst;

  if (!window.FFmpegWASM) {
    throw new Error("ffmpeg.js 파일을 찾을 수 없습니다.");
  }
  if (!window.FFmpegUtil) {
    throw new Error("ffmpeg-util.js 파일을 찾을 수 없습니다.");
  }

  ffmpegInst = new FFmpegWASM.FFmpeg();
  progressEl.textContent = "FFmpeg 초기화 중... (최초 1회, 잠시 기다려주세요)";

  try {
    // chrome.runtime.getURL → chrome-extension://[id]/파일명 직접 전달
    // blob URL 거치지 않고 extension origin URL을 그대로 넘겨야
    // Worker 내부 importScripts()가 CSP 'self' 정책을 통과함
    await ffmpegInst.load({
      coreURL: chrome.runtime.getURL("ffmpeg-core.js"),
      wasmURL: chrome.runtime.getURL("ffmpeg-core.wasm"),
    });
  } catch (e) {
    ffmpegInst = null;
    // Worker는 에러를 문자열로 전파하므로 e.message 대신 String(e) 사용
    throw new Error("FFmpeg 초기화 실패: " + String(e));
  }

  ffmpegReady = true;
  return ffmpegInst;
}

/* ── 자르기 실행 ── */
trimBtn.addEventListener("click", trimVideo);

async function trimVideo() {
  const trimLoading = document.getElementById("trim-loading");
  const trimError = document.getElementById("trim-error");
  const trimProgress = document.getElementById("trim-progress");
  const quality = document.getElementById("trim-quality").value;

  if (!currentVideoFile) {
    alert("영상 파일을 먼저 불러와주세요.");
    return;
  }

  const segDuration = trimEnd - trimStart;
  if (segDuration <= 0) {
    alert("구간을 올바르게 선택해주세요.");
    return;
  }

  trimBtn.disabled = true;
  trimError.classList.add("hidden");
  trimLoading.classList.remove("hidden");
  trimProgress.textContent = "준비 중...";

  // 진행률 핸들러 (스코프에서 segDuration 캡처)
  function onProgress({ progress }) {
    if (progress > 0 && progress <= 1) {
      trimProgress.textContent = `인코딩 중... ${Math.round(progress * 100)}%`;
    }
  }
  function onLog({ message }) {
    // ffmpeg 로그에서 time= 파싱으로 진행률 계산
    const m = message.match(/time=(\d+):(\d+):(\d+\.\d+)/);
    if (m) {
      const secs = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
      const pct = Math.min(99, Math.round((secs / segDuration) * 100));
      trimProgress.textContent = `인코딩 중... ${pct}%`;
    }
  }

  try {
    const ffmpeg = await ensureFfmpeg(trimProgress);
    ffmpeg.on("progress", onProgress);
    ffmpeg.on("log", onLog);

    // 품질별 CRF + 해상도 상한 (min()으로 원본보다 크게 업스케일 안 함)
    const QUALITY = {
      high:   { crf: "26", maxH: 1080 },
      medium: { crf: "30", maxH: 720  },
      low:    { crf: "34", maxH: 480  },
    };
    const { crf, maxH } = QUALITY[quality] || QUALITY.medium;

    // crop 필터 (활성화된 경우) + scale 필터 결합
    const cropFilter = buildCropFilter();
    const vf = cropFilter
      ? `${cropFilter},scale=-2:min(${maxH}\\,ih)`
      : `scale=-2:min(${maxH}\\,ih)`;

    const inputExt = (currentVideoFile.name.split(".").pop() || "mp4").toLowerCase();
    const inputName = `input.${inputExt}`;

    trimProgress.textContent = "파일 읽는 중...";
    await ffmpeg.writeFile(inputName, await FFmpegUtil.fetchFile(currentVideoFile));

    trimProgress.textContent = "인코딩 시작...";
    await ffmpeg.exec([
      "-ss", trimStart.toFixed(3),
      "-i", inputName,
      "-t", segDuration.toFixed(3),
      "-vf", vf,
      "-c:v", "libx264",
      "-crf", crf,
      "-preset", "ultrafast",
      "-an",
      "-movflags", "+faststart",
      "output.mp4",
    ]);

    trimProgress.textContent = "파일 저장 중...";
    const data = await ffmpeg.readFile("output.mp4");
    const blob = new Blob([data.buffer], { type: "video/mp4" });
    downloadBlob(blob, "trimmed.mp4");

    // WASM 가상 파일시스템 정리
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile("output.mp4").catch(() => {});
  } catch (err) {
    trimError.textContent = "자르기 실패: " + (err.message || "알 수 없는 오류");
    trimError.classList.remove("hidden");
  } finally {
    trimBtn.disabled = false;
    trimLoading.classList.add("hidden");
    if (ffmpegInst) {
      ffmpegInst.off("progress", onProgress);
      ffmpegInst.off("log", onLog);
    }
  }
}

/* ══════════════════════════════════════════════════════
   공통 유틸
══════════════════════════════════════════════════════ */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
