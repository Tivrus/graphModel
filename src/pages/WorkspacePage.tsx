import { useEffect, useRef } from 'react';
import Graph3DView from '../components/Graph3DView';
import ModeToolbar from '../components/ModeToolbar';
import ClustersPanel from '../components/ClustersPanel';
import Inspector from '../components/Inspector';
import StatusBar from '../components/StatusBar';
import ChatPanel from '../components/ChatPanel';
import { useGraphStore } from '../store/graphStore';

export default function WorkspacePage() {
  const fgRef = useRef<any>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      ) {
        return;
      }
      const st = useGraphStore.getState();
      const key = e.key.toLowerCase();
      if (e.key === 'Escape') {
        st.setMode('select');
        st.setPendingSource(null);
        st.setSelection(null);
        st.setSelectionSet([]);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        st.deleteSelection();
      } else if (key === 'v' || key === 'м') st.setMode('select');
      else if (key === 'a' || key === 'ф') st.setMode('add-node');
      else if (key === 'l' || key === 'д') st.setMode('add-link');
      else if (key === 'd' || key === 'в') st.setMode('delete');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="workspace">
      <Graph3DView fgRef={fgRef} />
      <div className="dock-left">
        <ModeToolbar />
        <ClustersPanel />
      </div>
      <Inspector />
      <ChatPanel />
      <StatusBar onZoomToFit={() => fgRef.current?.zoomToFit?.(900, 60)} />
    </div>
  );
}
