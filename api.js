const GOOGLE_BOOKS_ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY_SEARCH_ENDPOINT = 'https://openlibrary.org/search.json';
const OPEN_LIBRARY_WORKS_BASE = 'https://openlibrary.org';

let googleBooksQuotaExceeded = false;

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

function mapGoogleItem(item) {
  const info = item?.volumeInfo || {};
  return {
    source: 'google-books',
    sourceId: item?.id || '',
    title: info?.title || '',
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
    .replace(/\s+/g, ' ')
    .trim();
}

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
 * @returns {Promise<Array<{source:string,sourceId:string,title:string,authors:string,publishedDate:string,isbn:string,thumbnail:string}>>}
 */
export async function searchBooks(query) {
  const q = String(query || '').trim();
  if (!q) return [];

  const isbn = normalizeIsbn(q);
  const googleQ = isbn ? `isbn:${isbn}` : q;

  const url = new URL(GOOGLE_BOOKS_ENDPOINT);
  url.searchParams.set('q', googleQ);
  url.searchParams.set('maxResults', '10');

  // 이미 429를 한 번 맞은 세션이면 Google Books 재시도 대신 Open Library로 바로 폴백
  if (googleBooksQuotaExceeded) {
    const olUrl = new URL(OPEN_LIBRARY_SEARCH_ENDPOINT);
    olUrl.searchParams.set('q', googleQ);
    olUrl.searchParams.set('limit', '10');

    const olRes = await fetch(olUrl.toString());
    if (!olRes.ok) throw new Error('BOOKS_QUOTA');
    const olData = await olRes.json().catch(() => null);
    const docs = Array.isArray(olData?.docs) ? olData.docs : [];
    return docs.map(mapOpenLibraryDoc).filter((x) => x.title);
  }

  const res = await fetch(url.toString());

  // Google Books 쿼터 초과 시(Open API 무키 방식에서 종종 발생) Open Library로 폴백
  if (res.status === 429) {
    googleBooksQuotaExceeded = true;
    const olUrl = new URL(OPEN_LIBRARY_SEARCH_ENDPOINT);
    olUrl.searchParams.set('q', googleQ);
    olUrl.searchParams.set('limit', '10');

    const olRes = await fetch(olUrl.toString());
    if (!olRes.ok) throw new Error('BOOKS_QUOTA');
    const olData = await olRes.json().catch(() => null);
    const docs = Array.isArray(olData?.docs) ? olData.docs : [];
    return docs.map(mapOpenLibraryDoc).filter((x) => x.title);
  }

  if (!res.ok) return [];

  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map(mapGoogleItem).filter((x) => x.title);
}

/**
 * @param {string} isbn
 * @returns {Promise<ReturnType<typeof mapGoogleItem> | null>}
 */
export async function lookupByIsbn(isbn) {
  const clean = normalizeIsbn(isbn);
  if (!clean) return null;

  const results = await searchBooks(clean);
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
    // Google Books가 실패해도 Open Library 쪽 정보가 있으면 보여주기
    const fallback = await fetchOpenLibraryExtra({ isbn, title, authors });
    return fallback;
  }

  const data = await res.json();
  const item = Array.isArray(data?.items) ? data.items[0] : null;
  if (!item) return null;

  return mapGoogleExtra(item);
}
