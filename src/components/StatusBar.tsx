import { useMemo } from 'react';
import { Maximize, PinOff, Zap } from 'lucide-react';
import { getVisibleGraph, useGraphStore } from '../store/graphStore';
import type { ToolMode } from '../types';

interface Props {
  onZoomToFit?: () => void;
}

const MODE_HINT: Record<ToolMode, string> = {
  select: 'ЛКМ — выбор · drag — переместить узел/картинку · Shift+drag — рамка · ПКМ по узлу — слой',
  'add-node': 'Клик по пустому месту — новый узел (если есть выбор — свяжется с ним)',
  'add-link': 'Кликните первый узел, затем второй — связь создана',
  delete: 'Клик по узлу или связи — удалить',
};

export default function StatusBar({ onZoomToFit }: Props) {
  const nodes = useGraphStore((s) => s.nodes);
  const links = useGraphStore((s) => s.links);
  const images = useGraphStore((s) => s.images);
  const collapsedGroups = useGraphStore((s) => s.collapsedGroups);
  const expandedNodes = useGraphStore((s) => s.expandedNodes);
  const mode = useGraphStore((s) => s.mode);
  const pendingSource = useGraphStore((s) => s.pendingSource);
  const selectionSet = useGraphStore((s) => s.selectionSet);
  const physics = useGraphStore((s) => s.settings.physics);
  const activeSlot = useGraphStore((s) => s.activeSlot);
  const backendOnline = useGraphStore((s) => s.backendOnline);
  const backendAi = useGraphStore((s) => s.backendAi);
  const unpinAll = useGraphStore((s) => s.unpinAll);

  const visible = useMemo(
    () => getVisibleGraph(nodes, links, collapsedGroups, expandedNodes),
    [nodes, links, collapsedGroups, expandedNodes],
  );
  const pinnedCount = nodes.filter((n) => n.fx != null).length;

  const hint = mode === 'add-link' && pendingSource ? 'Теперь кликните второй узел' : MODE_HINT[mode];

  return (
    <footer className="statusbar panel">
      <span className="status-mode">{hint}</span>
      <span className="status-right">
        {selectionSet.length > 0 && (
          <span className="badge sel">выбрано {selectionSet.length}</span>
        )}
        <span className={`badge ${backendOnline ? (backendAi ? 'on' : 'warn') : 'off'}`}>
          {backendOnline ? (backendAi ? 'онлайн+AI' : 'онлайн') : 'локально'}
        </span>
        <span className="status-stats">
          проект {activeSlot + 1} · узлы {visible.nodes.length}/{nodes.length} · связи{' '}
          {visible.links.length}
          {images.length > 0 ? ` · картинки ${images.length}` : ''}
          {collapsedGroups.length > 0 ? ` · свернуто ${collapsedGroups.length}` : ''}
        </span>
        {pinnedCount > 0 && (
          <button className="chip" title="Снять закрепление со всех узлов" onClick={unpinAll}>
            <PinOff size={13} /> открепить все ({pinnedCount})
          </button>
        )}
        {onZoomToFit && (
          <button className="chip" title="Вписать граф в экран" onClick={onZoomToFit}>
            <Maximize size={13} /> вписать
          </button>
        )}
        <span className={`badge ${physics ? 'on' : 'off'}`} title="Состояние физической симуляции">
          <Zap size={12} /> {physics ? 'физика' : 'заморожено'}
        </span>
      </span>
    </footer>
  );
}
