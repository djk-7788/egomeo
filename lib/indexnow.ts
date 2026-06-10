const INDEXNOW_KEY = process.env.INDEXNOW_KEY ?? "";
const KEY_LOCATION = `https://www.igemugo.com/${INDEXNOW_KEY}.txt`;
const HOST = "www.igemugo.com";

const ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://searchadvisor.naver.com/indexnow",
];

// fire-and-forget — 실패해도 본 기능을 막지 않음
export function submitToIndexNow(urls: string[]): void {
  if (!INDEXNOW_KEY || urls.length === 0) return;

  const body = JSON.stringify({
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls,
  });

  for (const endpoint of ENDPOINTS) {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body,
    })
      .then((res) => {
        console.log(`[IndexNow] ${endpoint} → ${res.status}`);
      })
      .catch((err) => {
        console.error(`[IndexNow] ${endpoint} 실패:`, err);
      });
  }
}
