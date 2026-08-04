import { Boxes, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { getGroupTree, useGraphStore } from '../store/graphStore';
import { groupColor } from '../data/sampleGraph';
import { flattenGroupTree } from '../utils/groups';

export default function ClustersPanel() {
  const nodes = useGraphStore((s) => s.nodes);
  const collapsedGroups = useGraphStore((s) => s.collapsedGroups);
  const toggleGroupCollapsed = useGraphStore((s) => s.toggleGroupCollapsed);
  const setAllCollapsed = useGraphStore((s) => s.setAllCollapsed);

  const tree = getGroupTree(nodes, collapsedGroups);
  if (tree.length === 0) return null;
  const flat = flattenGroupTree(tree);

  return (
    <div className="clusters panel">
      <div className="clusters-head">
        <span className="clusters-title">
          <Boxes size={14} /> Кластеры
        </span>
        <span className="clusters-actions">
          <button
            className="icon-btn"
            title="Свернуть все"
            onClick={() => setAllCollapsed(flat.map((g) => g.path))}
          >
            <ChevronsDownUp size={14} />
          </button>
          <button className="icon-btn" title="Развернуть все" onClick={() => setAllCollapsed([])}>
            <ChevronsUpDown size={14} />
          </button>
        </span>
      </div>
      <div className="clusters-list">
        {flat.map((g) => (
          <button
            key={g.path}
            className={`cluster-row ${g.collapsed ? 'collapsed' : ''} depth-${Math.min(g.depth, 6)}`}
            style={{ paddingLeft: 10 + g.depth * 12 }}
            onClick={() => toggleGroupCollapsed(g.path)}
            title={
              g.collapsed
                ? `Развернуть «${g.path}»`
                : `Свернуть «${g.path}»${g.children.length ? ' и все подгруппы' : ''}`
            }
          >
            <span className="dot" style={{ background: groupColor(g.path) }} />
            <span className="cluster-name">{g.name}</span>
            <span className="cluster-count">{g.total}</span>
            {g.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        ))}
      </div>
      <p className="clusters-hint hint">подгруппы: путь через / · глубина не ограничена</p>
    </div>
  );
}
