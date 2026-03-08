// ─────────────────────────────────────────────────────────────
//  API 키 설정 파일 (템플릿)
//
//  사용법:
//    1. 이 파일을 같은 폴더에 "config.js" 이름으로 복사하세요.
//    2. 각 항목의 값을 실제 API 키로 교체하세요.
//    3. config.js 는 .gitignore 에 등록되어 있어 깃에 업로드되지 않습니다.
//
//  ── Gemini AI (책 요약 기능) ──────────────────────────────────
//  Google AI Studio: https://aistudio.google.com/apikey
//  API 키 제한 권장: HTTP referrer → https://내도메인/*
// ─────────────────────────────────────────────────────────────

export const GEMINI_API_KEY = 'PASTE_GEMINI_API_KEY_HERE';

// ── 네이버 Open API (책 검색 기능) ────────────────────────────
// 네이버 개발자 센터: https://developers.naver.com/apps/
// 앱 등록 → 검색 API 활성화 → 서비스 환경 > Web → 현재 도메인 추가
// ─────────────────────────────────────────────────────────────

export const NAVER_CLIENT_ID     = 'PASTE_NAVER_CLIENT_ID_HERE';
export const NAVER_CLIENT_SECRET = 'PASTE_NAVER_CLIENT_SECRET_HERE';

// ── Naver 프록시 (Cloudflare Worker) ────────────────────────
// CORS 제약으로 브라우저에서 Naver API를 직접 호출할 수 없습니다.
// Cloudflare Worker 배포 후 아래 URL 을 입력하세요.
// 배포 방법: cd workers/naver-proxy && npx wrangler deploy
//   (+ wrangler secret put NAVER_CLIENT_ID / NAVER_CLIENT_SECRET)
// 프록시가 설정되면 NAVER_CLIENT_ID/SECRET 은 사용되지 않습니다.
// ──────────────────────────────────────────────────────

export const NAVER_PROXY_URL = 'https://naver-book-proxy.YOUR_SUBDOMAIN.workers.dev';
