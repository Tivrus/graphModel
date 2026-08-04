/** База API: в dev — через Vite proxy; в Electron/prod — localhost:8000 */

export type BackendHealth = {
  ok: boolean;
  mode: 'online';
  ai: boolean;
  provider?: string | null;
  model?: string | null;
};

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const envBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
  if (envBase) return `${envBase}${p}`;

  // Vite dev: proxy /api → backend
  if (import.meta.env.DEV) return p;

  // Electron / preview / file://
  return `http://127.0.0.1:8000${p}`;
}

export async function fetchBackendHealth(timeoutMs = 1800): Promise<BackendHealth | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl('/api/health'), { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as BackendHealth;
    return data?.ok ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
