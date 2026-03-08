import {
  addBook,
  deleteBook,
  getBook,
  listBooks,
  updateBook,
  insertImportedBook,
  ensureBookGuids
} from './db.js';
import { fetchBookExtra, lookupByIsbn, searchBooks, tryExtractIsbnFromBarcode, getNaverCredentials, getNaverCredentialsCustom, saveNaverCredentials, clearNaverCredentials } from './api.js';
import { summarizeWithGemini } from './ai.js';
import { loadGistSettings, saveGistSettings, clearGistSettings, backupToGist, loadFromGist, verifyToken } from './gist.js';

const els = {
  tabList: /** @type {HTMLButtonElement} */ (document.getElementById('tab-list')),
  tabForm: /** @type {HTMLButtonElement} */ (document.getElementById('tab-form')),
  viewList: /** @type {HTMLElement} */ (document.getElementById('view-list')),
  viewForm: /** @type {HTMLElement} */ (document.getElementById('view-form')),
  goAdd: /** @type {HTMLButtonElement} */ (document.getElementById('go-add')),
  reportBtn: /** @type {HTMLButtonElement} */ (document.getElementById('report-btn')),
  storageBtn: /** @type {HTMLButtonElement} */ (document.getElementById('storage-btn')),
  storageDropdown: /** @type {HTMLDivElement} */ (document.getElementById('storage-dropdown')),
  exportBtn: /** @type {HTMLButtonElement} */ (document.getElementById('export-btn')),
  importBtn: /** @type {HTMLButtonElement} */ (document.getElementById('import-btn')),
  importFile: /** @type {HTMLInputElement} */ (document.getElementById('import-file')),

  quickFilter: /** @type {HTMLDetailsElement} */ (document.getElementById('quick-filter')),
  quickButtons: /** @type {HTMLDivElement} */ (document.getElementById('quick-buttons')),
  quickStatus: /** @type {HTMLDivElement} */ (document.getElementById('quick-status')),

  categoryFilterBtn: /** @type {HTMLButtonElement} */ (document.getElementById('category-filter-btn')),
  categoryFilterIndicator: /** @type {HTMLSpanElement} */ (document.getElementById('category-filter-indicator')),
  categoryFilterPanel: /** @type {HTMLDivElement} */ (document.getElementById('category-filter-panel')),
  categoryAll: /** @type {HTMLInputElement} */ (document.getElementById('category-all')),
  sortAuthors: /** @type {HTMLButtonElement} */ (document.getElementById('sort-authors')),
  sortTitle: /** @type {HTMLButtonElement} */ (document.getElementById('sort-title')),
  sortFinishedAt: /** @type {HTMLButtonElement} */ (document.getElementById('sort-finishedAt')),
  sortIndAuthors: /** @type {HTMLSpanElement} */ (document.getElementById('sort-ind-authors')),
  sortIndTitle: /** @type {HTMLSpanElement} */ (document.getElementById('sort-ind-title')),
  sortIndFinishedAt: /** @type {HTMLSpanElement} */ (document.getElementById('sort-ind-finishedAt')),

  form: /** @type {HTMLFormElement} */ (document.getElementById('book-form')),
  id: /** @type {HTMLInputElement} */ (document.getElementById('book-id')),
  category: /** @type {HTMLSelectElement} */ (document.getElementById('category')),
  title: /** @type {HTMLInputElement} */ (document.getElementById('title')),
  authors: /** @type {HTMLInputElement} */ (document.getElementById('authors')),
  finishedAtDisplay: /** @type {HTMLInputElement} */ (document.getElementById('finishedAtDisplay')),
  finishedAtOpen: /** @type {HTMLButtonElement} */ (document.getElementById('finishedAtOpen')),
  finishedAt: /** @type {HTMLInputElement} */ (document.getElementById('finishedAt')),
  note: /** @type {HTMLTextAreaElement} */ (document.getElementById('note')),
  cancel: /** @type {HTMLButtonElement} */ (document.getElementById('cancel-btn')),
  openSearchModal: /** @type {HTMLButtonElement} */ (document.getElementById('open-search-modal')),
  formScanHelper: /** @type {HTMLParagraphElement} */ (document.getElementById('form-scan-helper')),
  search: /** @type {HTMLInputElement} */ (document.getElementById('search')),
  listTotalBadge: /** @type {HTMLSpanElement} */ (document.getElementById('list-total-badge')),
  searchCountBadge: /** @type {HTMLSpanElement} */ (document.getElementById('search-count-badge')),
  list: /** @type {HTMLUListElement} */ (document.getElementById('book-list')),
  empty: /** @type {HTMLParagraphElement} */ (document.getElementById('empty')),

  searchModal: /** @type {HTMLDivElement} */ (document.getElementById('search-modal')),
  closeSearchModal: /** @type {HTMLButtonElement} */ (document.getElementById('close-search-modal')),
  searchForm: /** @type {HTMLFormElement} */ (document.getElementById('search-form')),
  searchQuery: /** @type {HTMLInputElement} */ (document.getElementById('search-query')),
  searchClear: /** @type {HTMLButtonElement} */ (document.getElementById('search-clear-btn')),
  searchResults: /** @type {HTMLUListElement} */ (document.getElementById('search-results')),
  searchEmpty: /** @type {HTMLParagraphElement} */ (document.getElementById('search-empty')),
  scanBtn: /** @type {HTMLButtonElement} */ (document.getElementById('scan-btn')),
  scannerWrap: /** @type {HTMLDivElement} */ (document.getElementById('scanner')),
  scannerVideo: /** @type {HTMLVideoElement} */ (document.getElementById('scanner-video')),
  scannerClose: /** @type {HTMLButtonElement} */ (document.getElementById('scanner-close-btn')),
  scannerStatus: /** @type {HTMLDivElement} */ (document.getElementById('scanner-status')),

  naverApiToggle: /** @type {HTMLButtonElement} */ (document.getElementById('naver-api-toggle')),
  naverApiPanel: /** @type {HTMLDivElement} */ (document.getElementById('naver-api-panel')),
  naverClientId: /** @type {HTMLInputElement} */ (document.getElementById('naver-client-id')),
  naverClientSecret: /** @type {HTMLInputElement} */ (document.getElementById('naver-client-secret')),
  naverApiSave: /** @type {HTMLButtonElement} */ (document.getElementById('naver-api-save')),
  naverApiClear: /** @type {HTMLButtonElement} */ (document.getElementById('naver-api-clear')),
  naverApiStatus: /** @type {HTMLParagraphElement} */ (document.getElementById('naver-api-status')),

  detailModal: /** @type {HTMLDivElement} */ (document.getElementById('detail-modal')),
  detailClose: /** @type {HTMLButtonElement} */ (document.getElementById('detail-close')),
  detailCategory: /** @type {HTMLDivElement} */ (document.getElementById('detail-category')),
  detailAuthors: /** @type {HTMLDivElement} */ (document.getElementById('detail-authors')),
  detailTitle: /** @type {HTMLDivElement} */ (document.getElementById('detail-title')),
  detailFinished: /** @type {HTMLDivElement} */ (document.getElementById('detail-finished')),
  detailNote: /** @type {HTMLDivElement} */ (document.getElementById('detail-note')),
  detailExtraStatus: /** @type {HTMLDivElement} */ (document.getElementById('detail-extra-status')),
  detailExtra: /** @type {HTMLDivElement} */ (document.getElementById('detail-extra')),
  detailAiStatus: /** @type {HTMLDivElement} */ (document.getElementById('detail-ai-status')),
  detailAiRun: /** @type {HTMLButtonElement} */ (document.getElementById('detail-ai-run')),
  detailAi: /** @type {HTMLDivElement} */ (document.getElementById('detail-ai')),
  detailEdit: /** @type {HTMLButtonElement} */ (document.getElementById('detail-edit')),
  detailDelete: /** @type {HTMLButtonElement} */ (document.getElementById('detail-delete')),

  reportModal: /** @type {HTMLDivElement} */ (document.getElementById('report-modal')),
  reportClose: /** @type {HTMLButtonElement} */ (document.getElementById('report-close')),
  reportCopy: /** @type {HTMLButtonElement} */ (document.getElementById('report-copy')),
  reportContent: /** @type {HTMLDivElement} */ (document.getElementById('report-content')),
  reportEmpty: /** @type {HTMLParagraphElement} */ (document.getElementById('report-empty')),

  sbAuthors: /** @type {HTMLButtonElement} */ (document.getElementById('sb-authors')),
  sbAuthorsInd: /** @type {HTMLSpanElement} */ (document.getElementById('sb-authors-ind')),
  sbTitle: /** @type {HTMLButtonElement} */ (document.getElementById('sb-title')),
  sbTitleInd: /** @type {HTMLSpanElement} */ (document.getElementById('sb-title-ind')),
  sbCategory: /** @type {HTMLButtonElement} */ (document.getElementById('sb-category')),
  sbCategoryInd: /** @type {HTMLSpanElement} */ (document.getElementById('sb-category-ind')),

  backupBtn: /** @type {HTMLButtonElement} */ (document.getElementById('backup-btn')),
  backupStatus: /** @type {HTMLDivElement} */ (document.getElementById('backup-status')),
  backupModal: /** @type {HTMLDivElement} */ (document.getElementById('backup-modal')),
  backupModalClose: /** @type {HTMLButtonElement} */ (document.getElementById('backup-modal-close')),
  backupPanelSetup: /** @type {HTMLDivElement} */ (document.getElementById('backup-panel-setup')),
  backupPanelActive: /** @type {HTMLDivElement} */ (document.getElementById('backup-panel-active')),
  backupTokenInput: /** @type {HTMLInputElement} */ (document.getElementById('backup-token-input')),
  backupTokenSave: /** @type {HTMLButtonElement} */ (document.getElementById('backup-token-save')),
  backupTokenStatus: /** @type {HTMLParagraphElement} */ (document.getElementById('backup-token-status')),
  backupPatLabel: /** @type {HTMLSpanElement} */ (document.getElementById('backup-pat-label')),
  backupActiveStatus: /** @type {HTMLSpanElement} */ (document.getElementById('backup-active-status')),
  backupLastTime: /** @type {HTMLSpanElement} */ (document.getElementById('backup-last-time')),
  backupGistLink: /** @type {HTMLAnchorElement} */ (document.getElementById('backup-gist-link')),
  backupNowBtn: /** @type {HTMLButtonElement} */ (document.getElementById('backup-now-btn')),
  backupRestoreBtn: /** @type {HTMLButtonElement} */ (document.getElementById('backup-restore-btn')),
  backupDisconnectBtn: /** @type {HTMLButtonElement} */ (document.getElementById('backup-disconnect-btn'))
};

/** @type {any[]} */
let cachedBooks = [];
/** @type {Array<{source:string,sourceId:string,title:string,authors:string,publishedDate:string,isbn:string,thumbnail:string}>} */
let cachedSearchResults = [];

// ── History API: 모바일 뒤로가기 제어 ──
// 포퍼스테이트가 우리 코드가 직접 되돌린 것인지 여부
let _suppressPopstate = false;
// 우리가 history.back()을 호출했을 때 popstate를 무시하기 위한 플래그
let _historyOwnBack = false;

/** @type {MediaStream | null} */
let scannerStream = null;
let scannerRunning = false;

/** @type {'list'|'form'} */
let activeView = 'list';

/** @type {string} */
let activeInitial = '';

/** @type {boolean} */
let isCategoryAll = true;
/** @type {Set<string>} */
let selectedCategories = new Set();

/** @type {{key:'authors'|'title'|'finishedAt'|null, dir:'asc'|'desc'|null}} */
let sortState = { key: 'authors', dir: 'asc' };

/** @type {string|null} 정렬바 분류 필터: null|'kr'|'en'|'eu'|'jp'|'other' */
let sbCatState = null;

/** @type {any | null} */
let activeDetailBook = null;
/** @type {{description:string} | null} */
let activeDetailExtra = null;

/** @type {{prev:string, tempSet:boolean, changed:boolean} | null} */
let datePickerSession = null;

const HANGUL_INITIALS = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ'
];

function getHangulInitialChar(ch) {
  const code = ch.charCodeAt(0);
  // 가(0xAC00) ~ 힣(0xD7A3)
  if (code < 0xac00 || code > 0xd7a3) return '';
  const index = Math.floor((code - 0xac00) / 588);
  return HANGUL_INITIALS[index] || '';
}

function getPrimaryAuthorOrTitle(book) {
  const raw = (book?.authors || '').trim();
  if (raw) return raw.split(',')[0].trim();
  return (book?.title || '').trim();
}

function getInitialKey(book) {
  const text = getPrimaryAuthorOrTitle(book);
  if (!text) return '';
  const first = text[0];

  const hangulInitial = getHangulInitialChar(first);
  if (hangulInitial) return hangulInitial;

  const upper = first.toUpperCase();
  if (upper >= 'A' && upper <= 'Z') return upper;
  if (first >= '0' && first <= '9') return first;
  return '#';
}

function getTextInitial(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const first = t[0];
  const hangulInitial = getHangulInitialChar(first);
  if (hangulInitial) return hangulInitial;
  const upper = first.toUpperCase();
  if (upper >= 'A' && upper <= 'Z') return upper;
  if (first >= '0' && first <= '9') return first;
  return '#';
}

function matchesInitial(book) {
  if (!activeInitial) return true;
  const primaryAuthor = String(book?.authors || '').trim().split(',')[0].trim();
  return (
    getTextInitial(primaryAuthor) === activeInitial ||
    getTextInitial(book.title) === activeInitial ||
    getTextInitial(book.note) === activeInitial
  );
}

function matchesCategory(book) {
  if (isCategoryAll) return true;
  const c = book?.category || 'kr';
  return selectedCategories.has(c);
}

function getSortValue(book, key) {
  if (key === 'finishedAt') {
    const v = String(book?.finishedAt || '').trim();
    // 빈 값은 뒤로
    return v ? v : '9999-99-99';
  }

  if (key === 'title') {
    return String(book?.title || '').trim();
  }

  // authors
  return String(getPrimaryAuthorOrTitle({ authors: book?.authors || '' }) || '').trim();
}

function compareBooks(a, b) {
  const effective = sortState.key && sortState.dir ? sortState : { key: 'authors', dir: 'asc' };
  const av = getSortValue(a, effective.key);
  const bv = getSortValue(b, effective.key);
  const base = av.localeCompare(bv, 'ko', { sensitivity: 'base' });
  const dir = effective.dir === 'asc' ? 1 : -1;
  if (base !== 0) return base * dir;

  // tie-breaker: title asc
  const at = String(a?.title || '').trim();
  const bt = String(b?.title || '').trim();
  return at.localeCompare(bt, 'ko', { sensitivity: 'base' });
}

function updateSortIndicators() {
  // 기본은 모두 숨김
  els.sortIndAuthors.hidden = true;
  els.sortIndTitle.hidden = true;
  els.sortIndFinishedAt.hidden = true;

  if (!sortState.key || !sortState.dir) return;

  const glyph = sortState.dir === 'asc' ? '▲' : '▼';
  if (sortState.key === 'authors') {
    els.sortIndAuthors.textContent = glyph;
    els.sortIndAuthors.hidden = false;
  } else if (sortState.key === 'title') {
    els.sortIndTitle.textContent = glyph;
    els.sortIndTitle.hidden = false;
  } else if (sortState.key === 'finishedAt') {
    els.sortIndFinishedAt.textContent = glyph;
    els.sortIndFinishedAt.hidden = false;
  }
}

function toggleSort(key) {
  // 없음 -> 오름 -> 내림 -> 없음
  if (sortState.key !== key || !sortState.dir) {
    sortState = { key, dir: 'asc' };
  } else if (sortState.dir === 'asc') {
    sortState = { key, dir: 'desc' };
  } else {
    sortState = { key: null, dir: null };
  }
  updateSortIndicators();
  updateSortBar();
  render();
}

// ─── 정렬 바 ────────────────────────────────────────────────
const SB_CAT_CYCLE = ['kr', 'en', 'eu', 'jp', 'other'];
const SB_CAT_LABEL = { kr: '국내', en: '영미', eu: '유럽', jp: '일본', other: '그외' };

function updateSortBar() {
  // 저자
  const authOn = sortState.key === 'authors';
  els.sbAuthors.classList.toggle('sb-active', authOn);
  els.sbAuthorsInd.textContent = authOn ? (sortState.dir === 'asc' ? '오름' : '내림') : '꺼짐';
  els.sbAuthorsInd.classList.toggle('sb-off', !authOn);

  // 제목
  const titleOn = sortState.key === 'title';
  els.sbTitle.classList.toggle('sb-active', titleOn);
  els.sbTitleInd.textContent = titleOn ? (sortState.dir === 'asc' ? '오름' : '내림') : '꺼짐';
  els.sbTitleInd.classList.toggle('sb-off', !titleOn);

  // 분류
  const catOn = sbCatState !== null;
  els.sbCategory.classList.toggle('sb-active', catOn);
  els.sbCategoryInd.textContent = catOn ? SB_CAT_LABEL[sbCatState] : '꺼짐';
  els.sbCategoryInd.classList.toggle('sb-off', !catOn);
}

function toggleSortBar(key) {
  if (sortState.key !== key) {
    sortState = { key, dir: 'asc' };
  } else if (sortState.dir === 'asc') {
    sortState = { key, dir: 'desc' };
  } else {
    sortState = { key: null, dir: null };
  }
  updateSortIndicators();
  updateSortBar();
  render();
}

function toggleSortBarCat() {
  if (sbCatState === null) {
    sbCatState = SB_CAT_CYCLE[0];
  } else {
    const idx = SB_CAT_CYCLE.indexOf(sbCatState);
    sbCatState = idx >= SB_CAT_CYCLE.length - 1 ? null : SB_CAT_CYCLE[idx + 1];
  }

  if (sbCatState === null) {
    isCategoryAll = true;
    selectedCategories = new Set();
  } else {
    isCategoryAll = false;
    selectedCategories = new Set([sbCatState]);
  }

  syncCategoryUi();
  updateSortBar();
  render();
}
// ──────────────────────────────────────────────────────────────

function setCategoryPanelOpen(open) {
  els.categoryFilterPanel.hidden = !open;
  els.categoryFilterBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function syncCategoryUi() {
  els.categoryAll.checked = isCategoryAll;

  const checks = els.categoryFilterPanel.querySelectorAll('input.category-check');
  checks.forEach((c) => {
    c.checked = !isCategoryAll && selectedCategories.has(c.value);
  });

  // 전체가 아니면(부분 선택) 배지 표시
  els.categoryFilterIndicator.hidden = isCategoryAll;
}

function setCategoryAllMode() {
  isCategoryAll = true;
  selectedCategories = new Set();
  sbCatState = null;
  syncCategoryUi();
  updateSortBar();
  render();
}

function applyCategorySelectionFromDom() {
  const checks = els.categoryFilterPanel.querySelectorAll('input.category-check');
  const next = new Set();
  checks.forEach((c) => {
    if (c.checked) next.add(c.value);
  });

  // 하나도 선택 안 되면 전체로 복귀
  if (next.size === 0) {
    setCategoryAllMode();
    return;
  }

  isCategoryAll = false;
  selectedCategories = next;
  // 정렬 바 분류 동기화: 1개만 선택 시 sort bar에 반영
  sbCatState = next.size === 1 ? [...next][0] : null;
  syncCategoryUi();
  updateSortBar();
  render();
}

function setActiveInitial(value) {
  activeInitial = value;
  const buttons = els.quickButtons.querySelectorAll('button[data-initial]');
  buttons.forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-initial') === activeInitial);
  });

  if (!activeInitial) {
    els.quickStatus.hidden = true;
    els.quickStatus.textContent = '';
  } else {
    els.quickStatus.hidden = false;
    els.quickStatus.textContent = `빠른 찾기: ${activeInitial} (다시 누르면 해제)`;
  }

  render();
}

function buildQuickButtons() {
  const digits = Array.from({ length: 10 }, (_, i) => String(i));
  const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

  const all = ['전체', ...digits, ...letters, ...HANGUL_INITIALS];
  els.quickButtons.innerHTML = '';

  for (const label of all) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-btn';

    const initial = label === '전체' ? '' : label;
    btn.setAttribute('data-initial', initial);
    btn.textContent = label;

    btn.addEventListener('click', () => {
      // 같은 버튼을 다시 누르면 해제
      if (initial && activeInitial === initial) {
        setActiveInitial('');
      } else {
        setActiveInitial(initial);
      }
    });

    els.quickButtons.appendChild(btn);
  }

  setActiveInitial('');
}

function categoryLabel(value) {
  switch (value) {
    case 'kr':
      return '국내작품';
    case 'en':
      return '영미작품';
    case 'eu':
      return '유럽작품';
    case 'jp':
      return '일본작품';
    default:
      return '그 외';
  }
}

function normalizeAuthorKey(raw) {
  const a = String(raw || '').trim();
  return a ? a : '저자 미상';
}

function compareAuthorKey(a, b) {
  const ax = a === '저자 미상' ? '~~~~' : a;
  const bx = b === '저자 미상' ? '~~~~' : b;
  return ax.localeCompare(bx, 'ko', { sensitivity: 'base' });
}

function compareTitle(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'ko', { sensitivity: 'base' });
}

function getReportBooks() {
  const query = els.search.value.trim();
  return cachedBooks
    .filter((b) => matchesQuery(b, query))
    .filter((b) => matchesInitial(b))
    .filter((b) => matchesCategory(b));
}

function buildReportModel(books) {
  /** @type {Map<string, Map<string, Set<string>>>} */
  const byCategory = new Map();

  for (const b of books) {
    const category = String(b?.category || 'kr');
    const author = normalizeAuthorKey(b?.authors);
    const title = String(b?.title || '').trim();
    if (!title) continue;

    if (!byCategory.has(category)) byCategory.set(category, new Map());
    const byAuthor = byCategory.get(category);
    if (!byAuthor.has(author)) byAuthor.set(author, new Set());
    byAuthor.get(author).add(title);
  }

  return byCategory;
}

function renderReport() {
  const books = getReportBooks();
  const model = buildReportModel(books);

  els.reportContent.innerHTML = '';

  const orderedCategories = ['kr', 'en', 'eu', 'jp', 'other'];
  const sections = [];

  for (const cat of orderedCategories) {
    const byAuthor = model.get(cat);
    if (!byAuthor || byAuthor.size === 0) continue;

    const authors = Array.from(byAuthor.keys()).sort(compareAuthorKey);
    const section = document.createElement('section');

    const h = document.createElement('h3');
    h.className = 'report-category';
    h.textContent = categoryLabel(cat);
    section.appendChild(h);

    const lines = document.createElement('div');
    lines.className = 'report-lines';

    for (const author of authors) {
      const titles = Array.from(byAuthor.get(author) || []).sort(compareTitle);

      const line = document.createElement('div');
      line.className = 'report-line';

      const a = document.createElement('span');
      a.className = 'report-author';
      a.textContent = `${author}:`;

      const w = document.createElement('span');
      w.className = 'report-works';
      w.textContent = titles.join(', ');

      line.appendChild(a);
      line.appendChild(w);
      lines.appendChild(line);
    }

    section.appendChild(lines);
    sections.push(section);
  }

  for (const s of sections) els.reportContent.appendChild(s);

  els.reportEmpty.hidden = sections.length !== 0;
  if (sections.length === 0) {
    els.reportEmpty.textContent = '리포트로 만들 책이 없어요.';
  }
}

function buildReportPlainText() {
  const books = getReportBooks();
  const model = buildReportModel(books);
  const orderedCategories = ['kr', 'en', 'eu', 'jp', 'other'];

  const out = [];
  for (const cat of orderedCategories) {
    const byAuthor = model.get(cat);
    if (!byAuthor || byAuthor.size === 0) continue;

    out.push(categoryLabel(cat));
    const authors = Array.from(byAuthor.keys()).sort(compareAuthorKey);
    for (const author of authors) {
      const titles = Array.from(byAuthor.get(author) || []).sort(compareTitle);
      out.push(`${author}: ${titles.join(', ')}`);
    }
    out.push('');
  }

  return out.join('\n').trim();
}

async function copyTextToClipboard(text) {
  const t = String(text || '').trim();
  if (!t) return false;

  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    // fallback below
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function openReportModal() {
  history.pushState({ _bcy: 'modal', modal: 'report' }, '');
  renderReport();
  els.reportModal.hidden = false;
  els.reportModal.setAttribute('aria-hidden', 'false');
  els.reportClose.focus();
  lockScroll();
}

function closeReportModal() {
  els.reportModal.hidden = true;
  els.reportModal.setAttribute('aria-hidden', 'true');
  unlockScroll();
  if (!_suppressPopstate) { _historyOwnBack = true; history.back(); }
}

// ────────── 스크롤 잠금 (모달 열림 시 body 스크롤 제어) ──────────
let _scrollLockCount = 0;
function lockScroll() {
  _scrollLockCount++;
  if (_scrollLockCount === 1) document.body.classList.add('modal-open');
}
function unlockScroll() {
  _scrollLockCount = Math.max(0, _scrollLockCount - 1);
  if (_scrollLockCount === 0) document.body.classList.remove('modal-open');
}

// ────────── Gist 백업 UI ──────────

function updateBackupStatusBadge(savedAt) {
  const el = els.backupStatus;
  if (!el) return;
  const s = loadGistSettings();
  if (!s || !s.token) {
    el.hidden = true;
    return;
  }
  const t = savedAt || s.lastAt;
  if (t) {
    const d = new Date(t);
    el.textContent = `☁ ${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 백업됨`;
  } else {
    el.textContent = '☁ 백업 대기 중…';
  }
  el.hidden = false;
}

function refreshBackupPanel() {
  const s = loadGistSettings();
  const hasToken = !!(s && s.token);
  els.backupPanelSetup.hidden = hasToken;
  els.backupPanelActive.hidden = !hasToken;
  if (hasToken) {
    if (s.lastAt) {
      const d = new Date(s.lastAt);
      els.backupLastTime.textContent = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } else {
      els.backupLastTime.textContent = '아직 없음';
    }
    if (s.gistId) {
      els.backupGistLink.href = `https://gist.github.com/${s.gistId}`;
      els.backupGistLink.textContent = '보기';
    } else {
      els.backupGistLink.href = '#';
      els.backupGistLink.textContent = '(백업 후 표시)';
    }
  }
}

function openBackupModal() {
  history.pushState({ _bcy: 'modal', modal: 'backup' }, '');
  refreshBackupPanel();
  els.backupModal.hidden = false;
  els.backupModal.setAttribute('aria-hidden', 'false');
  els.backupModalClose.focus();
  lockScroll();
}

function closeBackupModal() {
  els.backupModal.hidden = true;
  els.backupModal.setAttribute('aria-hidden', 'true');
  unlockScroll();
  if (!_suppressPopstate) { _historyOwnBack = true; history.back(); }
}

function initBackupPanel() {
  updateBackupStatusBadge();
}

function formatFinishedAt(value) {
  if (!value) return '';
  // yyyy-mm-dd
  const m = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return value;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mm) || !Number.isFinite(dd)) return value;
  return `${y}. ${mm}. ${dd}`;
}

function isValidYmd(y, m, d) {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function parseFinishedAtDisplayToIso(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';

  // 20260306 처럼 숫자 8자리도 허용
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 8) {
    const y = Number(digits.slice(0, 4));
    const m = Number(digits.slice(4, 6));
    const d = Number(digits.slice(6, 8));
    if (!isValidYmd(y, m, d)) return null;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // 2026. 3. 6 / 2026-3-6 / 2026/3/6
  const m = raw.match(/^(\d{4})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (!isValidYmd(y, mm, dd)) return null;
  return `${String(y).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function syncFinishedAtFromDisplay({ report = false } = {}) {
  const raw = els.finishedAtDisplay.value.trim();
  if (!raw) {
    els.finishedAt.value = '';
    els.finishedAtDisplay.setCustomValidity('');
    return true;
  }

  const iso = parseFinishedAtDisplayToIso(raw);
  if (!iso) {
    els.finishedAtDisplay.setCustomValidity('완독일은 예: 2026. 3. 6 처럼 입력해주세요.');
    if (report) els.finishedAtDisplay.reportValidity();
    return false;
  }

  els.finishedAtDisplay.setCustomValidity('');
  els.finishedAt.value = iso;
  els.finishedAtDisplay.value = formatFinishedAt(iso);
  return true;
}

function setActiveView(view, { noHistory = false } = {}) {
  const wasForm = activeView === 'form';
  activeView = view;

  if (!noHistory) {
    if (view === 'form' && !wasForm) {
      history.pushState({ _bcy: 'view', view: 'form' }, '');
    } else if (view === 'list' && wasForm) {
      _historyOwnBack = true;
      history.back();
    }
  }

  const isList = view === 'list';
  els.viewList.hidden = !isList;
  els.viewForm.hidden = isList;

  els.tabList.classList.toggle('active', isList);
  els.tabForm.classList.toggle('active', !isList);
  els.tabList.setAttribute('aria-current', isList ? 'page' : 'false');
  els.tabForm.setAttribute('aria-current', !isList ? 'page' : 'false');

  if (isList) {
    els.search.focus();
  } else {
    ensureDefaultFinishedAtForAdd();
    els.title.focus();
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./service-worker.js');

      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    } catch {
      // 무시: 로컬 파일 접근(file://) 등에서는 등록이 실패할 수 있음
    }
  });
}

function normalize(text) {
  return (text || '').toString().toLowerCase();
}

function getTodayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(
    2,
    '0'
  )}`;
}

function ensureDefaultFinishedAtForAdd() {
  const isAddMode = !String(els.id.value || '').trim();
  if (!isAddMode) return;

  const hasIso = Boolean(String(els.finishedAt.value || '').trim());
  const hasDisplay = Boolean(String(els.finishedAtDisplay.value || '').trim());
  if (hasIso || hasDisplay) return;

  els.finishedAt.value = getTodayIso();
  els.finishedAtDisplay.value = formatFinishedAt(els.finishedAt.value);
}

function clearForm() {
  els.id.value = '';
  els.category.value = 'kr';
  els.title.value = '';
  els.authors.value = '';
  els.finishedAt.value = getTodayIso();
  els.finishedAtDisplay.value = formatFinishedAt(els.finishedAt.value);
  els.note.value = '';
  els.title.focus();
}

function fillForm(book) {
  els.id.value = String(book.id);
  els.category.value = book.category || 'kr';
  els.title.value = book.title || '';
  els.authors.value = book.authors || '';
  els.finishedAt.value = book.finishedAt || '';
  els.finishedAtDisplay.value = book.finishedAt ? formatFinishedAt(book.finishedAt) : '';
  els.note.value = book.note || '';
  els.title.focus();
}

function fillFormFromSearch(result) {
  els.id.value = '';
  els.category.value = 'kr';
  els.title.value = result.title || '';
  els.authors.value = result.authors || '';
  els.finishedAt.value = getTodayIso();
  els.finishedAtDisplay.value = formatFinishedAt(els.finishedAt.value);
  els.note.value = result.isbn ? `ISBN: ${result.isbn}` : '';
  els.title.focus();
}

function openDetailModal() {
  history.pushState({ _bcy: 'modal', modal: 'detail' }, '');
  els.detailModal.hidden = false;
  els.detailModal.setAttribute('aria-hidden', 'false');
  els.detailClose.focus();
  lockScroll();
}

async function closeDetailModal() {
  els.detailModal.hidden = true;
  els.detailModal.setAttribute('aria-hidden', 'true');
  activeDetailBook = null;
  activeDetailExtra = null;
  els.detailAi.hidden = true;
  els.detailExtra.hidden = true;
  unlockScroll();
  if (!_suppressPopstate) { _historyOwnBack = true; history.back(); }
}

function renderDetailBasic(book) {
  // 분류: 컬러 뱃지
  els.detailCategory.className = `detail-v cat-badge cat-${book.category || 'other'}`;
  els.detailCategory.textContent = categoryLabel(book.category);
  els.detailAuthors.textContent = book.authors ? book.authors : '저자 미상';
  els.detailTitle.textContent = book.title;
  els.detailFinished.textContent = book.finishedAt ? formatFinishedAt(book.finishedAt) : '없음';
  els.detailNote.textContent = book.note ? book.note : '없음';

  els.detailExtraStatus.textContent = '불러오는 중…';
  els.detailExtra.hidden = true;
  els.detailExtra.textContent = '';

  els.detailAiStatus.textContent = '요약을 가져올 수 있어요.';
  els.detailAi.hidden = true;
  els.detailAi.textContent = '';
}

function setExtraText(extra) {
  const lines = [];
  if (extra.publisher) lines.push(`출판사: ${extra.publisher}`);
  if (extra.publishedDate) lines.push(`출간: ${extra.publishedDate}`);
  if (extra.pageCount) lines.push(`쪽수: ${extra.pageCount}`);
  if (Array.isArray(extra.categories) && extra.categories.length) {
    lines.push(`분야: ${extra.categories.slice(0, 3).join(', ')}`);
  }
  if (extra.description) lines.push(`\n${extra.description}`);

  const text = lines.join('\n').trim();
  els.detailExtra.textContent = text || '추가 정보를 찾지 못했어요.';
  els.detailExtra.hidden = false;
  activeDetailExtra = { description: extra.description || '' };
}

async function openDetailForId(id) {
  const book = await getBook(id);
  if (!book) return;
  activeDetailBook = book;
  renderDetailBasic(book);
  openDetailModal();

  // Google Books 추가 정보(키 불필요) 비동기 로드
  try {
    const isbn = (book.note || '').match(/ISBN:\s*([0-9Xx-]{10,17})/)?.[1] || '';
    const extra = await fetchBookExtra({ isbn, title: book.title, authors: book.authors });
    if (!activeDetailBook || activeDetailBook.id !== id) return;

    if (extra) {
      els.detailExtraStatus.textContent = '';
      setExtraText(extra);
    } else {
      els.detailExtraStatus.textContent = '추가 정보를 찾지 못했어요.';
    }
  } catch (err) {
    if (!activeDetailBook || activeDetailBook.id !== id) return;

    const msg = String(err?.message || '');
    if (msg === 'BOOKS_QUOTA') {
      els.detailExtraStatus.textContent = '오류가 발생되었어요. 잠시 후 다시 시도해주세요.';
      return;
    }

    els.detailExtraStatus.textContent = '추가 정보 불러오기에 실패했어요.';
  }
}

function openSearchModal() {
  if (activeView !== 'form') setActiveView('form');
  history.pushState({ _bcy: 'modal', modal: 'search' }, '');
  els.searchModal.hidden = false;
  els.searchModal.setAttribute('aria-hidden', 'false');
  lockScroll();
  if (canScanBarcode()) {
    // 지원 기기: 모달 열리자마자 스캔너 자동 시작
    startScanner();
  } else {
    els.searchQuery.focus();
  }
}

async function closeSearchModal() {
  await stopScanner();
  els.searchModal.hidden = true;
  els.searchModal.setAttribute('aria-hidden', 'true');
  unlockScroll();
  if (!_suppressPopstate) { _historyOwnBack = true; history.back(); }
}

function matchesQuery(book, query) {
  if (!query) return true;
  const q = normalize(query);
  return (
    normalize(book.title).includes(q) ||
    normalize(book.authors).includes(q) ||
    normalize(book.note).includes(q)
  );
}

function render() {
  const query = els.search.value.trim();
  const books = cachedBooks
    .filter((b) => matchesQuery(b, query))
    .filter((b) => matchesInitial(b))
    .filter((b) => matchesCategory(b))
    .slice()
    .sort(compareBooks);

  // 전체 건수 배지
  els.listTotalBadge.textContent = String(cachedBooks.length);

  // 검색 건수 배지 (검색어가 있을 때만 표시)
  if (query) {
    els.searchCountBadge.textContent = books.length + '건';
    els.searchCountBadge.hidden = false;
  } else {
    els.searchCountBadge.hidden = true;
  }

  els.list.innerHTML = '';
  els.empty.hidden = books.length !== 0;

  for (const book of books) {
    const li = document.createElement('li');
    li.className = 'row';
    li.dataset.id = String(book.id);

    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.setAttribute('aria-label', '상세 보기');

    const c1 = document.createElement('div');
    c1.className = `cell cat-badge cat-${book.category || 'other'}`;
    c1.textContent = categoryLabel(book.category);

    const c2 = document.createElement('div');
    c2.className = 'cell';
    c2.textContent = book.authors ? book.authors : '저자 미상';
    c2.title = c2.textContent;

    const c3 = document.createElement('div');
    c3.className = 'cell';
    c3.textContent = book.title;
    c3.title = c3.textContent;

    const c4 = document.createElement('div');
    c4.className = 'cell right';
    c4.textContent = book.finishedAt ? formatFinishedAt(book.finishedAt) : '';

    li.appendChild(c1);
    li.appendChild(c2);
    li.appendChild(c3);
    li.appendChild(c4);

    els.list.appendChild(li);
  }
}

function renderSearchResults() {
  els.searchResults.innerHTML = '';
  els.searchEmpty.hidden = cachedSearchResults.length !== 0;

  for (const item of cachedSearchResults) {
    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.sourceId = item.sourceId;

    const row = document.createElement('div');
    row.className = 'item-row';

    if (item.thumbnail) {
      const img = document.createElement('img');
      img.className = 'thumb';
      img.alt = '';
      img.src = item.thumbnail;
      row.appendChild(img);
    }

    const content = document.createElement('div');
    content.style.minWidth = '0';

    const title = document.createElement('div');
    title.className = 'item-title';
    title.textContent = item.title;

    const meta = document.createElement('div');
    meta.className = 'item-meta';
    const parts = [];
    if (item.authors) parts.push(item.authors);
    if (item.publishedDate) parts.push(item.publishedDate);
    if (item.isbn) parts.push(`ISBN: ${item.isbn}`);
    meta.textContent = parts.join(' · ');

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'secondary';
    importBtn.dataset.action = 'import';
    importBtn.textContent = '가져오기';

    actions.appendChild(importBtn);

    content.appendChild(title);
    content.appendChild(meta);
    content.appendChild(actions);

    row.appendChild(content);
    li.appendChild(row);
    els.searchResults.appendChild(li);
  }
}

function toBackupFilenameDate(d) {
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}`;
}

function downloadJson(filename, data) {
  const text = JSON.stringify(data, null, 2);
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

async function exportBooks() {
  const books = await listBooks();
  const payload = {
    app: 'B.CY Library',
    version: 1,
    exportedAt: new Date().toISOString(),
    books
  };

  const filename = `bcy-library-${toBackupFilenameDate(new Date())}.json`;
  downloadJson(filename, payload);

  // 마지막 내보내기 날짜 저장 (내부저장 버튼 경고 판단용)
  localStorage.setItem('bcy_last_export', new Date().toISOString());
  updateStorageBtnState();
}

function pickBooksFromImportJson(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray(data.books)) return data.books;
  return null;
}

function looksLikeBook(item) {
  if (!item || typeof item !== 'object') return false;
  const title = String(item.title || '').trim();
  return Boolean(title);
}

function normalizeDedupText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeDedupFinishedAt(value) {
  const v = String(value || '').trim();
  if (!v) return '';

  // ISO 그대로
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  // "2026. 3. 6" 형태 일부 백업 대비
  const m = v.match(/^(\d{4})\.?\s*(\d{1,2})\.?\s*(\d{1,2})\.?$/);
  if (m) {
    const yyyy = m[1];
    const mm = String(Number(m[2])).padStart(2, '0');
    const dd = String(Number(m[3])).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return v;
}

function makeWeakDedupKey(item) {
  if (!item || typeof item !== 'object') return '';
  const title = normalizeDedupText(item.title);
  if (!title) return '';
  const authors = normalizeDedupText(item.authors);
  const finishedAt = normalizeDedupFinishedAt(item.finishedAt);
  return `${title}|${authors}|${finishedAt}`;
}

async function importBooksFromFile(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  const books = pickBooksFromImportJson(data);

  if (!books) {
    throw new Error('INVALID_BACKUP');
  }

  const valid = books.filter(looksLikeBook);
  if (valid.length === 0) {
    throw new Error('EMPTY_BACKUP');
  }

  const ok = confirm(`가져오기: ${valid.length}권\n\n기존 목록은 그대로 두고, 추가로만 가져와요.\n계속할까요?`);
  if (!ok) return { imported: 0, skipped: books.length };

  // 중복 방지용: 현재 저장된 guid/약한키를 한 번만 로드
  const existing = await listBooks();
  const existingGuids = new Set(
    existing
      .map((b) => (typeof b?.guid === 'string' ? b.guid.trim() : ''))
      .filter(Boolean)
  );
  const existingWeakKeys = new Set(existing.map(makeWeakDedupKey).filter(Boolean));

  let imported = 0;
  let skipped = 0;

  for (const raw of books) {
    try {
      if (!looksLikeBook(raw)) {
        skipped += 1;
        continue;
      }

      const guid = typeof raw?.guid === 'string' ? raw.guid.trim() : '';
      if (guid) {
        if (existingGuids.has(guid)) {
          skipped += 1;
          continue;
        }
      }

      // guid가 없는 옛 백업 대비: title+authors+finishedAt 조합으로 중복 추가 방지
      const weakKey = makeWeakDedupKey(raw);
      if (weakKey && existingWeakKeys.has(weakKey)) {
        skipped += 1;
        continue;
      }

      await insertImportedBook(raw);
      imported += 1;

      if (guid) existingGuids.add(guid);
      if (weakKey) existingWeakKeys.add(weakKey);
    } catch {
      skipped += 1;
    }
  }

  return { imported, skipped };
}

let _gistBackupTimer = null;
async function refresh() {
  cachedBooks = await listBooks();
  render();
}

async function runSearch(query) {
  const q = String(query || '').trim();
  if (!q) {
    cachedSearchResults = [];
    renderSearchResults();
    return;
  }

  els.searchEmpty.textContent = '검색 중…';
  els.searchEmpty.hidden = false;
  els.searchResults.innerHTML = '';

  try {
    cachedSearchResults = await searchBooks(q);
    els.searchEmpty.textContent = '검색 결과가 없어요.';
    renderSearchResults();
  } catch (err) {
    cachedSearchResults = [];
    const msg = String(err?.message || '');
    if (msg === 'BOOKS_QUOTA') {
      els.searchResults.innerHTML = '';
      els.searchEmpty.textContent = '오늘 책검색 한도를 초과했어요. 잠시 후 다시 시도해주세요.';
      els.searchEmpty.hidden = false;
      return;
    }

    els.searchResults.innerHTML = '';
    els.searchEmpty.textContent = '책검색에 실패했어요.';
    els.searchEmpty.hidden = false;
  }
}

function getFormValue() {
  return {
    category: els.category.value,
    title: els.title.value,
    authors: els.authors.value,
    finishedAt: els.finishedAt.value,
    note: els.note.value
  };
}

async function onSubmit(event) {
  event.preventDefault();

  if (!syncFinishedAtFromDisplay({ report: true })) return;

  const value = getFormValue();
  if (!value.title || !value.title.trim()) {
    els.title.focus();
    return;
  }

  const idRaw = els.id.value.trim();
  if (idRaw) {
    await updateBook(Number(idRaw), value);
  } else {
    await addBook(value);
  }

  clearForm();
  await refresh();
  setActiveView('list');

  // 저장 성공 후에만 Gist 자동 백업 (안전 가드 통과 시에만)
  const gistCfg = loadGistSettings();
  if (gistCfg && gistCfg.token && isSafeToBackup(cachedBooks)) {
    clearTimeout(_gistBackupTimer);
    _gistBackupTimer = setTimeout(async () => {
      try {
        const result = await backupToGist(cachedBooks);
        updateBackupStatusBadge(result.savedAt);
      } catch (e) {
        console.warn('[Gist] 백업 실패:', e.message);
      }
    }, 1000);
  }
}

/**
 * 자동 백업 안전 가드.
 * - 빈 배열: 절대 백업 안함 (연결 직후 빈 상태로 덮어쓰기 방지)
 * - 마지막 백업 대비 30% 이상 감소 & 마지막 백업이 5권 이상: 자동 차단
 * @param {any[]} books
 * @returns {boolean}
 */
function isSafeToBackup(books) {
  if (books.length === 0) {
    console.warn('[Gist] 자동 백업 차단: 로컬 데이터가 비어있음');
    return false;
  }
  const s = loadGistSettings();
  if (s && typeof s.lastCount === 'number' && s.lastCount >= 5) {
    const ratio = books.length / s.lastCount;
    if (ratio < 0.7) {
      console.warn(`[Gist] 자동 백업 차단: 현재 ${books.length}권 / 마지막 백업 ${s.lastCount}권 (30% 이상 감소)`);
      return false;
    }
  }
  return true;
}

async function onListClick(event) {
  const target = /** @type {HTMLElement} */ (event.target);
  const li = target.closest('li');
  const id = li?.dataset?.id ? Number(li.dataset.id) : NaN;
  if (!Number.isFinite(id)) return;
  await openDetailForId(id);
}

async function onListKeyDown(event) {
  const e = /** @type {KeyboardEvent} */ (event);
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const target = /** @type {HTMLElement} */ (event.target);
  const li = target.closest('li');
  const id = li?.dataset?.id ? Number(li.dataset.id) : NaN;
  if (!Number.isFinite(id)) return;
  e.preventDefault();
  await openDetailForId(id);
}

async function runAiSummary() {
  const book = activeDetailBook;
  if (!book) return;

  els.detailAi.hidden = true;
  els.detailAi.textContent = '';
  els.detailAiStatus.textContent = '요약 중…';

  try {
    const text = await summarizeWithGemini({
      title: book.title,
      authors: book.authors || '',
      categoryLabel: categoryLabel(book.category)
    });

    // 모달이 다른 책으로 바뀌었으면 무시
    if (!activeDetailBook || activeDetailBook.id !== book.id) return;

    els.detailAiStatus.textContent = '';
    els.detailAi.textContent = text || '요약 결과가 없어요.';
    els.detailAi.hidden = false;
  } catch (err) {
    if (!activeDetailBook || activeDetailBook.id !== book.id) return;

    const msg = String(err?.message || '');
    if (msg === 'GEMINI_API_KEY_MISSING') {
      els.detailAiStatus.textContent = 'Gemini API 키가 아직 설정되지 않았어요.';
    } else if (msg.startsWith('AI_REQUEST_FAILED:')) {
      const parts = msg.split(':');
      const status = parts[1] || '';
      els.detailAiStatus.textContent = `AI 요약에 실패했어요. (${status})`;
    } else {
      els.detailAiStatus.textContent = 'AI 요약에 실패했어요.';
    }
  }
}

async function onDetailEdit() {
  const book = activeDetailBook;
  if (!book) return;
  fillForm(book);
  // closeDetailModal의 history.back()을 막고 직접 replaceState로 교체
  // [base, {modal:'detail'}] → [base, {view:'form'}] 으로 만들어서 뒤로가기가 목록으로 돌아오게 함
  _suppressPopstate = true;
  try {
    await closeDetailModal();
  } finally {
    _suppressPopstate = false;
  }
  history.replaceState({ _bcy: 'view', view: 'form' }, '');
  setActiveView('form', { noHistory: true });
}

async function onDetailDelete() {
  const book = activeDetailBook;
  if (!book) return;
  const ok = confirm('이 책을 삭제할까요?');
  if (!ok) return;

  await deleteBook(book.id);
  if (els.id.value && Number(els.id.value) === book.id) clearForm();
  await closeDetailModal();
  await refresh();
}

async function onSearchSubmit(event) {
  event.preventDefault();
  await runSearch(els.searchQuery.value);
}

async function onSearchListClick(event) {
  const target = /** @type {HTMLElement} */ (event.target);
  const action = target?.dataset?.action;
  if (action !== 'import') return;

  const li = target.closest('li');
  const sourceId = li?.dataset?.sourceId || '';
  const picked = cachedSearchResults.find((x) => x.sourceId === sourceId);
  if (!picked) return;
  fillFormFromSearch(picked);
  await closeSearchModal();
}

function canScanBarcode() {
  return 'BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
}

async function stopScanner() {
  scannerRunning = false;

  if (scannerStream) {
    for (const track of scannerStream.getTracks()) track.stop();
    scannerStream = null;
  }

  els.scannerVideo.srcObject = null;
  els.scannerWrap.hidden = true;
}

async function startScanner() {
  if (!canScanBarcode()) {
    alert('이 기기/브라우저에서는 바코드 스캔을 지원하지 않습니다. (Android Chrome 최신 버전을 권장)');
    return;
  }

  els.scannerStatus.textContent = '카메라를 시작합니다…';
  els.scannerWrap.hidden = false;

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
  } catch {
    els.scannerStatus.textContent = '카메라 권한을 확인해주세요.';
    return;
  }

  els.scannerVideo.srcObject = scannerStream;
  await els.scannerVideo.play();

  const detector = new BarcodeDetector({
    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code']
  });

  scannerRunning = true;
  els.scannerStatus.textContent = '바코드를 프레임 안에 맞춰주세요.';

  const tick = async () => {
    if (!scannerRunning) return;

    try {
      const barcodes = await detector.detect(els.scannerVideo);
      const first = Array.isArray(barcodes) ? barcodes[0] : null;
      const raw = first?.rawValue || '';
      const isbn = tryExtractIsbnFromBarcode(raw);

      if (isbn) {
        els.scannerStatus.textContent = `인식됨: ${isbn}`;
        await stopScanner();
        els.searchQuery.value = isbn;

        const found = await lookupByIsbn(isbn);
        cachedSearchResults = found ? [found] : [];
        renderSearchResults();
        return;
      }
    } catch {
      // 감지 실패는 반복
    }

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

/**
 * 내보내기가 30일을 초과했으면 내부저장 버튼을 경고색으로 표시.
 */
function updateStorageBtnState() {
  const raw = localStorage.getItem('bcy_last_export');
  let overdue = false;
  if (!raw) {
    overdue = true; // 한 번도 내보내기 안 한 경우
  } else {
    const diff = Date.now() - new Date(raw).getTime();
    overdue = diff > 30 * 24 * 60 * 60 * 1000;
  }
  els.storageBtn?.classList.toggle('toolbar-btn--storage-warn', overdue);
  if (els.storageBtn) {
    els.storageBtn.textContent = overdue ? '⚠ 내부저장 ▾' : '내부저장 ▾';
  }
}

/**
 * 네이버 API 자격증명 상태를 UI에 반영.
 */
function updateNaverApiState() {
  const custom = getNaverCredentialsCustom();
  if (els.naverApiToggle) {
    if (custom) {
      els.naverApiToggle.textContent = '✏ API';
      els.naverApiToggle.title = '사용자 API 사용 중';
      els.naverApiToggle.classList.add('naver-api-active');
    } else {
      els.naverApiToggle.textContent = '✓ API';
      els.naverApiToggle.title = '기본 네이버 API 사용 중';
      els.naverApiToggle.classList.remove('naver-api-active');
    }
  }
  if (els.naverClientId && custom) els.naverClientId.value = custom.id;
  if (els.naverClientSecret && custom) els.naverClientSecret.value = custom.secret;
}

function wireEvents() {
  els.form.addEventListener('submit', onSubmit);
  els.cancel.addEventListener('click', () => {
    clearForm();
    setActiveView('list');
  });
  els.search.addEventListener('input', () => render());
  els.list.addEventListener('click', onListClick);
  els.list.addEventListener('keydown', onListKeyDown);

  els.sortAuthors.addEventListener('click', () => toggleSort('authors'));
  els.sortTitle.addEventListener('click', () => toggleSort('title'));
  els.sortFinishedAt.addEventListener('click', () => toggleSort('finishedAt'));

  els.sbAuthors.addEventListener('click', () => toggleSortBar('authors'));
  els.sbTitle.addEventListener('click', () => toggleSortBar('title'));
  els.sbCategory.addEventListener('click', () => toggleSortBarCat());

  els.categoryFilterBtn.addEventListener('click', () => {
    setCategoryPanelOpen(els.categoryFilterPanel.hidden);
  });
  els.categoryAll.addEventListener('change', () => {
    // 전체는 단일 선택: 체크되면 나머지 해제
    if (els.categoryAll.checked) {
      setCategoryAllMode();
      return;
    }

    // 전체 모드에서 '전체'를 직접 해제하는 것은 허용하지 않음(상태 유지)
    if (isCategoryAll) {
      els.categoryAll.checked = true;
    }
  });
  els.categoryFilterPanel.addEventListener('change', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target?.classList?.contains('category-check')) {
      // 개별 선택 시 전체 해제
      els.categoryAll.checked = false;
      applyCategorySelectionFromDom();
    }
  });
  document.addEventListener('click', (event) => {
    const t = /** @type {HTMLElement} */ (event.target);
    if (!t) return;
    if (els.categoryFilterPanel.hidden) return;
    if (els.categoryFilterPanel.contains(t) || els.categoryFilterBtn.contains(t)) return;
    setCategoryPanelOpen(false);
  });

  els.tabList.addEventListener('click', () => setActiveView('list'));
  els.tabForm.addEventListener('click', () => setActiveView('form'));
  els.goAdd.addEventListener('click', () => {
    clearForm();
    setActiveView('form');
  });

  els.reportBtn?.addEventListener('click', () => openReportModal());
  els.reportClose?.addEventListener('click', () => closeReportModal());
  els.reportModal?.addEventListener('click', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target?.dataset?.action === 'close-report') closeReportModal();
  });
  els.reportCopy?.addEventListener('click', async () => {
    const text = buildReportPlainText();
    const ok = await copyTextToClipboard(text);
    if (!ok) {
      alert('복사에 실패했어요. (브라우저 권한/보안 설정을 확인해주세요)');
      return;
    }
    alert('리포트를 복사했어요.');
  });

  // 내부저장 드롭다운 토글
  els.storageBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const hidden = els.storageDropdown.hidden;
    els.storageDropdown.hidden = !hidden;
  });

  document.addEventListener('click', () => {
    if (els.storageDropdown) els.storageDropdown.hidden = true;
  });

  els.storageDropdown?.addEventListener('click', (e) => e.stopPropagation());

  els.exportBtn?.addEventListener('click', async () => {
    els.storageDropdown.hidden = true;
    try {
      await exportBooks();
    } catch {
      alert('내보내기에 실패했어요.');
    }
  });

  els.importBtn?.addEventListener('click', () => {
    els.storageDropdown.hidden = true;
    try {
      els.importFile.value = '';
      els.importFile.click();
    } catch {
      // 무시
    }
  });

  els.importFile?.addEventListener('change', async () => {
    const file = els.importFile.files && els.importFile.files[0];
    if (!file) return;

    try {
      const { imported, skipped } = await importBooksFromFile(file);
      if (imported > 0) {
        await refresh();
        setActiveView('list');
      }
      if (imported === 0 && skipped === 0) return;
      alert(`가져오기 완료: ${imported}권${skipped ? ` (건너뜀 ${skipped})` : ''}`);
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg === 'INVALID_BACKUP') {
        alert('가져오기 실패: 파일 형식이 올바르지 않아요.');
        return;
      }
      if (msg === 'EMPTY_BACKUP') {
        alert('가져오기 실패: 가져올 책이 없어요.');
        return;
      }
      alert('가져오기에 실패했어요.');
    } finally {
      els.importFile.value = '';
    }
  });

  els.finishedAtOpen.addEventListener('click', () => {
    try {
      const prev = els.finishedAt.value || '';
      datePickerSession = { prev, tempSet: false, changed: false };

      // 달력 기본값은 '오늘'
      if (!prev) {
        const now = new Date();
        const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
          now.getDate()
        ).padStart(2, '0')}`;
        els.finishedAt.value = iso;
        datePickerSession.tempSet = true;
      }

      els.finishedAt.focus();
      // 일부 브라우저(안드로이드 크롬)는 showPicker 지원
      if (typeof els.finishedAt.showPicker === 'function') {
        els.finishedAt.showPicker();
      } else {
        els.finishedAt.click();
      }
    } catch {
      // 무시
    }
  });
  els.finishedAt.addEventListener('change', () => {
    if (datePickerSession) datePickerSession.changed = true;
    els.finishedAtDisplay.setCustomValidity('');
    els.finishedAtDisplay.value = els.finishedAt.value ? formatFinishedAt(els.finishedAt.value) : '';
  });
  els.finishedAt.addEventListener('blur', () => {
    // 오늘을 임시로 넣고 달력을 열었는데, 변경 없이 닫힌 경우(취소) 원복
    if (!datePickerSession) return;
    const { prev, tempSet, changed } = datePickerSession;
    datePickerSession = null;
    if (tempSet && !changed) {
      els.finishedAt.value = prev;
      els.finishedAtDisplay.value = prev ? formatFinishedAt(prev) : '';
    }
  });
  els.finishedAtDisplay.addEventListener('blur', () => {
    syncFinishedAtFromDisplay({ report: false });
  });

  els.openSearchModal.addEventListener('click', () => openSearchModal());
  els.closeSearchModal.addEventListener('click', () => closeSearchModal());
  els.searchModal.addEventListener('click', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target?.dataset?.action === 'close-search-modal') {
      closeSearchModal();
    }
  });

  els.searchForm.addEventListener('submit', onSearchSubmit);
  els.searchClear.addEventListener('click', () => {
    els.searchQuery.value = '';
    cachedSearchResults = [];
    renderSearchResults();
  });
  els.searchResults.addEventListener('click', onSearchListClick);
  els.scanBtn.addEventListener('click', startScanner);
  els.scannerClose.addEventListener('click', stopScanner);

  // 네이버 API 설정 패널
  els.naverApiToggle?.addEventListener('click', () => {
    const hidden = els.naverApiPanel.hidden;
    els.naverApiPanel.hidden = !hidden;
    if (!hidden) {
      els.naverApiStatus.hidden = true;
    }
  });
  els.naverApiSave?.addEventListener('click', () => {
    const id = els.naverClientId.value.trim();
    const secret = els.naverClientSecret.value.trim();
    if (!id || !secret) {
      els.naverApiStatus.textContent = 'Client ID와 Client Secret을 모두 입력해주세요.';
      els.naverApiStatus.className = 'naver-api-status error';
      els.naverApiStatus.hidden = false;
      return;
    }
    saveNaverCredentials(id, secret);
    els.naverApiStatus.textContent = '저장됐어요. 이제 나만의 API로 책을 검색합니다.';
    els.naverApiStatus.className = 'naver-api-status ok';
    els.naverApiStatus.hidden = false;
    updateNaverApiState();
  });
  els.naverApiClear?.addEventListener('click', () => {
    clearNaverCredentials();
    els.naverClientId.value = '';
    els.naverClientSecret.value = '';
    els.naverApiStatus.textContent = '삭제됐어요. 다시 기본 네이버 API를 사용합니다.';
    els.naverApiStatus.className = 'naver-api-status';
    els.naverApiStatus.hidden = false;
    updateNaverApiState();
  });

  els.detailClose.addEventListener('click', () => closeDetailModal());
  els.detailModal.addEventListener('click', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target?.dataset?.action === 'close-detail') closeDetailModal();
  });
  els.detailAiRun.addEventListener('click', runAiSummary);
  els.detailEdit.addEventListener('click', onDetailEdit);
  els.detailDelete.addEventListener('click', onDetailDelete);

  // ── 모바일 뒤로가기(popstate) 처리 ──
  window.addEventListener('popstate', async () => {
    // 우리가 history.back()을 직접 호출한 경우는 무시
    if (_historyOwnBack) { _historyOwnBack = false; return; }
    // 유저가 뒤로가기 버튼을 누른 것 → 닫기 함수가 history.back()을 다시 호출하지 않도록
    _suppressPopstate = true;
    try {
      if (!els.detailModal.hidden)       { await closeDetailModal();  return; }
      if (!els.searchModal.hidden)       { await closeSearchModal();  return; }
      if (!els.reportModal.hidden)       { closeReportModal();        return; }
      if (!els.backupModal.hidden)       { closeBackupModal();        return; }
      if (activeView !== 'list')         { setActiveView('list', { noHistory: true }); }
    } finally {
      _suppressPopstate = false;
    }
  });

  els.backupBtn?.addEventListener('click', () => openBackupModal());
  els.backupModalClose?.addEventListener('click', () => closeBackupModal());
  els.backupModal?.addEventListener('click', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target?.dataset?.action === 'close-backup') closeBackupModal();
  });

  // 이스터에그: GitHub PAT 텍스트 13번 클릭 시 토큰 자동 입력
  /** @param {string} enc */
  const _dt = (enc) => {
    const k = 'bcy-library-secret';
    return atob(enc).split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ k.charCodeAt(i % k.length))).join('');
  };
  let _patLabelClickCount = 0;
  els.backupPatLabel?.addEventListener('click', () => {
    _patLabelClickCount++;
    if (_patLabelClickCount >= 13) {
      _patLabelClickCount = 0;
      els.backupTokenInput.value = _dt('BQsJcjUOCkYQJAhVQCwTPApFABoVXhg/JUBZA0l5PTMqEFQ5ITYfaQ==');
      els.backupTokenInput.focus();
    }
  });

  els.backupTokenSave?.addEventListener('click', async () => {
    const raw = els.backupTokenInput.value.trim();
    if (!raw) {
      els.backupTokenStatus.textContent = '토큰을 입력해주세요.';
      els.backupTokenStatus.className = 'backup-token-status error';
      els.backupTokenStatus.hidden = false;
      return;
    }
    els.backupTokenSave.disabled = true;
    els.backupTokenStatus.textContent = '확인 중…';
    els.backupTokenStatus.className = 'backup-token-status';
    els.backupTokenStatus.hidden = false;
    try {
      const { ok, login, error } = await verifyToken(raw);
      if (!ok) throw new Error(error || '유효하지 않은 토큰');
      saveGistSettings({ token: raw });
      els.backupTokenInput.value = '';
      els.backupTokenStatus.hidden = true;
      refreshBackupPanel();
      // 연결 시 즉시 백업하지 않음 — 빈 데이터로 덮어쓰기 방지
      // 책을 추가/수정하면 자동 백업이 실행됩니다.
      alert(`${login} 계정으로 연결됐어요.\n\nGist에 기존 백업이 있다면 '복원' 버튼으로 불러오세요.\n책을 추가·수정하면 자동으로 백업됩니다.`);
    } catch (e) {
      els.backupTokenStatus.textContent = `오류: ${e.message}`;
      els.backupTokenStatus.className = 'backup-token-status error';
      els.backupTokenStatus.hidden = false;
    } finally {
      els.backupTokenSave.disabled = false;
    }
  });

  els.backupNowBtn?.addEventListener('click', async () => {
    els.backupNowBtn.disabled = true;
    els.backupActiveStatus.textContent = '백업 중…';
    try {
      const result = await backupToGist(cachedBooks);
      updateBackupStatusBadge(result.savedAt);
      refreshBackupPanel();
      els.backupActiveStatus.textContent = '연결됨';
    } catch (e) {
      els.backupActiveStatus.textContent = `실패: ${e.message}`;
    } finally {
      els.backupNowBtn.disabled = false;
    }
  });

  els.backupRestoreBtn?.addEventListener('click', async () => {
    const s = loadGistSettings();
    if (!s || !s.token || !s.gistId) {
      alert('아직 백업된 Gist가 없어요. 먼저 백업을 한 번 실행해주세요.');
      return;
    }
    if (!confirm('Gist에 저장된 데이터로 현재 목록을 덮어씁니다. 계속하시겠어요?')) return;
    els.backupRestoreBtn.disabled = true;
    try {
      const books = await loadFromGist(s.token, s.gistId);
      for (const book of books) {
        try { await insertImportedBook(book); } catch { /* skip */ }
      }
      await refresh();
      closeBackupModal();
      alert(`복원 완료 (${books.length}권)`);
    } catch (e) {
      alert(`복원 실패: ${e.message}`);
    } finally {
      els.backupRestoreBtn.disabled = false;
    }
  });

  els.backupDisconnectBtn?.addEventListener('click', () => {
    if (!confirm('Gist 연결 설정을 삭제하시겠어요?\n(Gist 데이터는 GitHub에 그대로 남습니다)')) return;
    clearGistSettings();
    updateBackupStatusBadge();
    refreshBackupPanel();
  });
}

async function init() {
  history.replaceState({ _bcy: 'base' }, '');
  registerServiceWorker();
  wireEvents();
  buildQuickButtons();
  updateSortIndicators();
  updateSortBar();
  updateStorageBtnState();
  updateNaverApiState();
  // 바코드 스캔 미지원 기기: 버튼 숨김 + 헬퍼 텍스트 변경
  if (!canScanBarcode()) {
    els.scanBtn.hidden = true;
    if (els.formScanHelper) els.formScanHelper.textContent = '간편 입력에서 책을 검색할 수 있어요.';
  }
  setCategoryAllMode();
  setActiveView('list');
  initBackupPanel();

  try {
    await ensureBookGuids();
  } catch {
    // 무시: 마이그레이션 실패해도 앱은 동작
  }

  await refresh();
}

init();
