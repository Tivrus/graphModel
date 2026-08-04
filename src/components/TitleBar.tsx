import { Minus, Square, X } from 'lucide-react';
import { isDesktopApp } from '../app/desktop';

/** Кастомный заголовок окна Electron (− □ ×) + drag-region */
export default function TitleBar() {
  if (!isDesktopApp()) return null;

  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <span className="titlebar-title">GraphModel</span>
      </div>
      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-btn"
          title="Свернуть"
          onClick={() => window.graphModel?.windowMinimize()}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          className="titlebar-btn"
          title="Развернуть"
          onClick={() => window.graphModel?.windowMaximize()}
        >
          <Square size={12} />
        </button>
        <button
          type="button"
          className="titlebar-btn danger"
          title="Закрыть"
          onClick={() => window.graphModel?.windowClose()}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
