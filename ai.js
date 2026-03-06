// API 키는 config.js 에서 읽습니다.
// config.js는 .gitignore에 등록되어 깃/GitHub에 업로드되지 않습니다.
// config.example.js 를 복사해 config.js 로 만들고 새 API 키를 넣으세요.
let GEMINI_API_KEY = '';
try {
  const cfg = await import('./config.js');
  GEMINI_API_KEY = String(cfg.GEMINI_API_KEY || '').trim();
} catch {
  // config.js 없음 — AI 요약 기능이 비활성화됩니다.
}

// 우선 시도할 모델(404가 나면 자동으로 사용 가능한 모델을 찾아 재시도합니다)
const GEMINI_MODEL = 'gemini-2.5-flash';

function stripModelPrefix(name) {
  const n = String(name || '').trim();
  return n.startsWith('models/') ? n.slice('models/'.length) : n;
}

async function listModels(apiKey) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
    method: 'GET',
    headers: {
      'X-goog-api-key': apiKey
    }
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const models = Array.isArray(data?.models) ? data.models : [];
  return models;
}

function pickFallbackModel(models) {
  const cleaned = Array.isArray(models) ? models : [];
  const candidates = cleaned
    .filter((m) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => ({
      id: stripModelPrefix(m?.name || ''),
      name: String(m?.name || ''),
      displayName: String(m?.displayName || ''),
      description: String(m?.description || '')
    }))
    .filter((m) => m.id);

  // 우선순위: flash 계열 > gemini 일반 > 그 외
  const flash = candidates.find((m) => /gemini/i.test(m.id) && /flash/i.test(m.id));
  if (flash) return flash.id;
  const gemini = candidates.find((m) => /gemini/i.test(m.id) && !/embed|embedding/i.test(m.id));
  if (gemini) return gemini.id;
  return candidates[0]?.id || '';
}

async function generateContent({ apiKey, modelId, prompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;

  /** @type {any} */
  const generationConfig = {
    temperature: 0.3,
    maxOutputTokens: 768
  };

  // gemini-2.5-* 계열은 "thoughtsTokenCount"(thinking)로 토큰을 많이 소모할 수 있어,
  // 짧은 출력도 MAX_TOKENS로 잘리는 경우가 있습니다. 가능하면 thinking을 꺼서 안정화합니다.
  if (/\b2\.5\b/.test(String(modelId))) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig
    })
  });

  return res;
}

/**
 * 서버 없이(정적) 동작: Gemini API를 브라우저에서 직접 호출합니다.
 * @param {{title:string,authors:string,categoryLabel:string}} input
 * @returns {Promise<string>}
 */
export async function summarizeWithGemini(input) {
  const apiKey = String(GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'PASTE_GEMINI_API_KEY_HERE') throw new Error('GEMINI_API_KEY_MISSING');

  const prompt = [
    '아래 정보로 책에 대한 간단한 요약을 한국어로 2~4문장으로 작성해줘.',
    '내용을 모르면 추측하지 말고, 제목/저자 기반으로만 말해줘.',
    '출력은 끊김 없이 완성된 문장만, 400자 이내로.',
    '',
    `제목: ${input.title}`,
    `저자: ${input.authors || '알 수 없음'}`,
    `분류: ${input.categoryLabel}`
  ].join('\n');

  let modelId = stripModelPrefix(GEMINI_MODEL);
  let res = await generateContent({ apiKey, modelId, prompt });

  // 404면 모델명이 틀렸을 가능성이 높아서, 사용 가능한 모델을 조회해 1회 자동 재시도
  if (res.status === 404) {
    const models = await listModels(apiKey);
    const fallback = pickFallbackModel(models);
    if (fallback && fallback !== modelId) {
      modelId = fallback;
      res = await generateContent({ apiKey, modelId, prompt });
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI_REQUEST_FAILED:${res.status}:${text.slice(0, 200)}`);
  }

  const data = await res.json().catch(() => null);
  const cand = data?.candidates?.[0];
  const parts = cand?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p) => p?.text || '').join('') : '';
  const out = String(text || '').trim();

  const finishReason = String(cand?.finishReason || '').trim();
  if (finishReason === 'MAX_TOKENS') {
    // 1회 재요청: 같은 정보로 "끊김 없는 2~4문장"만 다시 받기
    const retryPrompt = `${prompt}\n\n위 정보를 바탕으로, 끊김 없이 완성된 2~4문장 요약만 다시 출력해.`;
    const retryRes = await generateContent({ apiKey, modelId, prompt: retryPrompt });
    if (retryRes.ok) {
      const retryData = await retryRes.json().catch(() => null);
      const retryCand = retryData?.candidates?.[0];
      const retryParts = retryCand?.content?.parts;
      const retryText = Array.isArray(retryParts) ? retryParts.map((p) => p?.text || '').join('') : '';
      const retryOut = String(retryText || '').trim();
      if (retryOut) return retryOut;
    }

    // 그래도 실패하면 첫 응답이라도 반환(빈 문자열이면 아래에서 처리)
  }

  return out;
}
