export type LinkKind = 'связь' | 'зависимость' | 'поток';

export interface GraphNode {
  id: string;
  label: string;
  /** группа / путь подгрупп через «/» (глубина не ограничена) */
  group: string;
  size: number;
  color?: string;
  metadata: Record<string, string>;
  /** если задан — узел является скрытым «подузлом» (слой сложности) */
  parentId?: string;
  /** синтетический суперузел свернутого кластера */
  isCluster?: boolean;
  clusterSize?: number;
  // координаты (заполняет физический движок; храним, чтобы раскладка «жила» между страницами и перезагрузками)
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  fx?: number | null;
  fy?: number | null;
  fz?: number | null;
}

export interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  label?: string;
  kind?: LinkKind;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export type ToolMode = 'select' | 'add-node' | 'add-link' | 'delete';

export type Selection = { type: 'node' | 'link' | 'image'; id: string } | null;

/** картинка-билборд в 3D-сцене (всегда повёрнута к камере) */
export interface SceneImage {
  id: string;
  name: string;
  /** base64 data URL источника */
  dataUrl: string;
  x: number;
  y: number;
  z: number;
  /** высота спрайта в мировых единицах */
  scale: number;
  opacity: number;
}

export interface VizSettings {
  /** сила отталкивания (положительное число, применяется как -charge) */
  charge: number;
  linkDistance: number;
  showLabels: boolean;
  particles: boolean;
  nodeScale: number;
  linkOpacity: number;
  background: string;
  physics: boolean;
  pinOnDrag: boolean;
  /** звёздное поле в 3D */
  stars: boolean;
  /** плотность звёзд (множитель к базовому числу) */
  starsDensity: number;
  /** отдалённость атмосферного тумана (не двигает звёзды) */
  starsDistance: number;
  /** чувствительность вращения/панорамы камеры */
  sensitivity: number;
  /** чувствительность зума */
  zoomSensitivity: number;
  /** рамка захватывает узлы, задетые краем, а не только центром */
  tolerantSelect: boolean;
}

export interface FocusRequest {
  id: string;
  ts: number;
}

/** спецификация графа, которую возвращает нейросеть */
export interface AiGraphSpec {
  nodes: Array<{
    id?: string;
    label: string;
    group?: string;
    size?: number;
    color?: string;
  }>;
  links: Array<{
    source: string;
    target: string;
    kind?: LinkKind;
    label?: string;
  }>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  graph?: AiGraphSpec | null;
  isError?: boolean;
}
