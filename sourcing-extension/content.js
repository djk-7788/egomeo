(function () {

  // ─── 이미지 URL 원본 해상도로 변환 (알리 전용) ──────────────
  // 패턴 1: "file.jpg_50x50.jpg"  → "file.jpg"  (확장자 중복형)
  // 패턴 2: "file_50x50.jpg"      → "file.jpg"  (단순 크기 접미사형)
  // 패턴 3: "file_960x960q80.jpg" → "file.jpg"  (품질 접미사 포함형)
  function upgradeAliRes(src) {
    src = src.replace(/(\.\w+)_\d+x\d+[a-z0-9]*\.\w+$/, '$1'); // 패턴 1
    src = src.replace(/_\d+x\d+[a-z0-9]*(\.\w+)$/, '$1');       // 패턴 2·3
    return src;
  }

  // ─── 알리익스프레스 — 갤러리 이미지 전체 파싱 ─────────────────
  function parseAliExpressImages() {
    const seen = new Map(); // dedup key → hq URL

    // 방법 1: 썸네일 리스트 컨테이너 (class에 "images--item" 포함)
    const gallerySelectors = [
      '[class*="images--item"]',
      '[class*="slider--item"]',
      '[class*="image--item"]',
      '.pdp-mod-common-image',
    ];

    for (const sel of gallerySelectors) {
      const containers = document.querySelectorAll(sel);
      if (containers.length < 2) continue; // 1개면 썸네일 영역 아닐 가능성

      containers.forEach((el) => {
        const img = el.querySelector('img') || (el.tagName === 'IMG' ? el : null);
        if (!img) return;
        let src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy') || '';
        if (src.startsWith('//')) src = 'https:' + src;
        if (!src || src.includes('1x1') || src.includes('placeholder') || src.includes('gif')) return;
        const hq = upgradeAliRes(src);
        if (!seen.has(hq)) seen.set(hq, hq);
      });

      if (seen.size > 1) break; // 여러 장 있으면 OK
    }

    // 방법 2: 메인 슬라이더 단일 이미지
    if (seen.size === 0) {
      const mainSelectors = [
        '[class*="slider--img"]',
        '[class*="main-image"] img',
        '[class*="image--wrap"] img',
      ];
      for (const sel of mainSelectors) {
        const img = document.querySelector(sel);
        let src = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
        if (src.startsWith('//')) src = 'https:' + src;
        if (src && !src.includes('1x1')) {
          seen.set(src, upgradeAliRes(src));
          break;
        }
      }
    }

    // OG 이미지 폴백
    if (seen.size === 0) {
      const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (og) seen.set(og, og);
    }

    return Array.from(seen.values()).slice(0, 12);
  }

  // ─── 쿠팡 — 갤러리 이미지 전체 파싱 ──────────────────────────
  function parseCoupangImages() {
    const found = new Set();

    const selectors = [
      '#carousel_vertical_target img',
      '#repImageContainer img',
      '.prod-image__detail img',
      '[class*="prod-img"] img',
    ];

    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((img) => {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
        if (src && src.startsWith('http') && !src.includes('1x1')) found.add(src);
      });
      if (found.size > 0) break;
    }

    // OG 폴백
    if (found.size === 0) {
      const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (og) found.add(og);
    }

    return Array.from(found).slice(0, 12);
  }

  // ─── 알리익스프레스 상품 정보 파싱 ────────────────────────────
  function parseAliExpress() {
    const ogTitle =
      document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    const title =
      document.querySelector('h1[data-pl="product-title"]')?.textContent?.trim() ||
      document.querySelector('[class*="title--wrap"] h1')?.textContent?.trim() ||
      document.querySelector('[class*="product-title"]')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      ogTitle;

    const images = parseAliExpressImages();
    return { title: title.trim(), images, imageUrl: images[0] || '' };
  }

  // ─── 쿠팡 상품 정보 파싱 ──────────────────────────────────────
  function parseCoupang() {
    const ogTitle =
      document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';

    const title =
      document.querySelector('h2.prod-buy-header__title')?.textContent?.trim() ||
      document.querySelector('.prod-buy-header__title')?.textContent?.trim() ||
      document.querySelector('[class*="prod-title"]')?.textContent?.trim() ||
      ogTitle;

    const images = parseCoupangImages();
    return { title: title.trim(), images, imageUrl: images[0] || '' };
  }

  // ─── 메시지 수신 ──────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action !== 'parseProduct') return;

    const url = window.location.href;
    let data;
    if (url.includes('aliexpress.com')) {
      data = parseAliExpress();
    } else if (url.includes('coupang.com')) {
      data = parseCoupang();
    } else {
      data = { title: '', images: [], imageUrl: '' };
    }

    sendResponse({ ...data, productUrl: url });
    return true;
  });
})();
