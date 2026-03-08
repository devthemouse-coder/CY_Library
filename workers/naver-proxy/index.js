/**
 * Cloudflare Worker — Naver Book Search API 프록시
 *
 * 브라우저는 CORS 제약으로 Naver API를 직접 호출할 수 없으므로,
 * 이 Worker가 서버사이드에서 대신 호출하고 CORS 헤더를 붙여 반환합니다.
 *
 * 지원 경로:
 *   GET /book?query=...          → Naver book.json  (제목 검색)
 *   GET /book_adv?d_isbn=...     → Naver book_adv.json (ISBN 검색)
 *
 * 환경변수 (wrangler secret put 으로 등록):
 *   NAVER_CLIENT_ID
 *   NAVER_CLIENT_SECRET
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const NAVER_ENDPOINTS = {
  book:     'https://openapi.naver.com/v1/search/book.json',
  book_adv: 'https://openapi.naver.com/v1/search/book_adv.json',
};

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, '').split('/')[0]; // 'book' or 'book_adv'

    const naverBase = NAVER_ENDPOINTS[path];
    if (!naverBase) {
      return new Response(JSON.stringify({ error: `Unknown endpoint: ${path}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // 쿼리 파라미터 그대로 Naver 에 전달
    const naverUrl = new URL(naverBase);
    url.searchParams.forEach((v, k) => naverUrl.searchParams.set(k, v));

    try {
      const naverRes = await fetch(naverUrl.toString(), {
        headers: {
          'X-Naver-Client-Id':     env.NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET,
        },
      });

      const body = await naverRes.arrayBuffer();
      return new Response(body, {
        status: naverRes.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...CORS_HEADERS,
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  },
};
