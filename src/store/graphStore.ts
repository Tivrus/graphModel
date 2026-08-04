import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AiGraphSpec,
  ChatMessage,
  FocusRequest,
  GraphData,
  GraphLink,
  GraphNode,
  SceneImage,
  Selection,
  ToolMode,
  VizSettings,
} from '../types';
import { askAi, extractGraphSpec } from '../utils/ai';
import { fetchBackendHealth } from '../utils/backend';
import {
  buildGroupTree,
  deepestCollapsedPrefix,
  flattenGroupTree,
  groupMatches,
  groupPrefixes,
  normalizeGroupPath,
  type GroupTreeNode,
} from '../utils/groups';
import {
  createInitialSlots,
  emptyProject,
  MIN_PROJECT_SLOTS,
  sampleProject,
  type ProjectDoc,
  type ProjectView,
} from '../app/project';
import { uid } from './ids';

export { uid };
export const idOf = (e: string | GraphNode): string => (typeof e === 'string' ? e : e.id);

export const DEFAULT_SETTINGS: VizSettings = {
  charge: 120,
  linkDistance: 55,
  showLabels: true,
  particles: true,
  nodeScale: 1,
  linkOpacity: 0.35,
  background: '#05070d',
  physics: true,
  pinOnDrag: true,
  stars: true,
  starsDensity: 1,
  starsDistance: 1,
  sensitivity: 1,
  zoomSensitivity: 1,
  tolerantSelect: true,
};

export interface GraphState {
  /** вкладки проектов — активный развёрнут в рабочие поля ниже */
  projectSlots: ProjectDoc[];
  activeSlot: number;

  nodes: GraphNode[];
  links: GraphLink[];
  collapsedGroups: string[];
  expandedNodes: string[];
  selection: Selection;
  selectionSet: string[];
  mode: ToolMode;
  pendingSource: string | null;
  settings: VizSettings;
  focusRequest: FocusRequest | null;
  /** режим вида активного проекта */
  view: ProjectView;

  switchProjectSlot: (index: number) => void;
  clearProjectSlot: (index: number) => void;
  addProjectSlot: () => void;
  removeProjectSlot: (index: number) => void;
  setView: (view: ProjectView) => void;

  setMode: (mode: ToolMode) => void;
  setSelection: (sel: Selection) => void;
  setSelectionSet: (ids: string[]) => void;
  toggleInSelectionSet: (id: string) => void;
  setPendingSource: (id: string | null) => void;

  addNode: (partial?: Partial<GraphNode>, linkToId?: string) => string;
  updateNode: (id: string, patch: Partial<GraphNode>) => void;
  removeNode: (id: string) => void;
  removeNodes: (ids: string[]) => void;
  addLink: (sourceId: string, targetId: string) => void;
  updateLink: (id: string, patch: Partial<GraphLink>) => void;
  removeLink: (id: string) => void;
  deleteSelection: () => void;

  pinNode: (id: string, pin: boolean) => void;
  pinNodes: (ids: string[], pin: boolean) => void;
  setGroupForNodes: (ids: string[], group: string) => void;
  unpinAll: () => void;

  toggleGroupCollapsed: (group: string) => void;
  setAllCollapsed: (groups: string[]) => void;
  toggleNodeExpanded: (id: string) => void;

  updateSettings: (patch: Partial<VizSettings>) => void;
  requestFocus: (id: string) => void;
  revealNode: (id: string) => void;

  importData: (
    data: GraphData & {
      collapsedGroups?: string[];
      expandedNodes?: string[];
      images?: SceneImage[];
    },
  ) => void;
  resetToSample: () => void;
  clearGraph: () => void;

  images: SceneImage[];
  addImage: (img: Omit<SceneImage, 'id'>) => string;
  updateImage: (id: string, patch: Partial<Omit<SceneImage, 'id'>>) => void;
  removeImage: (id: string) => void;

  chatOpen: boolean;
  chatMessages: ChatMessage[];
  chatBusy: boolean;
  /** backend доступен (онлайн) */
  backendOnline: boolean;
  /** AI настроен на backend */
  backendAi: boolean;
  refreshBackendStatus: () => Promise<void>;
  toggleChat: () => void;
  clearChat: () => void;
  sendChat: (text: string) => Promise<void>;
  applyAiGraph: (spec: AiGraphSpec, mode: 'replace' | 'merge') => void;
}

function cleanNode(n: GraphNode): GraphNode {
  const { vx, vy, vz, ...rest } = n;
  delete (rest as Record<string, unknown>).index;
  return rest;
}

function cleanProject(p: ProjectDoc): ProjectDoc {
  return {
    ...p,
    nodes: p.nodes.map(cleanNode),
    links: p.links.map((l) => ({
      id: l.id,
      source: idOf(l.source),
      target: idOf(l.target),
      label: l.label,
      kind: l.kind,
    })),
    collapsedGroups: [...p.collapsedGroups],
    expandedNodes: [...p.expandedNodes],
    images: p.images.map((img) => ({ ...img })),
  };
}

function snapshotFromState(s: GraphState): ProjectDoc {
  const prev = s.projectSlots[s.activeSlot];
  return cleanProject({
    id: prev?.id ?? uid('p'),
    nodes: s.nodes,
    links: s.links,
    collapsedGroups: s.collapsedGroups,
    expandedNodes: s.expandedNodes,
    images: s.images,
    view: s.view,
  });
}

function flushSlots(s: GraphState): ProjectDoc[] {
  const slots = s.projectSlots.map(cleanProject);
  slots[s.activeSlot] = snapshotFromState(s);
  return slots;
}

function hydrateFromProject(doc: ProjectDoc) {
  const c = cleanProject(doc);
  return {
    nodes: c.nodes,
    links: c.links,
    collapsedGroups: c.collapsedGroups,
    expandedNodes: c.expandedNodes,
    images: c.images,
    view: c.view,
    selection: null as Selection,
    selectionSet: [] as string[],
    pendingSource: null as string | null,
    focusRequest: null as FocusRequest | null,
    mode: 'select' as ToolMode,
  };
}

/**
 * Вычисляет видимый граф: скрывает подузлы свернутых слоёв и
 * заменяет узлы свернутых кластеров на суперузлы.
 * Подгруппы — пути «Родитель/Подгруппа/…»; сворачивается самый глубокий
 * совпавший префикс. Возвращаемые узлы — те же объекты, что в сторе.
 */
export function getVisibleGraph(
  nodes: GraphNode[],
  links: GraphLink[],
  collapsedGroups: string[],
  expandedNodes: string[],
): GraphData {
  const collapsed = new Set(collapsedGroups.map(normalizeGroupPath));
  const expanded = new Set(expandedNodes);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const mapId = new Map<string, string>();
  const clusterAgg = new Map<string, { count: number }>();
  const outNodes: GraphNode[] = [];

  for (const n of nodes) {
    if (n.parentId) {
      const parent = byId.get(n.parentId);
      const parentCollapsed = parent ? deepestCollapsedPrefix(parent.group, collapsed) : 'x';
      if (!expanded.has(n.parentId) || !parent || parentCollapsed) continue;
    }
    const hit = deepestCollapsedPrefix(n.group, collapsed);
    if (hit) {
      mapId.set(n.id, `cluster:${hit}`);
      const agg = clusterAgg.get(hit) ?? { count: 0 };
      agg.count += 1;
      clusterAgg.set(hit, agg);
      continue;
    }
    mapId.set(n.id, n.id);
    outNodes.push(n);
  }

  for (const [group, agg] of clusterAgg) {
    outNodes.push({
      id: `cluster:${group}`,
      label: group,
      group,
      size: 9 + agg.count * 2,
      metadata: { 'тип': 'кластер', 'узлов внутри': String(agg.count) },
      isCluster: true,
      clusterSize: agg.count,
    });
  }

  const seen = new Set<string>();
  const outLinks: GraphLink[] = [];
  for (const l of links) {
    const rawS = idOf(l.source);
    const rawT = idOf(l.target);
    const s = mapId.get(rawS);
    const t = mapId.get(rawT);
    if (!s || !t || s === t) continue;
    const key = s < t ? `${s}|${t}` : `${t}|${s}`;
    const touchesCluster = s.startsWith('cluster:') || t.startsWith('cluster:');
    if (touchesCluster) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    if (s === rawS && t === rawT) {
      outLinks.push(l);
    } else {
      outLinks.push({ ...l, source: s, target: t });
    }
  }

  return { nodes: outNodes, links: outLinks };
}

export type GroupInfo = GroupTreeNode;

export function getGroups(nodes: GraphNode[], collapsedGroups: string[]): GroupInfo[] {
  const counts = new Map<string, number>();
  for (const n of nodes) {
    const g = normalizeGroupPath(n.group);
    if (!g) continue;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return flattenGroupTree(buildGroupTree(counts.keys(), counts, collapsedGroups));
}

export function getGroupTree(nodes: GraphNode[], collapsedGroups: string[]): GroupTreeNode[] {
  const counts = new Map<string, number>();
  for (const n of nodes) {
    const g = normalizeGroupPath(n.group);
    if (!g) continue;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return buildGroupTree(counts.keys(), counts, collapsedGroups);
}

const initialSlots = createInitialSlots();
const initialActive = 0;
const initialDoc = initialSlots[initialActive];

/** краткий контекст текущего графа для системного промпта AI */
function graphContextSummary(s: GraphState): string {
  if (!s.nodes.length) return '\n\nТекущий граф пуст.';
  const groups = new Map<string, number>();
  for (const n of s.nodes) groups.set(n.group, (groups.get(n.group) ?? 0) + 1);
  const gStr = [...groups.entries()].map(([g, c]) => `${g}(${c})`).join(', ');
  const labels = s.nodes
    .slice(0, 60)
    .map((n) => `"${n.label}"`)
    .join(', ');
  return `\n\nТекущий граф пользователя: ${s.nodes.length} узлов, ${s.links.length} связей. Группы: ${gStr}. Узлы: ${labels}${s.nodes.length > 60 ? ', …' : ''}`;
}

export const useGraphStore = create<GraphState>()(
  persist(
    (set, get) => ({
      projectSlots: initialSlots,
      activeSlot: initialActive,
      view: initialDoc.view,

      nodes: initialDoc.nodes,
      links: initialDoc.links,
      collapsedGroups: initialDoc.collapsedGroups,
      expandedNodes: initialDoc.expandedNodes,
      selection: null,
      selectionSet: [],
      mode: 'select',
      pendingSource: null,
      settings: DEFAULT_SETTINGS,
      focusRequest: null,
      images: initialDoc.images,

      switchProjectSlot: (index) => {
        set((s) => {
          const i = Math.max(0, Math.min(s.projectSlots.length - 1, index | 0));
          if (i === s.activeSlot) return s;
          const slots = flushSlots(s);
          const doc = slots[i] ?? emptyProject();
          return {
            projectSlots: slots,
            activeSlot: i,
            ...hydrateFromProject(doc),
          };
        });
      },

      clearProjectSlot: (index) => {
        set((s) => {
          const i = Math.max(0, Math.min(s.projectSlots.length - 1, index | 0));
          const slots = flushSlots(s);
          slots[i] = emptyProject(slots[i]?.view ?? s.view);
          if (i === s.activeSlot) {
            return {
              projectSlots: slots,
              ...hydrateFromProject(slots[i]),
            };
          }
          return { projectSlots: slots };
        });
      },

      addProjectSlot: () => {
        set((s) => {
          const slots = flushSlots(s);
          const next = emptyProject(s.view);
          return {
            projectSlots: [...slots, next],
            activeSlot: slots.length,
            ...hydrateFromProject(next),
          };
        });
      },

      removeProjectSlot: (index) => {
        set((s) => {
          if (s.projectSlots.length <= MIN_PROJECT_SLOTS) {
            // нельзя удалить последнюю — очищаем
            const slots = flushSlots(s);
            const i = Math.max(0, Math.min(slots.length - 1, index | 0));
            slots[i] = emptyProject(slots[i]?.view ?? s.view);
            if (i === s.activeSlot) {
              return { projectSlots: slots, ...hydrateFromProject(slots[i]) };
            }
            return { projectSlots: slots };
          }
          const slots = flushSlots(s);
          const i = Math.max(0, Math.min(slots.length - 1, index | 0));
          const next = slots.filter((_, j) => j !== i);
          let active = s.activeSlot;
          if (i < active) active -= 1;
          else if (i === active) active = Math.min(active, next.length - 1);
          return {
            projectSlots: next,
            activeSlot: active,
            ...hydrateFromProject(next[active]),
          };
        });
      },

      setView: (view) => set({ view }),

      setMode: (mode) => set({ mode, pendingSource: null }),
      setSelection: (selection) =>
        set((s) => ({ selection, selectionSet: selection ? [] : s.selectionSet })),
      setSelectionSet: (ids) =>
        set((s) => ({ selectionSet: ids, selection: ids.length ? null : s.selection })),
      toggleInSelectionSet: (id) =>
        set((s) => ({
          selectionSet: s.selectionSet.includes(id)
            ? s.selectionSet.filter((x) => x !== id)
            : [...s.selectionSet, id],
          selection: null,
        })),
      setPendingSource: (pendingSource) => set({ pendingSource }),

      addNode: (partial = {}, linkToId) => {
        const id = uid('n');
        const node: GraphNode = {
          id,
          label: partial.label ?? 'Новый узел',
          group: normalizeGroupPath(partial.group ?? 'Новые') || 'Новые',
          size: partial.size ?? 6,
          color: partial.color,
          metadata: partial.metadata ?? { 'тип': 'произвольный' },
          parentId: partial.parentId,
          x: partial.x,
          y: partial.y,
          z: partial.z,
        };
        set((s) => ({
          nodes: [...s.nodes, node],
          links: linkToId
            ? [...s.links, { id: uid('l'), source: linkToId, target: id, kind: 'связь' as const }]
            : s.links,
        }));
        return id;
      },

      updateNode: (id, patch) =>
        set((s) => {
          const next = { ...patch };
          if (typeof next.group === 'string') next.group = normalizeGroupPath(next.group) || 'Новые';
          return {
            nodes: s.nodes.map((n) => (n.id === id ? Object.assign(n, next) : n)),
          };
        }),

      removeNode: (id) =>
        set((s) => {
          const doomed = new Set<string>([id]);
          for (const n of s.nodes) if (n.parentId === id) doomed.add(n.id);
          return {
            nodes: s.nodes.filter((n) => !doomed.has(n.id)),
            links: s.links.filter((l) => !doomed.has(idOf(l.source)) && !doomed.has(idOf(l.target))),
            expandedNodes: s.expandedNodes.filter((e) => !doomed.has(e)),
            selection:
              s.selection?.type === 'node' && doomed.has(s.selection.id) ? null : s.selection,
            pendingSource: s.pendingSource && doomed.has(s.pendingSource) ? null : s.pendingSource,
          };
        }),

      addLink: (sourceId, targetId) =>
        set((s) => {
          if (sourceId === targetId) return s;
          const exists = s.links.some(
            (l) =>
              (idOf(l.source) === sourceId && idOf(l.target) === targetId) ||
              (idOf(l.source) === targetId && idOf(l.target) === sourceId),
          );
          if (exists) return s;
          return { links: [...s.links, { id: uid('l'), source: sourceId, target: targetId, kind: 'связь' as const }] };
        }),

      updateLink: (id, patch) =>
        set((s) => ({
          links: s.links.map((l) => (l.id === id ? Object.assign(l, patch) : l)),
        })),

      removeLink: (id) =>
        set((s) => ({
          links: s.links.filter((l) => l.id !== id),
          selection: s.selection?.type === 'link' && s.selection.id === id ? null : s.selection,
        })),

      removeNodes: (ids) =>
        set((s) => {
          const doomed = new Set(ids);
          for (const n of s.nodes) if (n.parentId && doomed.has(n.parentId)) doomed.add(n.id);
          return {
            nodes: s.nodes.filter((n) => !doomed.has(n.id)),
            links: s.links.filter((l) => !doomed.has(idOf(l.source)) && !doomed.has(idOf(l.target))),
            expandedNodes: s.expandedNodes.filter((e) => !doomed.has(e)),
            selection:
              s.selection?.type === 'node' && doomed.has(s.selection.id) ? null : s.selection,
            selectionSet: [],
            pendingSource: s.pendingSource && doomed.has(s.pendingSource) ? null : s.pendingSource,
          };
        }),

      deleteSelection: () => {
        const st = get();
        if (st.selectionSet.length) {
          st.removeNodes(st.selectionSet);
          return;
        }
        const sel = st.selection;
        if (!sel) return;
        if (sel.type === 'node') get().removeNode(sel.id);
        else if (sel.type === 'link') get().removeLink(sel.id);
        else get().removeImage(sel.id);
      },

      pinNode: (id, pin) =>
        set((s) => ({
          nodes: s.nodes.map((n) => {
            if (n.id !== id) return n;
            if (pin) {
              n.fx = n.x ?? 0;
              n.fy = n.y ?? 0;
              n.fz = n.z ?? 0;
            } else {
              n.fx = n.fy = n.fz = null;
            }
            return n;
          }),
        })),

      pinNodes: (ids, pin) =>
        set((s) => {
          const targets = new Set(ids);
          return {
            nodes: s.nodes.map((n) => {
              if (!targets.has(n.id)) return n;
              if (pin) {
                n.fx = n.x ?? 0;
                n.fy = n.y ?? 0;
                n.fz = n.z ?? 0;
              } else {
                n.fx = n.fy = n.fz = null;
              }
              return n;
            }),
          };
        }),

      setGroupForNodes: (ids, group) =>
        set((s) => {
          const targets = new Set(ids);
          const g = normalizeGroupPath(group) || 'Новые';
          return {
            nodes: s.nodes.map((n) => (targets.has(n.id) ? Object.assign(n, { group: g }) : n)),
          };
        }),

      unpinAll: () =>
        set((s) => ({
          nodes: s.nodes.map((n) => {
            if (n.fx == null) return n;
            n.fx = n.fy = n.fz = null;
            return n;
          }),
        })),

      toggleGroupCollapsed: (group) =>
        set((s) => {
          const path = normalizeGroupPath(group);
          const collapsed = s.collapsedGroups.includes(path)
            ? s.collapsedGroups.filter((g) => g !== path)
            : [...s.collapsedGroups, path];
          const sel = s.selection;
          const selectedNode = sel?.type === 'node' ? s.nodes.find((n) => n.id === sel.id) : undefined;
          const hideSel =
            !!selectedNode &&
            groupMatches(selectedNode.group, path) &&
            collapsed.includes(path);
          return {
            collapsedGroups: collapsed,
            selection: hideSel ? null : sel,
          };
        }),

      setAllCollapsed: (groups) =>
        set({ collapsedGroups: groups.map(normalizeGroupPath).filter(Boolean), selection: null }),

      toggleNodeExpanded: (id) =>
        set((s) => ({
          expandedNodes: s.expandedNodes.includes(id)
            ? s.expandedNodes.filter((e) => e !== id)
            : [...s.expandedNodes, id],
        })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      revealNode: (id) =>
        set((s) => {
          const n = s.nodes.find((x) => x.id === id);
          if (!n) return s;
          const expandedNodes =
            n.parentId && !s.expandedNodes.includes(n.parentId)
              ? [...s.expandedNodes, n.parentId]
              : s.expandedNodes;
          const prefixes = new Set(groupPrefixes(n.group));
          const collapsedGroups = s.collapsedGroups.filter((g) => !prefixes.has(g));
          return { expandedNodes, collapsedGroups };
        }),

      requestFocus: (id) => {
        get().revealNode(id);
        set({ focusRequest: { id, ts: Date.now() }, selection: { type: 'node', id } });
      },

      importData: (data) =>
        set({
          nodes: data.nodes,
          links: data.links,
          collapsedGroups: data.collapsedGroups ?? [],
          expandedNodes: data.expandedNodes ?? [],
          images: data.images ?? [],
          selection: null,
          selectionSet: [],
          pendingSource: null,
        }),

      resetToSample: () => {
        const fresh = sampleProject();
        set((s) => ({
          ...hydrateFromProject({ ...fresh, view: s.view }),
        }));
      },

      clearGraph: () =>
        set((s) => ({
          ...hydrateFromProject(emptyProject(s.view)),
        })),

      addImage: (img) => {
        const id = uid('img');
        set((s) => ({ images: [...s.images, { ...img, id }] }));
        return id;
      },

      updateImage: (id, patch) =>
        set((s) => ({
          images: s.images.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),

      removeImage: (id) =>
        set((s) => ({
          images: s.images.filter((i) => i.id !== id),
          selection: s.selection?.type === 'image' && s.selection.id === id ? null : s.selection,
        })),

      chatOpen: false,
      chatMessages: [],
      chatBusy: false,
      backendOnline: false,
      backendAi: false,

      refreshBackendStatus: async () => {
        const health = await fetchBackendHealth();
        set({
          backendOnline: !!health,
          backendAi: !!health?.ai,
        });
      },

      toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
      clearChat: () => set({ chatMessages: [] }),

      sendChat: async (text) => {
        const trimmed = text.trim();
        if (!trimmed || get().chatBusy) return;
        const userMsg: ChatMessage = { id: uid('m'), role: 'user', text: trimmed };
        set((s) => ({ chatMessages: [...s.chatMessages, userMsg], chatBusy: true }));
        try {
          await get().refreshBackendStatus();
          const history = get().chatMessages.slice(0, -1);
          const raw = await askAi(history, trimmed, graphContextSummary(get()));
          const { reply, graph } = extractGraphSpec(raw);
          const msg: ChatMessage = { id: uid('m'), role: 'assistant', text: reply, graph };
          set((s) => ({ chatMessages: [...s.chatMessages, msg], chatBusy: false }));
        } catch (e) {
          const msg: ChatMessage = {
            id: uid('m'),
            role: 'assistant',
            text: e instanceof Error ? e.message : 'Неизвестная ошибка AI.',
            isError: true,
          };
          set((s) => ({ chatMessages: [...s.chatMessages, msg], chatBusy: false }));
        }
      },

      applyAiGraph: (spec, mode) => {
        const idMap = new Map<string, string>();
        const newNodes: GraphNode[] = spec.nodes.map((n, i) => {
          const id = uid('ai');
          idMap.set(String(n.id ?? `n${i + 1}`), id);
          const angle = (i * 137.5 * Math.PI) / 180;
          const radius = 40 + i * 6;
          return {
            id,
            label: n.label,
            group: n.group ?? 'AI',
            size: n.size ?? 6,
            color: n.color,
            metadata: { 'источник': 'ai' },
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            z: ((i % 7) - 3) * 22,
          };
        });
        const newLinks: GraphLink[] = spec.links
          .filter((l) => idMap.has(l.source) && idMap.has(l.target) && l.source !== l.target)
          .map((l) => ({
            id: uid('l'),
            source: idMap.get(l.source)!,
            target: idMap.get(l.target)!,
            kind: l.kind ?? 'связь',
            label: l.label,
          }));
        set((s) => ({
          nodes: mode === 'replace' ? newNodes : [...s.nodes, ...newNodes],
          links: mode === 'replace' ? newLinks : [...s.links, ...newLinks],
          collapsedGroups: mode === 'replace' ? [] : s.collapsedGroups,
          expandedNodes: mode === 'replace' ? [] : s.expandedNodes,
          selection: null,
          selectionSet: [],
          pendingSource: null,
        }));
      },
    }),
    {
      name: 'graph-model-v2',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GraphState> & {
          nodes?: GraphNode[];
          links?: GraphLink[];
          images?: SceneImage[];
        };
        let slots = p.projectSlots;
        let activeSlot = typeof p.activeSlot === 'number' ? p.activeSlot : 0;

        if (!Array.isArray(slots) || slots.length === 0) {
          if (Array.isArray(p.nodes)) {
            slots = [
              {
                id: uid('p'),
                nodes: p.nodes,
                links: p.links ?? [],
                collapsedGroups: p.collapsedGroups ?? [],
                expandedNodes: p.expandedNodes ?? [],
                images: p.images ?? [],
                view: '3d' as ProjectView,
              },
            ];
            activeSlot = 0;
          } else {
            slots = createInitialSlots();
            activeSlot = 0;
          }
        }

        slots = slots.map((doc) => ({
          ...emptyProject(),
          ...doc,
          view: doc.view === '2d' ? '2d' : '3d',
        }));
        if (slots.length < MIN_PROJECT_SLOTS) slots = createInitialSlots();
        activeSlot = Math.max(0, Math.min(slots.length - 1, activeSlot));
        const doc = slots[activeSlot];

        return {
          ...current,
          ...p,
          projectSlots: slots,
          activeSlot,
          ...hydrateFromProject(doc),
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
        };
      },
      partialize: (s) => {
        const slots = flushSlots(s).map(cleanProject);
        return {
          projectSlots: slots,
          activeSlot: s.activeSlot,
          settings: s.settings,
        };
      },
    },
  ),
);
