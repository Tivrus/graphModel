import type { GraphLink, GraphNode, SceneImage } from '../types';
import { createSampleGraph } from '../data/sampleGraph';
import { uid } from '../store/ids';

export type ProjectView = '3d' | '2d';

/** снимок одного проекта (граф + картинки + режим вида) */
export interface ProjectDoc {
  id: string;
  nodes: GraphNode[];
  links: GraphLink[];
  collapsedGroups: string[];
  expandedNodes: string[];
  images: SceneImage[];
  view: ProjectView;
}

/** минимум одна вкладка всегда есть */
export const MIN_PROJECT_SLOTS = 1;

export function emptyProject(view: ProjectView = '3d'): ProjectDoc {
  return {
    id: uid('p'),
    nodes: [],
    links: [],
    collapsedGroups: [],
    expandedNodes: [],
    images: [],
    view,
  };
}

export function sampleProject(): ProjectDoc {
  const g = createSampleGraph();
  return {
    id: uid('p'),
    nodes: g.nodes,
    links: g.links,
    collapsedGroups: [],
    expandedNodes: [],
    images: [],
    view: '3d',
  };
}

export function createInitialSlots(): ProjectDoc[] {
  return [sampleProject()];
}

export function projectIsEmpty(p: ProjectDoc): boolean {
  return p.nodes.length === 0 && p.images.length === 0;
}

export function cloneProject(p: ProjectDoc): ProjectDoc {
  return {
    ...p,
    id: uid('p'),
    nodes: p.nodes.map((n) => ({ ...n, metadata: { ...n.metadata } })),
    links: p.links.map((l) => ({
      ...l,
      source: typeof l.source === 'string' ? l.source : l.source.id,
      target: typeof l.target === 'string' ? l.target : l.target.id,
    })),
    collapsedGroups: [...p.collapsedGroups],
    expandedNodes: [...p.expandedNodes],
    images: p.images.map((img) => ({ ...img })),
  };
}
