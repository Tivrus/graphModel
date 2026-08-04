import { useRef } from 'react';
import Graph2DView from '../components/Graph2DView';
import ModeToolbar from '../components/ModeToolbar';
import ClustersPanel from '../components/ClustersPanel';
import Inspector from '../components/Inspector';
import StatusBar from '../components/StatusBar';

export default function FlatViewPage() {
  const fgRef = useRef<any>(null);

  return (
    <div className="workspace flat-page">
      <Graph2DView fgRef={fgRef} />
      <div className="dock-left">
        <ModeToolbar />
        <ClustersPanel />
      </div>
      <div className="flat-note panel">
        2D-проекция: группы и подгруппы обведены контурами · путь группы через /
      </div>
      <Inspector />
      <StatusBar onZoomToFit={() => fgRef.current?.zoomToFit?.(900, 60)} />
    </div>
  );
}
