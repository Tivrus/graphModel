/** иерархия групп через путь «Родитель/Подгруппа/…» — глубина не ограничена */

export const GROUP_SEP = '/';

export function normalizeGroupPath(raw: string): string {
  return raw
    .split(GROUP_SEP)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(GROUP_SEP);
}

/** все префиксы пути: «A/B/C» → [«A», «A/B», «A/B/C»] */
export function groupPrefixes(group: string): string[] {
  const parts = normalizeGroupPath(group).split(GROUP_SEP).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) out.push(parts.slice(0, i + 1).join(GROUP_SEP));
  return out;
}

export function groupRoot(group: string): string {
  return normalizeGroupPath(group).split(GROUP_SEP)[0] || group;
}

export function groupLeaf(group: string): string {
  const parts = normalizeGroupPath(group).split(GROUP_SEP);
  return parts[parts.length - 1] || group;
}

export function groupDepth(group: string): number {
  return Math.max(0, normalizeGroupPath(group).split(GROUP_SEP).filter(Boolean).length - 1);
}

/** принадлежит ли узел пути (точно или как потомок) */
export function groupMatches(nodeGroup: string, path: string): boolean {
  const g = normalizeGroupPath(nodeGroup);
  const p = normalizeGroupPath(path);
  return g === p || g.startsWith(p + GROUP_SEP);
}

/** самый глубокий свёрнутый префикс узла, либо null */
export function deepestCollapsedPrefix(group: string, collapsed: Set<string> | string[]): string | null {
  const set = collapsed instanceof Set ? collapsed : new Set(collapsed);
  const prefixes = groupPrefixes(group);
  for (let i = prefixes.length - 1; i >= 0; i--) {
    if (set.has(prefixes[i])) return prefixes[i];
  }
  return null;
}

export interface GroupTreeNode {
  path: string;
  name: string;
  total: number;
  collapsed: boolean;
  depth: number;
  children: GroupTreeNode[];
}

/** дерево всех путей, встречающихся у узлов (включая промежуточные сегменты) */
export function buildGroupTree(
  groups: Iterable<string>,
  counts: Map<string, number>,
  collapsedGroups: string[],
): GroupTreeNode[] {
  const collapsed = new Set(collapsedGroups);
  type Acc = { path: string; name: string; total: number; children: Map<string, Acc> };
  const roots = new Map<string, Acc>();

  const ensure = (path: string): Acc => {
    const parts = path.split(GROUP_SEP);
    let map = roots;
    let acc: Acc | undefined;
    let cur = '';
    for (let i = 0; i < parts.length; i++) {
      cur = i === 0 ? parts[0] : `${cur}${GROUP_SEP}${parts[i]}`;
      let next = map.get(parts[i]);
      if (!next) {
        next = { path: cur, name: parts[i], total: 0, children: new Map() };
        map.set(parts[i], next);
      }
      acc = next;
      map = next.children;
    }
    return acc!;
  };

  for (const raw of groups) {
    const path = normalizeGroupPath(raw);
    if (!path) continue;
    for (const prefix of groupPrefixes(path)) ensure(prefix);
  }

  // количество узлов под каждым префиксом
  for (const [g, n] of counts) {
    for (const prefix of groupPrefixes(g)) {
      const node = ensure(prefix);
      node.total += n;
    }
  }

  const toTree = (acc: Acc, depth: number): GroupTreeNode => ({
    path: acc.path,
    name: acc.name,
    total: acc.total,
    collapsed: collapsed.has(acc.path),
    depth,
    children: [...acc.children.values()]
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      .map((c) => toTree(c, depth + 1)),
  });

  return [...roots.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    .map((r) => toTree(r, 0));
}

export function flattenGroupTree(tree: GroupTreeNode[]): GroupTreeNode[] {
  const out: GroupTreeNode[] = [];
  const walk = (nodes: GroupTreeNode[]) => {
    for (const n of nodes) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(tree);
  return out;
}

/** выпуклая оболочка (монотонная цепь Эндрю) */
export function convexHull(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const pts = points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (pts.length <= 1) return pts.slice();

  const cross = (
    o: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: typeof pts = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: typeof pts = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** сдвиг базового цвета для подгруппы той же ветки */
export function shiftGroupColor(baseHex: string, path: string): string {
  const rgb = hexToRgb(baseHex);
  if (!rgb) return baseHex;
  const depth = groupDepth(path);
  if (depth === 0) return baseHex;
  const leaf = groupLeaf(path);
  const wobble = (hashHue(leaf) % 40) - 20;
  const light = 1 + depth * 0.06;
  return rgbToHex(
    rgb.r * light + wobble * 0.4,
    rgb.g * light - wobble * 0.2,
    rgb.b * light + wobble * 0.3,
  );
}

export function fallbackGroupColor(name: string): string {
  const h = hashHue(name);
  return `hsl(${h} 55% 62%)`;
}
