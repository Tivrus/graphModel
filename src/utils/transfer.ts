import type { GraphLink, GraphNode, LinkKind, SceneImage } from '../types';

/**
 * Чистый формат GraphModel v2
 *
 * {
 *   "format": "graphmodel",
 *   "version": 2,
 *   "exportedAt": "ISO-8601",
 *   "graph": {
 *     "nodes": [{ "id", "label", "group", "size?", "color?", "parentId?", "metadata?", "x?", "y?", "z?", "fx?", "fy?", "fz?" }],
 *     "links": [{ "id", "source", "target", "kind?", "label?" }]
 *   },
 *   "state": {
 *     "collapsedGroups": [],
 *     "expandedNodes": []
 *   },
 *   "images": [{ "id", "name", "dataUrl", "x", "y", "z", "scale", "opacity" }]  // опционально
 * }
 */

export const GRAPH_FORMAT = 'graphmodel' as const;
export const GRAPH_VERSION = 2;

const idOf = (e: string | GraphNode): string => (typeof e === 'string' ? e : e.id);

export interface GraphFileV2 {
  format: typeof GRAPH_FORMAT;
  version: typeof GRAPH_VERSION;
  exportedAt?: string;
  graph: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  state: {
    collapsedGroups: string[];
    expandedNodes: string[];
  };
  images?: SceneImage[];
}

/** результат парсинга (совместим со старым импортом) */
export interface GraphFile {
  version: number;
  exportedAt?: string;
  nodes: GraphNode[];
  links: GraphLink[];
  collapsedGroups?: string[];
  expandedNodes?: string[];
  images?: SceneImage[];
}

const KINDS = new Set<LinkKind>(['связь', 'зависимость', 'поток']);

function cleanNode(n: GraphNode): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: n.id,
    label: n.label,
    group: n.group,
  };
  if (n.size != null) out.size = n.size;
  if (n.color) out.color = n.color;
  if (n.parentId) out.parentId = n.parentId;
  if (n.metadata && Object.keys(n.metadata).length) out.metadata = { ...n.metadata };
  if (n.x != null) out.x = n.x;
  if (n.y != null) out.y = n.y;
  if (n.z != null) out.z = n.z;
  if (n.fx != null) out.fx = n.fx;
  if (n.fy != null) out.fy = n.fy;
  if (n.fz != null) out.fz = n.fz;
  return out;
}

function cleanLink(l: GraphLink): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: l.id,
    source: idOf(l.source),
    target: idOf(l.target),
  };
  if (l.kind && l.kind !== 'связь') out.kind = l.kind;
  if (l.label) out.label = l.label;
  return out;
}

function cleanImage(img: SceneImage): Record<string, unknown> {
  return {
    id: img.id,
    name: img.name,
    dataUrl: img.dataUrl,
    x: img.x,
    y: img.y,
    z: img.z,
    scale: img.scale,
    opacity: img.opacity,
  };
}

export function serializeGraph(
  nodes: GraphNode[],
  links: GraphLink[],
  collapsedGroups: string[],
  expandedNodes: string[],
  images: SceneImage[] = [],
): string {
  const doc: Record<string, unknown> = {
    format: GRAPH_FORMAT,
    version: GRAPH_VERSION,
    exportedAt: new Date().toISOString(),
    graph: {
      nodes: nodes.filter((n) => !n.isCluster).map(cleanNode),
      links: links.map(cleanLink),
    },
    state: {
      collapsedGroups: [...collapsedGroups],
      expandedNodes: [...expandedNodes],
    },
  };
  if (images.length) doc.images = images.map(cleanImage);
  return JSON.stringify(doc, null, 2);
}

export function downloadText(filename: string, text: string): void {
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

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const numOrNull = (v: unknown): number | null | undefined =>
  v === null ? null : typeof v === 'number' && Number.isFinite(v) ? v : undefined;

function parseNode(n: Record<string, unknown>, i: number): GraphNode {
  return {
    id: String(n.id ?? `n-${i + 1}`),
    label: String(n.label ?? `Узел ${i + 1}`),
    group: String(n.group ?? 'Импорт'),
    size: typeof n.size === 'number' ? n.size : 6,
    color: typeof n.color === 'string' ? n.color : undefined,
    metadata:
      n.metadata && typeof n.metadata === 'object'
        ? Object.fromEntries(
            Object.entries(n.metadata as Record<string, unknown>).map(([k, v]) => [
              String(k),
              String(v),
            ]),
          )
        : {},
    parentId: n.parentId != null ? String(n.parentId) : undefined,
    x: num(n.x),
    y: num(n.y),
    z: num(n.z),
    fx: numOrNull(n.fx),
    fy: numOrNull(n.fy),
    fz: numOrNull(n.fz),
  };
}

function parseLink(l: Record<string, unknown>, i: number, ids: Set<string>): GraphLink | null {
  const source = String(
    typeof l.source === 'object' && l.source !== null
      ? (l.source as { id?: unknown }).id
      : l.source,
  );
  const target = String(
    typeof l.target === 'object' && l.target !== null
      ? (l.target as { id?: unknown }).id
      : l.target,
  );
  if (!ids.has(source) || !ids.has(target) || source === target) return null;
  const kind = KINDS.has(l.kind as LinkKind) ? (l.kind as LinkKind) : 'связь';
  return {
    id: String(l.id ?? `l-${i + 1}`),
    source,
    target,
    label: l.label != null ? String(l.label) : undefined,
    kind,
  };
}

function parseImages(raw: unknown): SceneImage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((img): img is Record<string, unknown> => !!img && typeof img === 'object')
    .filter((img) => typeof img.dataUrl === 'string')
    .map((img, i) => ({
      id: String(img.id ?? `img-${i + 1}`),
      name: String(img.name ?? `image-${i + 1}`),
      dataUrl: String(img.dataUrl),
      x: num(img.x) ?? 0,
      y: num(img.y) ?? 0,
      z: num(img.z) ?? 0,
      scale: num(img.scale) ?? 34,
      opacity: num(img.opacity) ?? 1,
    }));
}

/** принимает v2 и старый плоский v1 */
export function parseGraphFile(text: string): GraphFile {
  const raw = JSON.parse(text) as Record<string, unknown>;
  if (!raw || typeof raw !== 'object') {
    throw new Error('Некорректный файл: ожидается JSON-объект');
  }

  // v2: { format, graph: { nodes, links }, state?, images? }
  const graphObj =
    raw.graph && typeof raw.graph === 'object'
      ? (raw.graph as Record<string, unknown>)
      : null;
  const nodesRaw = (graphObj?.nodes ?? raw.nodes) as unknown;
  const linksRaw = (graphObj?.links ?? raw.links) as unknown;

  if (!Array.isArray(nodesRaw) || !Array.isArray(linksRaw)) {
    throw new Error('Некорректный файл: нужны graph.nodes / graph.links (или nodes / links)');
  }

  const nodes = (nodesRaw as Array<Record<string, unknown>>).map(parseNode);
  const ids = new Set(nodes.map((n) => n.id));
  const links = (linksRaw as Array<Record<string, unknown>>)
    .map((l, i) => parseLink(l, i, ids))
    .filter((l): l is GraphLink => !!l);

  const state =
    raw.state && typeof raw.state === 'object'
      ? (raw.state as Record<string, unknown>)
      : raw;

  return {
    version: typeof raw.version === 'number' ? raw.version : GRAPH_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : undefined,
    nodes,
    links,
    collapsedGroups: Array.isArray(state.collapsedGroups)
      ? (state.collapsedGroups as string[]).map(String)
      : [],
    expandedNodes: Array.isArray(state.expandedNodes)
      ? (state.expandedNodes as string[]).map(String)
      : [],
    images: parseImages(raw.images),
  };
}

export async function readFileAsText(file: File): Promise<string> {
  return file.text();
}
