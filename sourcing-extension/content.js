(function () {
  // AliExpress 파싱
  function parseAliExpress() {
    // 제목: OG 태그 → DOM 순으로 시도
    const ogTitle =
      document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    const title =
      document.querySelector('h1[data-pl="product-title"]')?.textContent?.trim() ||
      document.querySelector('[class*="title--wrap"] h1')?.textContent?.trim() ||
      document.querySelector('[class*="product-title"]')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      ogTitle;

    // 가격: 여러 셀렉터 시도
    let price = '';
    const priceSelectors = [
      '[class*="currentPriceText"]',
      '[class*="price--current"]',
      '[class*="sale-price"]',
      '[data-pl="product-price"] [class*="price"]',
      '.product-price-value',
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      const t = el?.textContent?.trim();
      if (t) { price = t; break; }
    }

    // 이미지: 슬라이더 첫 이미지 → OG
    const ogImage =
      document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
    let imageUrl = '';
    const imgSelectors = [
      '[class*="slider--img"]',
      '[class*="images--item"] img',
      '[class*="image--wrap"] img',
      '.pdp-mod-common-image img',
    ];
    for (const sel of imgSelectors) {
      const el = document.querySelector(sel);
      const src = el?.getAttribute('src') || el?.getAttribute('data-src') || '';
      if (src && !src.includes('placeholder') && !src.includes('1x1')) {
        imageUrl = src.startsWith('//') ? 'https:' + src : src;
        break;
      }
    }
    if (!imageUrl) imageUrl = ogImage;

    return { title: title.trim(), price, imageUrl };
  }

  // 쿠팡 파싱
  function parseCoupang() {
    const ogTitle =
      document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    const ogImage =
      document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

    const title =
      document.querySelector('h2.prod-buy-header__title')?.textContent?.trim() ||
      document.querySelector('.prod-buy-header__title')?.textContent?.trim() ||
      document.querySelector('[class*="prod-title"]')?.textContent?.trim() ||
      ogTitle;

    let price = '';
    const priceSelectors = [
      '.total-price strong',
      '.prod-buy-header__price .price-value',
      '[class*="prod-price"] [class*="value"]',
      '[class*="price-area"] strong',
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      const t = el?.textContent?.trim();
      if (t) { price = '₩' + t.replace(/[^0-9,]/g, ''); break; }
    }

    let imageUrl = ogImage;
    const imgSelectors = [
      '#repImageContainer img',
      '.prod-image__detail img',
      '[class*="prod-image"] img',
    ];
    for (const sel of imgSelectors) {
      const el = document.querySelector(sel);
      const src = el?.getAttribute('src') || el?.getAttribute('data-src') || '';
      if (src) { imageUrl = src; break; }
    }

    return { title: title.trim(), price, imageUrl };
  }

  // 메시지 수신 — popup에서 호출
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action !== 'parseProduct') return;

    const url = window.location.href;
    let data;
    if (url.includes('aliexpress.com')) {
      data = parseAliExpress();
    } else if (url.includes('coupang.com')) {
      data = parseCoupang();
    } else {
      data = { title: '', price: '', imageUrl: '' };
    }

    sendResponse({ ...data, productUrl: url });
    return true;
  });
})();
