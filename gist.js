// ── GitHub Gist 자동 백업 모듈 ──────────────────────────────
// PAT와 Gist ID를 localStorage에 보관합니다.
// PAT는 "Gist 권한(gist scope)"만 부여된 Fine-grained/Classic PAT를 사용하세요.

const LS_KEY = 'bcy_gist_settings';
const GIST_FILENAME = 'bcy-library-backup.json';
const API = 'https://api.github.com';

/** @returns {{ token: string, gistId: string, lastAt: string } | null} */
export function loadGistSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v.token !== 'string') return null;
    return v;
  } catch {
    return null;
  }
}

/** @param {{ token: string, gistId: string, lastAt: string }} s */
export function saveGistSettings(s) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

export function clearGistSettings() {
  localStorage.removeItem(LS_KEY);
}

/**
 * Gist가 없으면 새로 만들고 ID를 반환합니다.
 * @param {string} token
 * @param {string} content  JSON 문자열
 * @returns {Promise<string>} gist id
 */
async function createGist(token, content) {
  const res = await fetch(`${API}/gists`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      description: 'B.CY Library 자동 백업',
      public: false,
      files: { [GIST_FILENAME]: { content } }
    })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`GIST_CREATE_FAILED:${res.status}:${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.id;
}

/**
 * 기존 Gist를 업데이트합니다.
 * @param {string} token
 * @param {string} gistId
 * @param {string} content  JSON 문자열
 */
async function updateGist(token, gistId, content) {
  const res = await fetch(`${API}/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: { [GIST_FILENAME]: { content } }
    })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`GIST_UPDATE_FAILED:${res.status}:${txt.slice(0, 200)}`);
  }
}

/**
 * Gist에서 책 데이터를 불러옵니다.
 * @param {string} token
 * @param {string} gistId
 * @returns {Promise<any>} 파싱된 JSON
 */
export async function loadFromGist(token, gistId) {
  const res = await fetch(`${API}/gists/${gistId}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`GIST_LOAD_FAILED:${res.status}:${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = data?.files?.[GIST_FILENAME]?.content;
  if (!raw) throw new Error('GIST_FILE_NOT_FOUND');
  return JSON.parse(raw);
}

/**
 * PAT가 유효한지, gist 권한이 있는지 확인합니다.
 * @param {string} token
 * @returns {Promise<{ ok: boolean, login: string, error?: string }>}
 */
export async function verifyToken(token) {
  try {
    const res = await fetch(`${API}/user`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (!res.ok) return { ok: false, login: '', error: `HTTP ${res.status}` };
    const data = await res.json();
    // Fine-grained PAT는 x-oauth-scopes 헤더가 없을 수도 있으므로 로그인만 확인
    return { ok: true, login: data.login || '' };
  } catch (e) {
    return { ok: false, login: '', error: String(e) };
  }
}

/**
 * 책 목록을 Gist에 저장합니다. Gist가 없으면 생성합니다.
 * @param {any[]} books
 * @returns {Promise<{ gistId: string, savedAt: string }>}
 */
export async function backupToGist(books) {
  const s = loadGistSettings();
  if (!s?.token) throw new Error('GIST_NOT_CONFIGURED');

  const payload = JSON.stringify(
    { app: 'B.CY Library', version: 1, exportedAt: new Date().toISOString(), books },
    null,
    2
  );

  let { gistId } = s;
  if (!gistId) {
    gistId = await createGist(s.token, payload);
  } else {
    try {
      await updateGist(s.token, gistId, payload);
    } catch (e) {
      // Gist가 삭제됐을 수 있으니 재생성
      if (String(e).includes('404')) {
        gistId = await createGist(s.token, payload);
      } else {
        throw e;
      }
    }
  }

  const savedAt = new Date().toISOString();
  saveGistSettings({ ...s, gistId, lastAt: savedAt, lastCount: books.length });
  return { gistId, savedAt };
}
