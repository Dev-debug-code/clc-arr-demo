import { getFirebaseAuth } from '../../config/firebase.js';

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
const STATIC_BEARER_TOKEN = String(import.meta.env.VITE_API_BEARER_TOKEN || '').trim();

function buildUrl(path) {
  if (!API_BASE_URL) {
    throw new Error('[api] Missing VITE_API_BASE_URL. Set it before using VITE_DATA_PROVIDER=api.');
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

async function buildAuthHeaders() {
  if (STATIC_BEARER_TOKEN) {
    return { Authorization: `Bearer ${STATIC_BEARER_TOKEN}` };
  }

  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return {};

  const token = await user.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function requestJson(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const authHeaders = await buildAuthHeaders();
  const requestHeaders = {
    ...authHeaders,
    ...headers
  };

  if (!isFormData && body !== undefined) {
    requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers: requestHeaders,
    body: isFormData ? body : body === undefined ? undefined : JSON.stringify(body),
    signal
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || `${response.status} ${response.statusText}`;
    const error = new Error(`[api] ${message}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function requestRaw(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const authHeaders = await buildAuthHeaders();
  const requestHeaders = {
    ...authHeaders,
    ...headers
  };

  if (!isFormData && body !== undefined) {
    requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers: requestHeaders,
    body: isFormData ? body : body === undefined ? undefined : JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }
    const message = payload?.message || payload?.error || `${response.status} ${response.statusText}`;
    const error = new Error(`[api] ${message}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return response;
}
