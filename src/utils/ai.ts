import type { AiGraphSpec, ChatMessage } from '../types';
import { apiUrl, fetchBackendHealth } from './backend';

/** пресеты больше не нужны на клиенте — провайдер настраивается в backend/.env */

export async function askAi(
  history: ChatMessage[],
  userText: string,
  graphContext: string,
): Promise<string> {
  const health = await fetchBackendHealth();
  if (!health) {
    throw new Error(
      'Локальный режим: backend не запущен. AI доступен только онлайн — `npm run backend` (нужен AI_API_KEY в backend/.env).',
    );
  }
  if (!health.ai) {
    throw new Error(
      'Backend онлайн, но AI не настроен: задайте AI_API_KEY в backend/.env и перезапустите сервер.',
    );
  }

  let res: Response;
  try {
    res = await fetch(apiUrl('/api/ai/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        graph_context: graphContext,
        history: history.slice(-8).map((m) => ({
          role: m.role,
          content: m.text.slice(0, 1500),
        })),
      }),
    });
  } catch {
    throw new Error('Не удалось связаться с backend. Проверьте, что API запущен на :8000.');
  }

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = typeof data?.detail === 'string' ? data.detail : '';
    } catch {
      /* ignore */
    }
    if (res.status === 503) {
      throw new Error(detail || 'AI на сервере не настроен.');
    }
    if (res.status === 429) {
      throw new Error(detail || 'Лимит AI исчерпан — подождите.');
    }
    throw new Error(detail || `Backend ответил ошибкой ${res.status}.`);
  }

  const data = await res.json().catch(() => null);
  const content: unknown = data?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Backend вернул пустой ответ AI.');
  }
  return content;
}

/** вытащить JSON-граф из ответа модели */
export function extractGraphSpec(text: string): { reply: string; graph: AiGraphSpec | null } {
  const candidates: string[] = [];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) candidates.push(fence[1].trim());
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  candidates.push(text.trim());

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      const spec = normalizeSpec(parsed);
      if (spec) {
        const reply =
          typeof parsed?.reply === 'string' && parsed.reply.trim()
            ? parsed.reply.trim()
            : 'Граф сгенерирован — примените его кнопками ниже.';
        return { reply, graph: spec };
      }
    } catch {
      /* next */
    }
  }
  return { reply: text, graph: null };
}

function normalizeSpec(raw: any): AiGraphSpec | null {
  const g = raw?.graph ?? (Array.isArray(raw?.nodes) ? raw : null);
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.links)) return null;

  const nodes = g.nodes
    .filter((n: any) => n && (typeof n.label === 'string' || typeof n.id === 'string'))
    .map((n: any, i: number) => ({
      id: String(n.id ?? `n${i + 1}`),
      label: String(n.label ?? n.id ?? `Узел ${i + 1}`).slice(0, 60),
      group: typeof n.group === 'string' && n.group.trim() ? n.group.trim().slice(0, 40) : 'AI',
      size: typeof n.size === 'number' && n.size >= 2 && n.size <= 30 ? n.size : undefined,
      color: typeof n.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(n.color) ? n.color : undefined,
    }));
  if (nodes.length === 0) return null;

  const ids = new Set(nodes.map((n: { id: string }) => n.id));
  const kinds = new Set(['связь', 'зависимость', 'поток']);
  const links = g.links
    .filter((l: any) => l && ids.has(String(l.source)) && ids.has(String(l.target)))
    .map((l: any) => ({
      source: String(l.source),
      target: String(l.target),
      kind: kinds.has(l.kind) ? l.kind : 'связь',
      label: typeof l.label === 'string' ? l.label.slice(0, 60) : undefined,
    }));

  return { nodes, links } as AiGraphSpec;
}
