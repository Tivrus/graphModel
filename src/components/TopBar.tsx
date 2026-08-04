import { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Bot,
  Box,
  Download,
  ImagePlus,
  Map,
  Plus,
  Search,
  Settings,
  Upload,
  X,
} from 'lucide-react';
import { useGraphStore } from '../store/graphStore';
import { groupColor } from '../data/sampleGraph';
import { downloadText, parseGraphFile, readFileAsText, serializeGraph } from '../utils/transfer';
import { MIN_PROJECT_SLOTS, projectIsEmpty } from '../app/project';
import { UTILITY_PATHS } from '../app/tabs';

export default function TopBar() {
  const nodes = useGraphStore((s) => s.nodes);
  const chatOpen = useGraphStore((s) => s.chatOpen);
  const projectSlots = useGraphStore((s) => s.projectSlots);
  const activeSlot = useGraphStore((s) => s.activeSlot);
  const view = useGraphStore((s) => s.view);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return nodes
      .filter((n) => n.label.toLowerCase().includes(q) || n.group.toLowerCase().includes(q))
      .slice(0, 8);
  }, [nodes, query]);

  const goEditor = () => {
    if (UTILITY_PATHS.has(location.pathname)) {
      navigate(view === '2d' ? '/flat' : '/');
    }
  };

  const pick = (id: string) => {
    useGraphStore.getState().requestFocus(id);
    setQuery('');
    setFocused(false);
    useGraphStore.getState().setView('3d');
    navigate('/');
  };

  const onExport = () => {
    const s = useGraphStore.getState();
    const date = new Date().toISOString().slice(0, 10);
    downloadText(
      `graph-model-p${s.activeSlot + 1}-${date}.json`,
      serializeGraph(s.nodes, s.links, s.collapsedGroups, s.expandedNodes, s.images),
    );
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = parseGraphFile(await readFileAsText(file));
      useGraphStore.getState().importData(data);
      goEditor();
    } catch (err) {
      alert(`Не удалось импортировать: ${(err as Error).message}`);
    }
  };

  const onImagesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!files.length) return;
    const st = useGraphStore.getState();
    files.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? '');
        if (!dataUrl) return;
        const angle = Math.random() * Math.PI * 2;
        const radius = 60 + idx * 35;
        st.addImage({
          name: file.name,
          dataUrl,
          x: Math.cos(angle) * radius,
          y: 30 + idx * 18,
          z: Math.sin(angle) * radius,
          scale: 34,
          opacity: 1,
        });
      };
      reader.readAsDataURL(file);
    });
    useGraphStore.getState().setView('3d');
    navigate('/');
  };

  const switchSlot = (i: number) => {
    const st = useGraphStore.getState();
    st.switchProjectSlot(i);
    const nextView = useGraphStore.getState().view;
    navigate(nextView === '2d' ? '/flat' : '/');
  };

  const addSlot = () => {
    useGraphStore.getState().addProjectSlot();
    navigate(useGraphStore.getState().view === '2d' ? '/flat' : '/');
  };

  const closeSlot = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const count = useGraphStore.getState().projectSlots.length;
    if (count <= MIN_PROJECT_SLOTS) {
      if (window.confirm('Очистить единственный проект?')) {
        useGraphStore.getState().clearProjectSlot(i);
      }
      return;
    }
    if (window.confirm(`Закрыть вкладку ${i + 1}?`)) {
      useGraphStore.getState().removeProjectSlot(i);
      const nextView = useGraphStore.getState().view;
      navigate(nextView === '2d' ? '/flat' : '/');
    }
  };

  const onUtility = (path: '/docs' | '/settings') => {
    navigate(path);
  };

  return (
    <header className="topbar">
      <div className="brand" title="GraphModel">
        <Box size={18} />
        <span className="brand-name">GraphModel</span>
      </div>

      <div className="project-tabs" role="tablist" aria-label="Проекты">
        {projectSlots.map((slot, i) => {
          const filled = !projectIsEmpty(slot);
          const active = i === activeSlot && !UTILITY_PATHS.has(location.pathname);
          return (
            <button
              key={slot.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`project-tab ${active ? 'active' : ''} ${filled ? 'filled' : ''}`}
              title={
                filled
                  ? `Проект ${i + 1} · ${slot.nodes.length} узлов`
                  : `Пустой проект ${i + 1}`
              }
              onClick={() => switchSlot(i)}
              onDoubleClick={(e) => {
                e.preventDefault();
                closeSlot(i, e);
              }}
            >
              <span className="project-tab-num">{i + 1}</span>
              <span
                className="project-tab-clear"
                title={projectSlots.length <= MIN_PROJECT_SLOTS ? 'Очистить' : 'Закрыть'}
                onClick={(e) => closeSlot(i, e)}
              >
                <X size={11} />
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className="project-tab-add"
          title="Новый проект"
          onClick={addSlot}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="view-toggle" role="group" aria-label="Режим вида">
        <button
          type="button"
          className={view === '3d' && location.pathname === '/' ? 'active' : ''}
          title="3D"
          onClick={() => {
            useGraphStore.getState().setView('3d');
            navigate('/');
          }}
        >
          <Box size={14} />
        </button>
        <button
          type="button"
          className={view === '2d' && location.pathname === '/flat' ? 'active' : ''}
          title="2D"
          onClick={() => {
            useGraphStore.getState().setView('2d');
            navigate('/flat');
          }}
        >
          <Map size={14} />
        </button>
      </div>

      <div className="top-spacer" />

      <div className={`search ${focused && results.length ? 'open' : ''}`}>
        <Search size={15} className="search-icon" />
        <input
          className="search-input"
          placeholder="Найти узел…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length) pick(results[0].id);
          }}
        />
        {focused && results.length > 0 && (
          <div className="search-results panel">
            {results.map((n) => (
              <button key={n.id} className="search-item" onMouseDown={() => pick(n.id)}>
                <span className="dot" style={{ background: n.color ?? groupColor(n.group) }} />
                <span className="search-label">{n.label}</span>
                <span className="search-group">{n.group}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="top-actions">
        <button className="icon-btn" title="Экспорт проекта" onClick={onExport}>
          <Download size={16} />
        </button>
        <button className="icon-btn" title="Импорт в текущий проект" onClick={() => fileRef.current?.click()}>
          <Upload size={16} />
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImportFile} />
        <button className="icon-btn" title="Картинки в 3D" onClick={() => imgRef.current?.click()}>
          <ImagePlus size={16} />
        </button>
        <input ref={imgRef} type="file" accept="image/*" multiple hidden onChange={onImagesPicked} />
        <button
          className={`icon-btn ${chatOpen ? 'active' : ''}`}
          title="AI-ассистент"
          onClick={() => useGraphStore.getState().toggleChat()}
        >
          <Bot size={16} />
        </button>
        <button
          className={`icon-btn ${location.pathname === '/docs' ? 'active' : ''}`}
          title="Документация"
          onClick={() => onUtility('/docs')}
        >
          <BookOpen size={16} />
        </button>
        <button
          className={`icon-btn ${location.pathname === '/settings' ? 'active' : ''}`}
          title="Настройки"
          onClick={() => onUtility('/settings')}
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}
