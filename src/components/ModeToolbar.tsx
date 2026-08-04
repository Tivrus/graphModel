import { Eraser, Link2, MousePointer2, Plus } from 'lucide-react';
import { useGraphStore } from '../store/graphStore';
import type { ToolMode } from '../types';

const TOOLS: Array<{ id: ToolMode; icon: typeof Plus; label: string; hotkey: string }> = [
  { id: 'select', icon: MousePointer2, label: 'Выбор и перемещение', hotkey: 'V' },
  { id: 'add-node', icon: Plus, label: 'Добавить узел', hotkey: 'A' },
  { id: 'add-link', icon: Link2, label: 'Добавить связь', hotkey: 'L' },
  { id: 'delete', icon: Eraser, label: 'Удалить', hotkey: 'D' },
];

export default function ModeToolbar() {
  const mode = useGraphStore((s) => s.mode);
  const setMode = useGraphStore((s) => s.setMode);

  return (
    <div className="toolbar panel" role="toolbar" aria-label="Инструменты">
      {TOOLS.map(({ id, icon: Icon, label, hotkey }) => (
        <button
          key={id}
          className={`tool-btn ${mode === id ? 'active' : ''}`}
          title={`${label} (${hotkey})`}
          onClick={() => setMode(id)}
        >
          <Icon size={17} />
        </button>
      ))}
    </div>
  );
}
