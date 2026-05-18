const REGGIE_RUNTIME_BASE_URL =
  'https://us-central1-aiplatform.googleapis.com/v1/projects/clc-dev-485413/locations/us-central1/reasoningEngines/6070215130707132416';

export const REGGIE_RUNTIME_API_KEY_STORAGE_KEY = 'reggieRuntimeApiKey';

function buildHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey
  };
}

function safeText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function parseReggieSseBlock(rawBlock) {
  const normalizedBlock = rawBlock.replace(/\r/g, '').trim();
  if (!normalizedBlock) return null;

  const lines = normalizedBlock.split('\n');
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  const payload = dataLines.length > 0 ? dataLines.join('\n') : normalizedBlock;
  if (payload === '[DONE]') return null;

  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function extractRawJsonPayloads(buffer) {
  const payloads = [];
  let index = 0;
  const source = buffer.replace(/\r\n/g, '\n');

  while (index < source.length) {
    while (index < source.length && /\s/.test(source[index])) {
      index += 1;
    }

    if (index >= source.length) {
      return { payloads, remainder: '' };
    }

    const opening = source[index];
    if (opening !== '{' && opening !== '[') {
      return { payloads, remainder: source.slice(index) };
    }

    let depth = 0;
    let inString = false;
    let escaping = false;
    let endIndex = -1;

    for (let cursor = index; cursor < source.length; cursor += 1) {
      const char = source[cursor];

      if (inString) {
        if (escaping) {
          escaping = false;
        } else if (char === '\\') {
          escaping = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{' || char === '[') {
        depth += 1;
        continue;
      }

      if (char === '}' || char === ']') {
        depth -= 1;
        if (depth === 0) {
          endIndex = cursor + 1;
          break;
        }
      }
    }

    if (endIndex === -1) {
      return { payloads, remainder: source.slice(index) };
    }

    payloads.push(source.slice(index, endIndex));
    index = endIndex;
  }

  return { payloads, remainder: '' };
}

function parseReggieRuntimeError(status, bodyText) {
  const detail = safeText(bodyText);
  if (status === 401 || status === 403) {
    return 'Reggie access was denied. Check the Reggie access key.';
  }
  if (status === 429) {
    return 'Reggie is temporarily rate-limited. Try again in a moment.';
  }
  if (detail) {
    return `Reggie request failed: ${detail}`;
  }
  return 'Reggie is unavailable right now.';
}

function parseTrailingCitationLine(line) {
  const match = line.match(/^\[(\d+)\]\s+(.+?)\s+[—-]\s+["“](.+)["”]$/u);
  if (!match) return null;

  const [, nValue, source, quote] = match;
  const n = Number(nValue);
  if (!Number.isFinite(n)) return null;

  return {
    n,
    label: `[${n}]`,
    source: safeText(source),
    quote: safeText(quote)
  };
}

export function normalizeReggieCitations(citations = []) {
  return (Array.isArray(citations) ? citations : [])
    .map((citation, index) => {
      const n = Number(citation?.n);
      const fallbackNumber = index + 1;
      const nextNumber = Number.isFinite(n) && n > 0 ? n : fallbackNumber;
      const source = safeText(
        citation?.source ??
          citation?.document ??
          citation?.documentName ??
          citation?.document_name ??
          citation?.file ??
          citation?.filename ??
          citation?.findingId ??
          citation?.finding_id
      );
      return {
        n: nextNumber,
        label: `[${nextNumber}]`,
        source,
        quote: safeText(citation?.quote),
        documentId: safeText(citation?.documentId ?? citation?.document_id),
        findingId: safeText(citation?.findingId ?? citation?.finding_id)
      };
    })
    .filter((citation) => citation.source || citation.quote);
}

export function parseReggieTextAndCitations(text) {
  const cleanText = typeof text === 'string' ? text.trim() : '';
  if (!cleanText) {
    return { answerText: '', citations: [] };
  }

  const lines = cleanText.split(/\r?\n/);
  const citationLines = [];
  let index = lines.length - 1;

  while (index >= 0) {
    const current = lines[index].trim();
    if (!current) {
      if (citationLines.length === 0) {
        index -= 1;
        continue;
      }
      break;
    }

    const citation = parseTrailingCitationLine(current);
    if (!citation) break;
    citationLines.unshift(citation);
    index -= 1;
  }

  if (citationLines.length === 0) {
    return { answerText: cleanText, citations: [] };
  }

  const answerText = lines.slice(0, index + 1).join('\n').trim();
  return {
    answerText: answerText || cleanText,
    citations: normalizeReggieCitations(citationLines)
  };
}

export function isReggieAckText(text) {
  const normalized = safeText(text).toLowerCase();
  return (
    normalized === 'presented the inspection card.' ||
    normalized === 'presented the inspection view.' ||
    normalized === 'inspection view presented.' ||
    normalized === 'inspection presented.' ||
    normalized === 'proposed finding presented.'
  );
}

export function getStoredReggieRuntimeApiKey() {
  if (typeof window === 'undefined') return '';
  return safeText(window.localStorage.getItem(REGGIE_RUNTIME_API_KEY_STORAGE_KEY));
}

export function setStoredReggieRuntimeApiKey(value) {
  if (typeof window === 'undefined') return '';
  const cleanValue = safeText(value);
  if (!cleanValue) {
    window.localStorage.removeItem(REGGIE_RUNTIME_API_KEY_STORAGE_KEY);
    return '';
  }
  window.localStorage.setItem(REGGIE_RUNTIME_API_KEY_STORAGE_KEY, cleanValue);
  return cleanValue;
}

export function clearStoredReggieRuntimeApiKey() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(REGGIE_RUNTIME_API_KEY_STORAGE_KEY);
}

export async function createReggieRuntimeSession({ apiKey, userId = 'demo-user' }) {
  const response = await fetch(`${REGGIE_RUNTIME_BASE_URL}:query`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      class_method: 'async_create_session',
      input: { user_id: userId }
    })
  });

  if (!response.ok) {
    throw new Error(parseReggieRuntimeError(response.status, await response.text()));
  }

  const payload = await response.json();
  const sessionId = safeText(payload?.output?.id);
  if (!sessionId) {
    throw new Error('Reggie did not return a session id.');
  }
  return sessionId;
}

export async function* streamReggieRuntimeQuery({ apiKey, userId = 'demo-user', sessionId, message }) {
  const response = await fetch(`${REGGIE_RUNTIME_BASE_URL}:streamQuery?alt=sse`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      class_method: 'async_stream_query',
      input: {
        user_id: userId,
        session_id: sessionId,
        message
      }
    })
  });

  if (!response.ok) {
    throw new Error(parseReggieRuntimeError(response.status, await response.text()));
  }

  if (!response.body) {
    throw new Error('Reggie stream was unavailable.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    if (buffer.includes('data:')) {
      const normalized = buffer.replace(/\r\n/g, '\n');
      const blocks = normalized.split('\n\n');
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        const event = parseReggieSseBlock(block);
        if (event) yield event;
      }
    } else {
      const { payloads, remainder } = extractRawJsonPayloads(buffer);
      buffer = remainder;
      for (const payload of payloads) {
        const event = parseReggieSseBlock(payload);
        if (event) yield event;
      }
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const finalEvent = parseReggieSseBlock(buffer);
    if (finalEvent) yield finalEvent;
  }
}
