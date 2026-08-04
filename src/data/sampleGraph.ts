import type { GraphData, GraphLink, GraphNode, LinkKind } from '../types';
import { fallbackGroupColor, groupRoot, shiftGroupColor } from '../utils/groups';

export const GROUP_COLORS: Record<string, string> = {
  'Ядро': '#a78bfa',
  'Данные': '#38bdf8',
  'Сервисы': '#34d399',
  'Интерфейс': '#fbbf24',
  'Интеграции': '#fb7185',
  'Новые': '#94a3b8',
};

export const groupColor = (group: string): string => {
  const root = groupRoot(group);
  const base = GROUP_COLORS[root] ?? GROUP_COLORS[group] ?? fallbackGroupColor(root);
  return shiftGroupColor(base, group);
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface GroupSpec {
  prefix: string;
  name: string;
  nodes: string[];
  children?: Record<number, string[]>;
}

const GROUPS: GroupSpec[] = [
  {
    prefix: 'core',
    name: 'Ядро',
    nodes: ['Граф-ядро', 'Планировщик', 'Шина событий', 'Реестр моделей', 'Транзактор', 'Кэш-слой'],
    children: { 0: ['Движок сил', 'Оптимизатор раскладки', 'Профилировщик'] },
  },
  {
    prefix: 'data',
    name: 'Данные',
    nodes: ['Хранилище', 'Индексатор', 'Потоковая шина', 'Архив', 'Снапшоты', 'Метаданные'],
    children: { 0: ['Партиции', 'Реплики', 'Журнал WAL'] },
  },
  {
    prefix: 'svc',
    name: 'Сервисы',
    nodes: ['API Gateway', 'Авторизация', 'Профили', 'Уведомления', 'Поиск', 'Биллинг'],
    children: { 0: ['Rate Limiter', 'Маршрутизатор', 'Аутентификатор'] },
  },
  {
    prefix: 'ui',
    name: 'Интерфейс',
    nodes: ['Канва 3D', 'Панель свойств', 'Навигатор', 'Командная палитра', 'Темы'],
    children: { 0: ['Рендерер', 'Контроллер камеры'] },
  },
  {
    prefix: 'int',
    name: 'Интеграции',
    nodes: ['Webhooks', 'S3-экспорт', 'SSO', 'Аналитика', 'CI-хуки'],
  },
];

const CROSS_LINKS: Array<[string, string]> = [
  ['svc-1', 'core-1'],
  ['ui-1', 'core-1'],
  ['data-1', 'core-6'],
  ['int-1', 'core-3'],
  ['int-3', 'svc-2'],
  ['svc-5', 'data-2'],
  ['int-4', 'data-3'],
  ['int-2', 'data-4'],
  ['svc-4', 'core-3'],
  ['data-6', 'core-4'],
  ['svc-6', 'data-5'],
  ['int-5', 'core-2'],
];

const KIND_WEIGHTS: Array<[LinkKind, number]> = [
  ['связь', 0.6],
  ['зависимость', 0.25],
  ['поток', 0.15],
];

const STATUSES = ['стабилен', 'в разработке', 'эксперимент'];

export function createSampleGraph(): GraphData {
  const rand = mulberry32(42);
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  let linkSeq = 0;

  const pickKind = (): LinkKind => {
    const r = rand();
    let acc = 0;
    for (const [kind, w] of KIND_WEIGHTS) {
      acc += w;
      if (r <= acc) return kind;
    }
    return 'связь';
  };

  const pushLink = (source: string, target: string) => {
    links.push({ id: `l-${++linkSeq}`, source, target, kind: pickKind() });
  };

  for (const spec of GROUPS) {
    const ids: string[] = [];
    spec.nodes.forEach((label, i) => {
      const id = `${spec.prefix}-${i + 1}`;
      ids.push(id);
      nodes.push({
        id,
        label,
        group: spec.name,
        size: i === 0 ? 11 : 5 + Math.round(rand() * 4),
        metadata: {
          'тип': 'модуль',
          'статус': STATUSES[Math.floor(rand() * STATUSES.length)],
        },
      });
    });
    for (let i = 0; i < ids.length; i++) pushLink(ids[i], ids[(i + 1) % ids.length]);
    pushLink(ids[0], ids[2]);
    pushLink(ids[1], ids[ids.length - 2]);

    if (spec.children) {
      for (const [parentIdxStr, childLabels] of Object.entries(spec.children)) {
        const parentId = ids[Number(parentIdxStr)];
        childLabels.forEach((label, j) => {
          const childId = `${parentId}-sub-${j + 1}`;
          nodes.push({
            id: childId,
            label,
            group: spec.name,
            size: 3 + Math.round(rand() * 2),
            parentId,
            metadata: { 'тип': 'подузел', 'слой': 'L2' },
          });
          links.push({ id: `l-${++linkSeq}`, source: parentId, target: childId, kind: 'зависимость' });
        });
      }
    }
  }

  for (const [a, b] of CROSS_LINKS) pushLink(a, b);

  // демо вложенных подгрупп (путь «Родитель/Подгруппа»)
  const SUBGROUPS: Record<string, string> = {
    'core-2': 'Ядро/Оркестрация',
    'core-3': 'Ядро/Оркестрация',
    'core-5': 'Ядро/Оркестрация',
    'data-1': 'Данные/Хранение',
    'data-4': 'Данные/Хранение',
    'data-5': 'Данные/Хранение',
    'data-2': 'Данные/Потоки',
    'data-3': 'Данные/Потоки',
    'svc-1': 'Сервисы/Граница',
    'svc-2': 'Сервисы/Граница',
    'svc-3': 'Сервисы/Логика',
    'svc-4': 'Сервисы/Логика',
    'ui-2': 'Интерфейс/Навигация',
    'ui-3': 'Интерфейс/Навигация',
  };
  for (const n of nodes) {
    if (SUBGROUPS[n.id]) n.group = SUBGROUPS[n.id];
    else if (n.parentId && SUBGROUPS[n.parentId]) n.group = SUBGROUPS[n.parentId];
  }

  return { nodes, links };
}
