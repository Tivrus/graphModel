import { useState } from 'react';
import {
  Boxes,
  CircleDot,
  GitBranch,
  Group,
  Image as ImageIcon,
  Layers,
  Pin,
  PinOff,
  Plus,
  SquarePlus,
  Trash2,
  X,
} from 'lucide-react';
import { idOf, useGraphStore } from '../store/graphStore';
import { groupColor } from '../data/sampleGraph';
import { deepestCollapsedPrefix, groupLeaf } from '../utils/groups';
import ColorPalette from './ColorPalette';
import type { GraphLink, GraphNode, LinkKind, SceneImage } from '../types';

export default function Inspector() {
  const selection = useGraphStore((s) => s.selection);
  const selectionSet = useGraphStore((s) => s.selectionSet);
  const nodes = useGraphStore((s) => s.nodes);
  const links = useGraphStore((s) => s.links);
  const images = useGraphStore((s) => s.images);

  if (selectionSet.length > 0) return <MultiInspector ids={selectionSet} allNodes={nodes} />;
  if (!selection) return null;

  if (selection.type === 'node') {
    const node = nodes.find((n) => n.id === selection.id);
    if (!node) return null;
    return <NodeInspector node={node} allNodes={nodes} />;
  }

  if (selection.type === 'image') {
    const image = images.find((i) => i.id === selection.id);
    if (!image) return null;
    return <ImageInspector image={image} />;
  }

  const link = links.find((l) => l.id === selection.id);
  if (!link) return null;
  return <LinkInspector link={link} allNodes={nodes} />;
}

function ImageInspector({ image }: { image: SceneImage }) {
  const st = () => useGraphStore.getState();
  const upd = (patch: Partial<Omit<SceneImage, 'id'>>) => st().updateImage(image.id, patch);

  const setCoord = (axis: 'x' | 'y' | 'z') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (Number.isFinite(v)) upd({ [axis]: v });
  };

  return (
    <aside className="inspector panel">
      <header className="inspector-head">
        <span className="inspector-title">
          <ImageIcon size={14} /> Картинка
        </span>
        <button className="icon-btn" title="Закрыть" onClick={() => st().setSelection(null)}>
          <X size={15} />
        </button>
      </header>
      <div className="inspector-body">
        <p className="hint image-name" title={image.name}>
          {image.name} · тащите мышью в сцене · всегда повёрнута к камере
        </p>

        <label className="field">
          <span>Размер · {Math.round(image.scale)}</span>
          <input
            type="range"
            min={6}
            max={140}
            step={1}
            value={image.scale}
            onChange={(e) => upd({ scale: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span>Прозрачность · {image.opacity.toFixed(2)}</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={image.opacity}
            onChange={(e) => upd({ opacity: Number(e.target.value) })}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>X</span>
            <input type="number" value={Math.round(image.x)} onChange={setCoord('x')} />
          </label>
          <label className="field">
            <span>Y</span>
            <input type="number" value={Math.round(image.y)} onChange={setCoord('y')} />
          </label>
          <label className="field">
            <span>Z</span>
            <input type="number" value={Math.round(image.z)} onChange={setCoord('z')} />
          </label>
        </div>

        <button className="btn danger block" onClick={() => st().removeImage(image.id)}>
          <Trash2 size={14} /> Удалить картинку
        </button>
      </div>
    </aside>
  );
}

function NodeInspector({ node, allNodes }: { node: GraphNode; allNodes: GraphNode[] }) {
  const expandedNodes = useGraphStore((s) => s.expandedNodes);
  const collapsedGroups = useGraphStore((s) => s.collapsedGroups);

  const children = allNodes.filter((n) => n.parentId === node.id);
  const groups = [...new Set(allNodes.map((n) => n.group))];
  const pinned = node.fx != null;
  const expanded = expandedNodes.includes(node.id);
  const groupCollapsed = !!deepestCollapsedPrefix(node.group, collapsedGroups);

  const st = () => useGraphStore.getState();
  const upd = (patch: Partial<GraphNode>) => st().updateNode(node.id, patch);

  const setMeta = (key: string, value: string) => upd({ metadata: { ...node.metadata, [key]: value } });
  const delMeta = (key: string) => {
    const m = { ...node.metadata };
    delete m[key];
    upd({ metadata: m });
  };
  const renameMeta = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    upd({
      metadata: Object.fromEntries(
        Object.entries(node.metadata).map(([k, v]) => (k === oldKey ? [newKey, v] : [k, v])),
      ),
    });
  };
  const addMeta = () => {
    let key = 'свойство';
    let i = 1;
    while (key in node.metadata) key = `свойство${++i}`;
    upd({ metadata: { ...node.metadata, [key]: '' } });
  };
  const addChild = () => {
    const jitter = () => (Math.random() - 0.5) * 40;
    const id = st().addNode({
      label: 'Подузел',
      group: node.group,
      parentId: node.id,
      x: (node.x ?? 0) + jitter(),
      y: (node.y ?? 0) + jitter(),
      z: (node.z ?? 0) + jitter(),
    });
    if (!expanded) st().toggleNodeExpanded(node.id);
    st().setSelection({ type: 'node', id });
  };

  return (
    <aside className="inspector panel">
      <header className="inspector-head">
        <span className="inspector-title">
          <CircleDot size={14} /> Узел
        </span>
        <button className="icon-btn" title="Закрыть" onClick={() => st().setSelection(null)}>
          <X size={15} />
        </button>
      </header>
      <div className="inspector-body">
        <label className="field">
          <span>Название</span>
          <input value={node.label} onChange={(e) => upd({ label: e.target.value })} />
        </label>

        <label className="field">
          <span>Группа / подгруппа</span>
          <input
            list="inspector-groups"
            value={node.group}
            placeholder="Родитель/Подгруппа/…"
            onChange={(e) => upd({ group: e.target.value })}
          />
          <datalist id="inspector-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <p className="hint">
            путь через / — глубина не ограничена. Пример: Данные/Хранение/WAL
          </p>
        </label>
        <div className="chips">
          <button
            className="chip"
            title="Добавить уровень подгруппы к текущему пути"
            onClick={() => {
              const base = node.group.replace(/\/+$/, '') || 'Новые';
              let name = 'Подгруппа';
              let i = 1;
              const existing = new Set(allNodes.map((n) => n.group));
              while (existing.has(`${base}/${name}`)) name = `Подгруппа${++i}`;
              upd({ group: `${base}/${name}` });
            }}
          >
            + подгруппа
          </button>
        </div>

        <label className="field">
          <span>Цвет</span>
          <ColorPalette
            value={node.color ?? groupColor(node.group)}
            onChange={(hex) => upd({ color: hex })}
            onClear={() => upd({ color: undefined })}
          />
        </label>

        <label className="field">
          <span>Размер · {node.size}</span>
          <input
            type="range"
            min={2}
            max={18}
            step={1}
            value={node.size}
            onChange={(e) => upd({ size: Number(e.target.value) })}
          />
        </label>

        <div className="chips">
          {pinned ? (
            <button className="chip warn" onClick={() => st().pinNode(node.id, false)}>
              <PinOff size={13} /> открепить
            </button>
          ) : (
            <button className="chip" onClick={() => st().pinNode(node.id, true)}>
              <Pin size={13} /> закрепить
            </button>
          )}
          <button
            className="chip"
            disabled={groupCollapsed}
            title={groupCollapsed ? 'Кластер уже свернут' : 'Свернуть весь кластер в суперузел'}
            onClick={() => st().toggleGroupCollapsed(node.group)}
          >
            <Boxes size={13} /> свернуть «{groupLeaf(node.group)}»
          </button>
        </div>

        <section className="meta">
          <div className="meta-head">
            <span>Метаданные</span>
            <button className="icon-btn" title="Добавить поле" onClick={addMeta}>
              <Plus size={14} />
            </button>
          </div>
          {Object.entries(node.metadata).map(([key, value]) => (
            <div className="meta-row" key={key}>
              <input
                className="meta-key"
                value={key}
                onChange={(e) => renameMeta(key, e.target.value)}
              />
              <input
                className="meta-val"
                value={value}
                onChange={(e) => setMeta(key, e.target.value)}
              />
              <button className="icon-btn" title="Удалить поле" onClick={() => delMeta(key)}>
                <X size={13} />
              </button>
            </div>
          ))}
          {Object.keys(node.metadata).length === 0 && <p className="hint">нет полей — добавьте своё</p>}
        </section>

        <section className="layer">
          <div className="meta-head">
            <span>
              <Layers size={13} /> Слой сложности
            </span>
          </div>
          <p className="hint">
            {children.length ? `подузлов: ${children.length}` : 'нет вложенных узлов'}
            {node.parentId ? ' · это подузел' : ''}
          </p>
          <div className="chips">
            {children.length > 0 && (
              <button className="chip" onClick={() => st().toggleNodeExpanded(node.id)}>
                {expanded ? 'свернуть слой' : `развернуть слой (${children.length})`}
              </button>
            )}
            <button className="chip" onClick={addChild}>
              <SquarePlus size={13} /> добавить подузел
            </button>
          </div>
        </section>

        <button className="btn danger block" onClick={() => st().removeNode(node.id)}>
          <Trash2 size={14} /> Удалить узел
        </button>
      </div>
    </aside>
  );
}

function MultiInspector({ ids, allNodes }: { ids: string[]; allNodes: GraphNode[] }) {
  const [group, setGroup] = useState('');
  const groups = [...new Set(allNodes.map((n) => n.group))];
  const st = () => useGraphStore.getState();

  return (
    <aside className="inspector panel">
      <header className="inspector-head">
        <span className="inspector-title">
          <Group size={14} /> Выделено: {ids.length}
        </span>
        <button className="icon-btn" title="Снять выделение" onClick={() => st().setSelectionSet([])}>
          <X size={15} />
        </button>
      </header>
      <div className="inspector-body">
        <p className="hint">
          Shift+клик — добавить/убрать узел · Shift+drag — рамка · Esc — снять выделение
        </p>

        <div className="chips">
          <button className="chip" onClick={() => st().pinNodes(ids, true)}>
            <Pin size={13} /> закрепить
          </button>
          <button className="chip" onClick={() => st().pinNodes(ids, false)}>
            <PinOff size={13} /> открепить
          </button>
        </div>

        <label className="field">
          <span>Назначить группу / подгруппу всем</span>
          <input
            list="inspector-groups"
            value={group}
            placeholder="Родитель/Подгруппа/…"
            onChange={(e) => setGroup(e.target.value)}
          />
          <datalist id="inspector-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
        <button
          className="btn block"
          disabled={!group.trim()}
          onClick={() => st().setGroupForNodes(ids, group.trim())}
        >
          <Boxes size={14} /> Применить группу
        </button>

        <button className="btn danger block" onClick={() => st().removeNodes(ids)}>
          <Trash2 size={14} /> Удалить выделенные ({ids.length})
        </button>
      </div>
    </aside>
  );
}

const LINK_KINDS: LinkKind[] = ['связь', 'зависимость', 'поток'];

function LinkInspector({ link, allNodes }: { link: GraphLink; allNodes: GraphNode[] }) {
  const st = () => useGraphStore.getState();
  const source = allNodes.find((n) => n.id === idOf(link.source));
  const target = allNodes.find((n) => n.id === idOf(link.target));

  return (
    <aside className="inspector panel">
      <header className="inspector-head">
        <span className="inspector-title">
          <GitBranch size={14} /> Связь
        </span>
        <button className="icon-btn" title="Закрыть" onClick={() => st().setSelection(null)}>
          <X size={15} />
        </button>
      </header>
      <div className="inspector-body">
        <p className="link-endpoints">
          {source?.label ?? idOf(link.source)}
          <span className="arrow">→</span>
          {target?.label ?? idOf(link.target)}
        </p>

        <label className="field">
          <span>Тип</span>
          <select
            value={link.kind ?? 'связь'}
            onChange={(e) => st().updateLink(link.id, { kind: e.target.value as LinkKind })}
          >
            {LINK_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Подпись</span>
          <input
            value={link.label ?? ''}
            placeholder="например: вызывает, хранит, оплачивает…"
            onChange={(e) => st().updateLink(link.id, { label: e.target.value })}
          />
        </label>

        <button className="btn danger block" onClick={() => st().removeLink(link.id)}>
          <Trash2 size={14} /> Удалить связь
        </button>
      </div>
    </aside>
  );
}
