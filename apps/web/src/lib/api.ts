/** Thin fetch client: relative /api/v1, cookies, CSRF header, Persian error messages. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

let csrfToken: string | null = null;
export const setCsrf = (t: string | null) => { csrfToken = t; };

async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  const r = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' });
  if (r.ok) csrfToken = (await r.json()).csrfToken;
  return csrfToken;
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (method !== 'GET') {
    const t = await ensureCsrf();
    if (t) headers['X-CSRF-Token'] = t;
  }
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { method, headers, body, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'NETWORK', 'ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید');
  }
  if (res.status === 403) {
    const err = await res.clone().json().catch(() => null);
    if (err?.error?.code === 'CSRF') csrfToken = null;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new ApiError(res.status, err?.error?.code ?? 'ERROR', err?.error?.message ?? 'خطای غیرمنتظره رخ داد');
  }
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('application/json') ? res.json() : (res.blob() as unknown)) as Promise<T>;
}

