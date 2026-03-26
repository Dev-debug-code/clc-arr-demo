const args = process.argv.slice(2);

function readArg(flag) {
  const idx = args.findIndex((arg) => arg === flag);
  if (idx < 0) return '';
  return String(args[idx + 1] || '').trim();
}

const baseUrlRaw =
  readArg('--base-url') ||
  process.env.API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  'http://localhost:8000';
const baseUrl = baseUrlRaw.replace(/\/+$/, '');
const token = readArg('--token') || process.env.API_BEARER_TOKEN || '';
const providedCaseId = readArg('--case-id') || process.env.CASE_ID || '';
const checkExport = args.includes('--check-export');

function printResult(label, ok, details = '') {
  const marker = ok ? 'OK  ' : 'FAIL';
  if (details) {
    console.log(`${marker} ${label} - ${details}`);
  } else {
    console.log(`${marker} ${label}`);
  }
}

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers
  });
  return response;
}

async function parseJsonSafe(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function run() {
  console.log(`Smoke target: ${baseUrl}`);
  if (token) {
    console.log('Auth: Bearer token supplied');
  } else {
    console.log('Auth: no bearer token supplied');
  }

  let resolvedCaseId = providedCaseId;

  // 1) GET /cases
  try {
    const res = await request('/cases');
    const payload = await parseJsonSafe(res);
    if (!res.ok) {
      printResult('GET /cases', false, `HTTP ${res.status}`);
      process.exitCode = 1;
      return;
    }
    const cases = Array.isArray(payload?.cases) ? payload.cases : [];
    if (!resolvedCaseId && cases.length > 0) {
      resolvedCaseId = String(cases[0]?.id || '').trim();
    }
    printResult('GET /cases', true, `${cases.length} case(s)`);
  } catch (error) {
    printResult('GET /cases', false, error?.message || 'Request failed');
    process.exitCode = 1;
    return;
  }

  if (!resolvedCaseId) {
    printResult('Case resolution', false, 'No case id supplied and /cases returned no ids');
    process.exitCode = 1;
    return;
  }
  printResult('Case resolution', true, `using case_id=${resolvedCaseId}`);

  const encodedCaseId = encodeURIComponent(resolvedCaseId);

  // 2) GET /cases/{case_id}
  try {
    const res = await request(`/cases/${encodedCaseId}`);
    const payload = await parseJsonSafe(res);
    if (!res.ok) {
      printResult('GET /cases/{case_id}', false, `HTTP ${res.status}`);
      process.exitCode = 1;
    } else {
      const documentCount = Array.isArray(payload?.documents) ? payload.documents.length : 0;
      const codeAreaCount = Array.isArray(payload?.code_areas) ? payload.code_areas.length : 0;
      printResult('GET /cases/{case_id}', true, `${documentCount} docs, ${codeAreaCount} code areas`);
    }
  } catch (error) {
    printResult('GET /cases/{case_id}', false, error?.message || 'Request failed');
    process.exitCode = 1;
  }

  // 3) POST /cases/{case_id}/search
  try {
    const res = await request(`/cases/${encodedCaseId}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: 'aml' })
    });
    const payload = await parseJsonSafe(res);
    if (!res.ok) {
      printResult('POST /cases/{case_id}/search', false, `HTTP ${res.status}`);
      process.exitCode = 1;
    } else {
      const rows = Array.isArray(payload?.results)
        ? payload.results
        : Array.isArray(payload?.matches)
          ? payload.matches
          : [];
      printResult('POST /cases/{case_id}/search', true, `${rows.length} result(s)`);
    }
  } catch (error) {
    printResult('POST /cases/{case_id}/search', false, error?.message || 'Request failed');
    process.exitCode = 1;
  }

  // 4) Optional report export probe (read-only)
  if (checkExport) {
    try {
      const res = await request(`/cases/${encodedCaseId}/report/export?format=pdf`);
      if (!res.ok) {
        printResult('GET /cases/{case_id}/report/export?format=pdf', false, `HTTP ${res.status}`);
        process.exitCode = 1;
      } else {
        const contentType = String(res.headers.get('content-type') || '').toLowerCase();
        printResult('GET /cases/{case_id}/report/export?format=pdf', true, contentType || 'unknown content-type');
      }
    } catch (error) {
      printResult('GET /cases/{case_id}/report/export?format=pdf', false, error?.message || 'Request failed');
      process.exitCode = 1;
    }
  }

  if (process.exitCode === 1) {
    console.log('Smoke run finished with failures.');
  } else {
    console.log('Smoke run finished successfully.');
  }
}

void run();
