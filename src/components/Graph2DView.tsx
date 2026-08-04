import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { getVisibleGraph, useGraphStore } from '../store/graphStore';
import { groupColor } from '../data/sampleGraph';
import {
  convexHull,
  groupDepth,
  groupLeaf,
  groupPrefixes,
  normalizeGroupPath,
} from '../utils/groups';
import { applySimulationForces } from '../utils/physics';

interface Props {
  fgRef: MutableRefObject<any>;
}

function hexAlpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(148,163,184,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export default function Graph2DView({ fgRef }: Props) {
  const nodes = useGraphStore((s) => s.nodes);
  const links = useGraphStore((s) => s.links);
  const collapsedGroups = useGraphStore((s) => s.collapsedGroups);
  const expandedNodes = useGraphStore((s) => s.expandedNodes);
  const selection = useGraphStore((s) => s.selection);
  const selectionSet = useGraphStore((s) => s.selectionSet);
  const mode = useGraphStore((s) => s.mode);
  const pendingSource = useGraphStore((s) => s.pendingSource);
  const settings = useGraphStore((s) => s.settings);
  const focusRequest = useGraphStore((s) => s.focusRequest);

  const data = useMemo(
    () => getVisibleGraph(nodes, links, collapsedGroups, expandedNodes),
    [nodes, links, collapsedGroups, expandedNodes],
  );
  const dataRef = useRef(data);
  dataRef.current = data;

  // см. Graph3DView: подогревать движок можно только после первого тика
  const engineReadyRef = useRef(false);
  const pendingReheatRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const onEngineAlive = useCallback(() => {
    const first = !engineReadyRef.current;
    engineReadyRef.current = true;
    if (first) {
      applySimulationForces(fgRef.current, settingsRef.current, 2);
      if (pendingReheatRef.current) {
        pendingReheatRef.current = false;
        setTimeout(() => fgRef.current?.d3ReheatSimulation?.(), 0);
      }
    }
  }, [fgRef]);

  useEffect(() => {
    if (!fgRef.current || !engineReadyRef.current) {
      pendingReheatRef.current = true;
      return;
    }
    applySimulationForces(fgRef.current, settings, 2);
  }, [settings.charge, settings.linkDistance, settings.nodeScale, settings.physics, fgRef]);

  useEffect(() => {
    if (!focusRequest) return;
    let cancelled = false;
    let attempts = 0;
    const tryFocus = () => {
      if (cancelled) return;
      const fg = fgRef.current;
      if (!fg) return;
      const node = dataRef.current.nodes.find((n) => n.id === focusRequest.id);
      if (!node) return;
      if (node.x == null || node.y == null) {
        if (attempts++ < 10) setTimeout(tryFocus, 250);
        return;
      }
      fg.centerAt(node.x, node.y, 900);
      fg.zoom(2.4, 900);
    };
    const t = setTimeout(tryFocus, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [focusRequest, fgRef]);

  const selectedNodeId = selection?.type === 'node' ? selection.id : null;
  const selectedLinkId = selection?.type === 'link' ? selection.id : null;

  const radius = useCallback(
    (node: any) => Math.max(2.6, (node.size ?? 6) * 0.9) * settings.nodeScale,
    [settings.nodeScale],
  );

  /** контуры групп и подгрупп — рисуются под узлами */
  const paintGroupHulls = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      const visible = dataRef.current.nodes.filter(
        (n) => !n.isCluster && n.x != null && n.y != null,
      );
      if (visible.length < 2) return;

      const byPath = new Map<string, Array<{ x: number; y: number; r: number }>>();
      for (const n of visible) {
        const g = normalizeGroupPath(n.group);
        if (!g) continue;
        const r = radius(n);
        for (const prefix of groupPrefixes(g)) {
          const list = byPath.get(prefix) ?? [];
          list.push({ x: n.x!, y: n.y!, r });
          byPath.set(prefix, list);
        }
      }

      const paths = [...byPath.entries()]
        .filter(([, pts]) => pts.length >= 2)
        .sort((a, b) => groupDepth(a[0]) - groupDepth(b[0]));

      for (const [path, members] of paths) {
        const depth = groupDepth(path);
        const pad = (14 + depth * 4) / Math.max(globalScale, 0.35);
        const expanded = members.flatMap((p) => {
          const pts: Array<{ x: number; y: number }> = [];
          for (let i = 0; i < 8; i++) {
            const a = (Math.PI * 2 * i) / 8;
            pts.push({
              x: p.x + Math.cos(a) * (p.r + pad),
              y: p.y + Math.sin(a) * (p.r + pad),
            });
          }
          return pts;
        });
        const hull = convexHull(expanded);
        if (hull.length < 3) continue;

        const color = groupColor(path);
        ctx.beginPath();
        ctx.moveTo(hull[0].x, hull[0].y);
        for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
        ctx.closePath();
        ctx.fillStyle = hexAlpha(color, depth === 0 ? 0.07 : 0.1);
        ctx.fill();
        ctx.setLineDash(depth === 0 ? [] : [5 / globalScale, 4 / globalScale]);
        ctx.strokeStyle = hexAlpha(color, depth === 0 ? 0.45 : 0.55);
        ctx.lineWidth = (depth === 0 ? 1.6 : 1.2) / globalScale;
        ctx.stroke();
        ctx.setLineDash([]);

        if (settings.showLabels) {
          let top = hull[0];
          for (const p of hull) if (p.y < top.y) top = p;
          const fontSize = Math.max(10 / globalScale, 1.4);
          ctx.font = `600 ${fontSize}px 'Segoe UI', system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = hexAlpha(color, 0.85);
          ctx.fillText(groupLeaf(path), top.x, top.y - 2 / globalScale);
        }
      }
    },
    [radius, settings.showLabels],
  );

  const nodePaint = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const r = radius(node);
      const color = node.color ?? groupColor(node.group);
      const isSel = selectedNodeId === node.id || selectionSet.includes(node.id);
      const isPending = pendingSource === node.id;

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      if (node.isCluster) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 1.45, 0, 2 * Math.PI);
        ctx.setLineDash([3 / globalScale, 3 / globalScale]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2 / globalScale;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (isSel || isPending) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 1.7, 0, 2 * Math.PI);
        ctx.strokeStyle = isPending ? '#fbbf24' : '#38bdf8';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      if (settings.showLabels) {
        const fontSize = Math.max(11 / globalScale, 1.6);
        ctx.font = `${fontSize}px 'Segoe UI', system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(226,232,240,0.92)';
        const text = node.isCluster
          ? `${groupLeaf(node.group)} · ${node.clusterSize ?? ''}`
          : node.label;
        ctx.fillText(text, node.x, node.y + r + fontSize * 0.5);
      }
    },
    [radius, selectedNodeId, selectionSet, pendingSource, settings.showLabels],
  );

  const pointerArea = useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius(node) + 2.5, 0, 2 * Math.PI);
      ctx.fill();
    },
    [radius],
  );

  const onNodeClick = useCallback((node: any) => {
    const st = useGraphStore.getState();
    if (node.isCluster) {
      st.toggleGroupCollapsed(node.group);
      return;
    }
    if (st.mode === 'add-link') {
      if (!st.pendingSource) st.setPendingSource(node.id);
      else {
        const from = st.pendingSource;
        st.setPendingSource(null);
        if (from !== node.id) st.addLink(from, node.id);
      }
    } else if (st.mode === 'delete') {
      st.removeNode(node.id);
    } else {
      st.setSelection({ type: 'node', id: node.id });
    }
  }, []);

  const onBackgroundClick = useCallback((_event: MouseEvent, coords: { x: number; y: number }) => {
    const st = useGraphStore.getState();
    if (st.mode === 'add-node') {
      const sel =
        st.selection?.type === 'node' ? st.nodes.find((n) => n.id === st.selection!.id) : undefined;
      const id = st.addNode(
        { x: coords.x, y: coords.y, z: 0, group: sel?.group ?? 'Новые' },
        sel?.id,
      );
      st.setSelection({ type: 'node', id });
    } else {
      st.setPendingSource(null);
      if (st.mode === 'select') st.setSelection(null);
    }
  }, []);

  const onNodeRightClick = useCallback((node: any) => {
    const st = useGraphStore.getState();
    if (node.isCluster) return;
    if (st.nodes.some((n) => n.parentId === node.id)) st.toggleNodeExpanded(node.id);
  }, []);

  const onLinkClick = useCallback((link: any) => {
    const st = useGraphStore.getState();
    if (st.mode === 'delete') st.removeLink(link.id);
    else st.setSelection({ type: 'link', id: link.id });
  }, []);

  const draggedRef = useRef(false);
  const onNodeDrag = useCallback(() => {
    draggedRef.current = true;
  }, []);

  const onNodeDragEnd = useCallback((node: any) => {
    const st = useGraphStore.getState();
    const moved = draggedRef.current;
    draggedRef.current = false;
    if (node.isCluster || !moved) return;
    if (st.settings.pinOnDrag) st.pinNode(node.id, true);
  }, []);

  const cursor =
    mode === 'add-node' || mode === 'add-link' ? 'crosshair' : mode === 'delete' ? 'not-allowed' : 'default';

  return (
    <div className="graph-canvas" style={{ cursor }} onContextMenu={(e) => e.preventDefault()}>
      <ForceGraph2D
        ref={fgRef}
        graphData={data as any}
        nodeId="id"
        nodeCanvasObject={nodePaint}
        nodePointerAreaPaint={pointerArea}
        nodeLabel={(n: any) => `${n.label} · ${n.group}`}
        linkLabel={(l: any) => `${l.kind ?? 'связь'}${l.label ? ' · ' + l.label : ''}`}
        linkColor={(l: any) => (selectedLinkId === l.id ? '#38bdf8' : '#8b9bb8')}
        linkWidth={(l: any) => (selectedLinkId === l.id ? 2.4 : 1)}
        linkCurvature={(l: any) => (l.kind === 'поток' ? 0.18 : 0)}
        linkLineDash={(l: any) => (l.kind === 'зависимость' ? [4, 3] : null)}
        linkDirectionalParticles={settings.particles ? 2 : 0}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.0045}
        backgroundColor={settings.background}
        cooldownTime={settings.physics ? 15000 : 0}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.28}
        enableNodeDrag
        onNodeClick={onNodeClick}
        onNodeRightClick={onNodeRightClick}
        onNodeDrag={onNodeDrag}
        onNodeDragEnd={onNodeDragEnd}
        onLinkClick={onLinkClick}
        onBackgroundClick={onBackgroundClick as any}
        onEngineTick={onEngineAlive}
        onEngineStop={onEngineAlive}
        onRenderFramePre={paintGroupHulls}
      />
    </div>
  );
}
