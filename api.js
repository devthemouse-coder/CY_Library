const GOOGLE_BOOKS_ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY_SEARCH_ENDPOINT = 'https://openlibrary.org/search.json';
const OPEN_LIBRARY_WORKS_BASE = 'https://openlibrary.org';
const NAVER_BOOK_ENDPOINT = 'https://openapi.naver.com/v1/search/book.json';
const NAVER_BOOK_ADV_ENDPOINT = 'https://openapi.naver.com/v1/search/book_adv.json';

let googleBooksQuotaExceeded = false;

// ─── 네이버 API 자격증명 ───────────────────────────────────────
// 키는 config.js 에서 읽습니다 (config.js 는 .gitignore 등록 — GitHub에 올라가지 않음)
// config.example.js 를 복사해 config.js 로 만들고 키를 입력하세요.
let _configNaverId = '';
let _configNaverSecret = '';
let _configNaverProxyUrl = '';
try {
  const cfg = await import('./config.js');
  _configNaverId = String(cfg.NAVER_CLIENT_ID || '').trim();
  _configNaverSecret = String(cfg.NAVER_CLIENT_SECRET || '').trim();
  _configNaverProxyUrl = String(cfg.NAVER_PROXY_URL || '').trim();
} catch {
  // config.js 없음 — 사용자가 UI에서 직접 입력해야 합니다.
}

export function getNaverCredentials() {
  // 1순위: 사용자가 UI에서 직접 입력한 값 (localStorage)
  const id = localStorage.getItem('bcy_naver_id');
  const secret = localStorage.getItem('bcy_naver_secret');
  if (id && secret) return { id, secret, isCustom: true };
  // 2순위: config.js 에 설정된 값
  if (_configNaverId && _configNaverSecret) return { id: _configNaverId, secret: _configNaverSecret, isCustom: false };
  return null;
}

export function getNaverCredentialsCustom() {
  const id = localStorage.getItem('bcy_naver_id');
  const secret = localStorage.getItem('bcy_naver_secret');
  return id && secret ? { id, secret } : null;
}

export function saveNaverCredentials(id, secret) {
  localStorage.setItem('bcy_naver_id', String(id || '').trim());
  localStorage.setItem('bcy_naver_secret', String(secret || '').trim());
}

export function clearNaverCredentials() {
  localStorage.removeItem('bcy_naver_id');
  localStorage.removeItem('bcy_naver_secret');
}

/** Cloudflare Worker 프록시 URL. 설정된 경우 직접 호출 대신 Worker 를 경유합니다. */
export function getNaverProxyUrl() {
  return localStorage.getItem('bcy_naver_proxy_url') || _configNaverProxyUrl || '';
}

/**
 * 네이버 API 호출 헬퍼 — proxyUrl 이 있으면 Worker 경유(CORS 불필요), 없으면 직접 호출.
 * @param {'book'|'book_adv'} path
 * @param {Record<string,string|number>} params
 * @param {{id:string,secret:string}|null} creds  프록시 사용 시 null 가능
 */
async function naverApiFetch(path, params, creds) {
  const proxyUrl = getNaverProxyUrl();
  let url;
  const fetchHeaders = {};

  if (proxyUrl) {
    // Worker 경유: 자격증명은 Worker 환경변수로 처리 — 브라우저 요청엔 불필요
    url = new URL(`${proxyUrl.replace(/\/+$/, '')}/${path}`);
  } else if (creds) {
    url = new URL(path === 'book_adv' ? NAVER_BOOK_ADV_ENDPOINT : NAVER_BOOK_ENDPOINT);
    fetchHeaders['X-Naver-Client-Id'] = creds.id;
    fetchHeaders['X-Naver-Client-Secret'] = creds.secret;
  } else {
    return null;
  }

  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), { headers: fetchHeaders });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}
// ─────────────────────────────────────────────────────────────

function normalizeIsbn(raw) {
  const cleaned = String(raw || '').replace(/[^0-9Xx]/g, '').toUpperCase();
  if (cleaned.length === 10 || cleaned.length === 13) return cleaned;
  return '';
}

function pickIsbn13(industryIdentifiers) {
  if (!Array.isArray(industryIdentifiers)) return '';
  const isbn13 = industryIdentifiers.find((x) => x?.type === 'ISBN_13')?.identifier;
  return normalizeIsbn(isbn13);
}

function pickOlIsbn13(isbnList) {
  if (!Array.isArray(isbnList)) return '';
  // 우선 13자리(978/979) 선호
  const first13 = isbnList.map(normalizeIsbn).find((x) => x && x.length === 13);
  if (first13) return first13;
  const any = isbnList.map(normalizeIsbn).find(Boolean);
  return any || '';
}

function mergeGoogleTitle(title, subtitle) {
  const t = String(title || '').trim();
  const s = String(subtitle || '').trim();
  if (!s) return t;
  // subtitle 앞부분이 권수 패턴(숫자, Vol., 권)으로 시작하면 title에 합침
  if (/^(\d+|Vol\.?\s*\d+|제?\d+권)/i.test(s)) {
    const volMatch = s.match(/^(\S+)/);
    return volMatch ? `${t} ${volMatch[1]}` : t;
  }
  return t;
}

function mapGoogleItem(item) {
  const info = item?.volumeInfo || {};
  return {
    source: 'google-books',
    sourceId: item?.id || '',
    title: mergeGoogleTitle(info?.title, info?.subtitle),
    authors: Array.isArray(info?.authors) ? info.authors.join(', ') : '',
    publishedDate: info?.publishedDate || '',
    isbn: pickIsbn13(info?.industryIdentifiers),
    thumbnail: info?.imageLinks?.thumbnail || ''
  };
}

function mapOpenLibraryDoc(doc) {
  const title = String(doc?.title || '').trim();
  const authors = Array.isArray(doc?.author_name) ? doc.author_name.join(', ') : '';
  const publishedDate = doc?.first_publish_year ? String(doc.first_publish_year) : '';
  const isbn = pickOlIsbn13(doc?.isbn);

  let thumbnail = '';
  const coverId = doc?.cover_i;
  if (coverId) thumbnail = `https://covers.openlibrary.org/b/id/${encodeURIComponent(coverId)}-S.jpg`;
  else if (isbn) thumbnail = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-S.jpg`;

  return {
    source: 'openlibrary',
    sourceId: String(doc?.key || ''),
    title,
    authors,
    publishedDate,
    isbn,
    thumbnail
  };
}

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// 연속으로 중복된 토큰 제거: "마법천자문 58 58 (...)" → "마법천자문 58 (...)"
function dedupTokens(title) {
  return title.replace(/(\S+)( \1)+/g, '$1');
}

// ─── 네이버 API 헬퍼 ───────────────────────────────────────────
function extractNaverIsbn(isbnField) {
  const parts = String(isbnField || '').split(/\s+/).map(normalizeIsbn).filter(Boolean);
  return parts.find((x) => x.length === 13) || parts[0] || '';
}

function naverPubdate(pubdate) {
  const p = String(pubdate || '');
  return p.length === 8 ? `${p.slice(0, 4)}-${p.slice(4, 6)}-${p.slice(6, 8)}` : p;
}

function mapNaverItem(item) {
  return {
    source: 'naver',
    sourceId: String(item?.link || item?.isbn || '').slice(0, 200),
    title: dedupTokens(stripHtml(item?.title || '')),
    authors: stripHtml(item?.author || '')
      .replace(/\^/g, ', ')
      .replace(/,\s*,/g, ',')
      .trim(),
    publishedDate: naverPubdate(item?.pubdate),
    isbn: extractNaverIsbn(item?.isbn),
    thumbnail: item?.image || ''
  };
}

/** @param {{isbn?:string,title?:string,authors?:string}} query @param {{id:string,secret:string}|null} creds */
async function fetchNaverExtra(query, creds) {
  const isbn = normalizeIsbn(query?.isbn || '');
  const title = String(query?.title || '').trim();

  let data;
  if (isbn) {
    data = await naverApiFetch('book_adv', { d_isbn: isbn }, creds);
  } else {
    const q = [title, String(query?.authors || '').trim()].filter(Boolean).join(' ');
    if (!q) return null;
    data = await naverApiFetch('book', { query: q, display: '1' }, creds);
  }
  if (!data) return null;

  const item = Array.isArray(data?.items) ? data.items[0] : null;
  if (!item) return null;

  return {
    title: dedupTokens(stripHtml(item.title || '')),
    authors: stripHtml(item.author || '').replace(/\^/g, ', ').replace(/,\s*,/g, ',').trim(),
    publishedDate: naverPubdate(item.pubdate),
    publisher: stripHtml(item.publisher || ''),
    pageCount: null,
    categories: [],
    description: stripHtml(item.description || '')
  };
}

/** @param {string} q @param {{id:string,secret:string}|null} creds @param {number} page */
async function naverSearch(q, creds, page = 0) {
  const isbn = normalizeIsbn(q);
  const PAGE_SIZE = 100;
  const start = page * PAGE_SIZE + 1;
  const data = isbn
    ? await naverApiFetch('book_adv', { d_isbn: isbn }, creds)
    : await naverApiFetch('book', { query: q, display: String(PAGE_SIZE), start: String(start) }, creds);
  if (!data) return { results: [], hasMore: false };
  const items = Array.isArray(data?.items) ? data.items : [];
  const results = items.map(mapNaverItem).filter((x) => x.title);
  const total = Number(data.total) || 0;
  const hasMore = !isbn && results.length > 0 && total > start + results.length - 1;
  return { results, hasMore };
}
// ─────────────────────────────────────────────────────────────

function mapGoogleExtra(item) {
  const info = item?.volumeInfo || {};
  return {
    title: info?.title || '',
    authors: Array.isArray(info?.authors) ? info.authors.join(', ') : '',
    publishedDate: info?.publishedDate || '',
    publisher: info?.publisher || '',
    pageCount: Number.isFinite(info?.pageCount) ? info.pageCount : null,
    categories: Array.isArray(info?.categories) ? info.categories : [],
    description: stripHtml(info?.description || '')
  };
}

function normalizeOlDescription(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return String(raw).trim();
  if (typeof raw === 'object' && typeof raw.value === 'string') return String(raw.value).trim();
  return '';
}

/**
 * @param {{isbn?: string, title?: string, authors?: string}} input
 * @returns {Promise<{title:string,authors:string,publishedDate:string,publisher:string,pageCount:number|null,categories:string[],description:string} | null>}
 */
async function fetchOpenLibraryExtra(input) {
  const isbn = normalizeIsbn(input?.isbn || '');
  const title = String(input?.title || '').trim();
  const authors = String(input?.authors || '').trim();

  const qParts = [];
  if (isbn) qParts.push(`isbn:${isbn}`);
  else {
    if (title) qParts.push(title);
    if (authors) qParts.push(authors);
  }
  if (qParts.length === 0) return null;

  const olUrl = new URL(OPEN_LIBRARY_SEARCH_ENDPOINT);
  olUrl.searchParams.set('q', qParts.join(' '));
  olUrl.searchParams.set('limit', '1');

  const olRes = await fetch(olUrl.toString());
  if (!olRes.ok) return null;
  const olData = await olRes.json().catch(() => null);
  const doc = Array.isArray(olData?.docs) ? olData.docs[0] : null;
  if (!doc) return null;

  let description = '';
  const workKey = typeof doc?.key === 'string' ? doc.key : '';
  if (workKey) {
    try {
      const workUrl = new URL(`${workKey}.json`, OPEN_LIBRARY_WORKS_BASE);
      const workRes = await fetch(workUrl.toString());
      if (workRes.ok) {
        const work = await workRes.json().catch(() => null);
        description = normalizeOlDescription(work?.description);
      }
    } catch {
      // ignore
    }
  }

  const publisher = Array.isArray(doc?.publisher) ? String(doc.publisher[0] || '') : '';
  const publishedDate = doc?.first_publish_year ? String(doc.first_publish_year) : '';
  const pageCount = Number.isFinite(doc?.number_of_pages_median) ? doc.number_of_pages_median : null;
  const categories = Array.isArray(doc?.subject) ? doc.subject : [];

  return {
    title: String(doc?.title || '').trim(),
    authors: Array.isArray(doc?.author_name) ? doc.author_name.join(', ') : '',
    publishedDate,
    publisher,
    pageCount,
    categories,
    description: stripHtml(description)
  };
}

/**
 * @param {string} query
 * @param {number} page  0-based 페이지 번호
 * @returns {Promise<{results: Array, hasMore: boolean}>}
 */
export async function searchBooks(query, page = 0) {
  const q = String(query || '').trim();
  if (!q) return { results: [], hasMore: false };

  // 1순위: 네이버 API (Worker 프록시 또는 자격증명이 설정된 경우)
  const _naverProxy = getNaverProxyUrl();
  const _naverCreds = _naverProxy ? null : getNaverCredentials();
  if (_naverProxy || _naverCreds) {
    try {
      const { results: naverResults, hasMore } = await naverSearch(q, _naverCreds, page);
      if (naverResults && naverResults.length > 0) return { results: naverResults, hasMore };
      if (page > 0) return { results: [], hasMore: false };
    } catch (e) {
      console.warn('[Naver API] 검색 실패, Google Books로 폴백:', e?.message ?? e);
    }
  }

  // 2순위: Google Books → 3순위: Open Library
  const isbn = normalizeIsbn(q);
  const googleQ = isbn ? `isbn:${isbn}` : q;

  const GB_PAGE_SIZE = 40;
  const startIndex = page * GB_PAGE_SIZE;
  const OL_PAGE_SIZE = 100;
  const olOffset = page * OL_PAGE_SIZE;

  const url = new URL(GOOGLE_BOOKS_ENDPOINT);
  url.searchParams.set('q', googleQ);
  url.searchParams.set('maxResults', String(GB_PAGE_SIZE));
  url.searchParams.set('startIndex', String(startIndex));

  // 이미 429를 한 번 맞은 세션이면 Google Books 재시도 대신 Open Library로 바로 폴백
  if (googleBooksQuotaExceeded) {
    const olUrl = new URL(OPEN_LIBRARY_SEARCH_ENDPOINT);
    olUrl.searchParams.set('q', googleQ);
    olUrl.searchParams.set('limit', String(OL_PAGE_SIZE));
    olUrl.searchParams.set('offset', String(olOffset));

    const olRes = await fetch(olUrl.toString());
    if (!olRes.ok) throw new Error('BOOKS_QUOTA');
    const olData = await olRes.json().catch(() => null);
    const docs = Array.isArray(olData?.docs) ? olData.docs : [];
    const results = docs.map(mapOpenLibraryDoc).filter((x) => x.title);
    const numFound = Number(olData?.numFound) || 0;
    return { results, hasMore: olOffset + results.length < numFound };
  }

  const res = await fetch(url.toString());

  // Google Books 쿼터 초과 시 Open Library로 폴백
  if (res.status === 429) {
    googleBooksQuotaExceeded = true;
    const olUrl = new URL(OPEN_LIBRARY_SEARCH_ENDPOINT);
    olUrl.searchParams.set('q', googleQ);
    olUrl.searchParams.set('limit', String(OL_PAGE_SIZE));
    olUrl.searchParams.set('offset', String(olOffset));

    const olRes = await fetch(olUrl.toString());
    if (!olRes.ok) throw new Error('BOOKS_QUOTA');
    const olData = await olRes.json().catch(() => null);
    const docs = Array.isArray(olData?.docs) ? olData.docs : [];
    const results = docs.map(mapOpenLibraryDoc).filter((x) => x.title);
    const numFound = Number(olData?.numFound) || 0;
    return { results, hasMore: olOffset + results.length < numFound };
  }

  if (!res.ok) return { results: [], hasMore: false };

  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  const results = items.map(mapGoogleItem).filter((x) => x.title);
  const totalItems = Number(data?.totalItems) || 0;
  return { results, hasMore: startIndex + results.length < totalItems };
}

/**
 * @param {string} isbn
 * @returns {Promise<ReturnType<typeof mapNaverItem> | ReturnType<typeof mapGoogleItem> | null>}
 */
export async function lookupByIsbn(isbn) {
  const clean = normalizeIsbn(isbn);
  if (!clean) return null;

  // 1순위: 네이버 book_adv (ISBN 전용 엔드포인트)
  const _naverProxy = getNaverProxyUrl();
  const _naverCreds = _naverProxy ? null : getNaverCredentials();
  if (_naverProxy || _naverCreds) {
    try {
      const data = await naverApiFetch('book_adv', { d_isbn: clean }, _naverCreds);
      const items = Array.isArray(data?.items) ? data.items : [];
      const results = items.map(mapNaverItem).filter((x) => x.title);
      if (results.length > 0) return results[0];
    } catch (e) {
      console.warn('[Naver API] ISBN 조회 실패, Google Books로 폴백:', e?.message ?? e);
    }
  }

  const { results } = await searchBooks(clean);
  return results[0] || null;
}

export function tryExtractIsbnFromBarcode(rawValue) {
  const digits = String(rawValue || '').replace(/\D/g, '');
  if (digits.length === 13 && (digits.startsWith('978') || digits.startsWith('979'))) return digits;
  if (digits.length === 10) return digits;
  return '';
}

/**
 * @param {{isbn?: string, title?: string, authors?: string}} input
 * @returns {Promise<{title:string,authors:string,publishedDate:string,publisher:string,pageCount:number|null,categories:string[],description:string} | null>}
 */
export async function fetchBookExtra(input) {
  const isbn = normalizeIsbn(input?.isbn || '');
  const title = String(input?.title || '').trim();
  const authors = String(input?.authors || '').trim();

  // 1순위: 네이버 (Worker 프록시 또는 자격증명)
  const _naverProxy = getNaverProxyUrl();
  const _naverCreds = _naverProxy ? null : getNaverCredentials();
  if (_naverProxy || _naverCreds) {
    try {
      const naverExtra = await fetchNaverExtra({ isbn, title, authors }, _naverCreds);
      if (naverExtra) return naverExtra;
    } catch (e) {
      console.warn('[Naver API] 상세 조회 실패, Google Books로 폴백:', e?.message ?? e);
    }
  }

  // 2순위: Google Books → 3순위: Open Library
  const qParts = [];
  if (isbn) qParts.push(`isbn:${isbn}`);
  else {
    if (title) qParts.push(title);
    if (authors) qParts.push(authors);
  }

  if (qParts.length === 0) return null;

  const url = new URL(GOOGLE_BOOKS_ENDPOINT);
  url.searchParams.set('q', qParts.join(' '));
  url.searchParams.set('maxResults', '1');

  if (googleBooksQuotaExceeded) {
    const fallback = await fetchOpenLibraryExtra({ isbn, title, authors });
    if (fallback) return fallback;
    throw new Error('BOOKS_QUOTA');
  }

  const res = await fetch(url.toString());
  if (res.status === 429) {
    googleBooksQuotaExceeded = true;
    const fallback = await fetchOpenLibraryExtra({ isbn, title, authors });
    if (fallback) return fallback;
    throw new Error('BOOKS_QUOTA');
  }

  if (!res.ok) {
    const fallback = await fetchOpenLibraryExtra({ isbn, title, authors });
    return fallback;
  }

  const data = await res.json();
  const item = Array.isArray(data?.items) ? data.items[0] : null;
  if (!item) return null;

  return mapGoogleExtra(item);
}
