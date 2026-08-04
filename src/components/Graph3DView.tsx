import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { getVisibleGraph, useGraphStore } from '../store/graphStore';
import { groupColor } from '../data/sampleGraph';
import { applySimulationForces } from '../utils/physics';

interface Props {
  fgRef: MutableRefObject<any>;
}

type DiscVariant = 'plain' | 'cluster' | 'ring';

interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const TEX_CACHE = new Map<string, THREE.Texture>();
const SCRATCH_V = new THREE.Vector3();

const rgba = (hex: string, a: number): string => {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
};

/** Плоская «монета» узла: градиентный диск (+ пунктирное кольцо у кластера / кольцо выделения). */
function makeDiscTexture(color: string, variant: DiscVariant): THREE.Texture {
  const key = `${color}:${variant}`;
  const cached = TEX_CACHE.get(key);
  if (cached) return cached;

  const S = 192;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const c = S / 2;

  if (variant === 'ring') {
    ctx.fillStyle = rgba(color, 0.14);
    ctx.beginPath();
    ctx.arc(c, c, c - 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(c, c, c - 12, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const lighter = `#${new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.38).getHexString()}`;
    const inset = variant === 'cluster' ? 26 : 10;
    const grad = ctx.createRadialGradient(c * 0.75, c * 0.7, S * 0.08, c, c, c - inset);
    grad.addColorStop(0, lighter);
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c, c, c - inset, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();
    if (variant === 'cluster') {
      ctx.strokeStyle = rgba(color, 0.9);
      ctx.lineWidth = 6;
      ctx.setLineDash([16, 11]);
      ctx.beginPath();
      ctx.arc(c, c, c - 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  TEX_CACHE.set(key, tex);
  return tex;
}

const checkWebGL = (): boolean => {
  try {
    const cv = document.createElement('canvas');
    return !!(cv.getContext('webgl2') || cv.getContext('webgl'));
  } catch {
    return false;
  }
};

export default function Graph3DView({ fgRef }: Props) {
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
  const images = useGraphStore((s) => s.images);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [webglOk] = useState(checkWebGL);

  const containerRef = useRef<HTMLDivElement>(null);
  const [shiftDown, setShiftDown] = useState(false);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const marqueeRef = useRef<Marquee | null>(null);
  const suppressClickRef = useRef(false);
  const starsRef = useRef<THREE.Points | null>(null);

  const data = useMemo(
    () => getVisibleGraph(nodes, links, collapsedGroups, expandedNodes),
    [nodes, links, collapsedGroups, expandedNodes],
  );
  const dataRef = useRef(data);
  dataRef.current = data;

  // движок готов только после первого реального тика: до этого state.layout
  // внутри three-forcegraph ещё не создан, и d3ReheatSimulation уронит цикл отрисовки
  const engineReadyRef = useRef(false);
  const pendingReheatRef = useRef(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const onEngineAlive = useCallback(() => {
    const first = !engineReadyRef.current;
    engineReadyRef.current = true;
    if (first) {
      // первый тик: до него d3Force может быть ещё «дефолтным»
      applySimulationForces(fgRef.current, settingsRef.current, 3);
      if (pendingReheatRef.current) {
        pendingReheatRef.current = false;
        setTimeout(() => fgRef.current?.d3ReheatSimulation?.(), 0);
      }
    }
  }, [fgRef]);

  // параметры физики
  useEffect(() => {
    if (!fgRef.current || !engineReadyRef.current) {
      pendingReheatRef.current = true;
      return;
    }
    applySimulationForces(fgRef.current, settings, 3);
  }, [settings.charge, settings.linkDistance, settings.nodeScale, settings.physics, fgRef]);

  // сенса камеры
  useEffect(() => {
    const controls = fgRef.current?.controls?.();
    if (!controls) return;
    controls.rotateSpeed = settings.sensitivity;
    controls.panSpeed = settings.sensitivity;
    controls.zoomSpeed = settings.zoomSensitivity;
  }, [settings.sensitivity, settings.zoomSensitivity, fgRef]);

  // пересоздание three-объектов при смене визуального состояния
  useEffect(() => {
    const t = setTimeout(() => fgRef.current?.refresh?.(), 0);
    return () => clearTimeout(t);
  }, [selection, selectionSet, pendingSource, settings.showLabels, settings.nodeScale, fgRef]);

  // звёздное пространство: шейдер с мерцанием (фаза/скорость у каждой звезды свои)
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const scene = fg.scene();
    const density = Math.max(0.05, Math.min(3, settings.starsDensity ?? 1));
    const N = Math.max(80, Math.round(2600 * density));
    const positions = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const phases = new Float32Array(N);
    const speeds = new Float32Array(N);
    const colors = new Float32Array(N * 3);
    const palette = ['#9fb4dd', '#7d8cb0', '#c7d3f2', '#8fa6d9', '#b9c8ee'].map(
      (c) => new THREE.Color(c),
    );
    for (let i = 0; i < N; i++) {
      const radius = 650 + Math.random() * 1000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
      sizes[i] = 1.4 + Math.random() * 3.4;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.4 + Math.random() * 2.4;
      const col = palette[(Math.random() * palette.length) | 0];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelScale: { value: 800 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aPhase;
        attribute float aSpeed;
        attribute vec3 aColor;
        uniform float uTime;
        uniform float uPixelScale;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vColor = aColor;
          float tw = 0.62 + 0.38 * sin(uTime * aSpeed + aPhase);
          vAlpha = tw;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (0.6 + 0.4 * tw) * uPixelScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.06, d) * vAlpha * 0.85;
          if (a < 0.012) discard;
          gl_FragColor = vec4(vColor, a);
        }
      `,
    });
    const stars = new THREE.Points(geo, mat);
    stars.frustumCulled = false;
    scene.add(stars);
    starsRef.current = stars;

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      mat.uniforms.uTime.value = clock.getElapsedTime();
      const cam = fg.camera?.();
      const h = fg.renderer?.()?.domElement?.clientHeight ?? 800;
      if (cam?.fov) {
        mat.uniforms.uPixelScale.value = h / (2 * Math.tan((cam.fov * Math.PI) / 360));
      }
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      scene.remove(stars);
      starsRef.current = null;
      geo.dispose();
      mat.dispose();
    };
  }, [fgRef, settings.starsDensity]);

  // видимость звёзд — без пересборки геометрии
  useEffect(() => {
    const stars = starsRef.current;
    if (stars) stars.visible = settings.stars;
  }, [settings.stars]);

  // атмосферный туман — отдельно от звёзд (starsDistance только отодвигает туман)
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const dist = Math.max(0.4, Math.min(2.4, settings.starsDistance ?? 1));
    fg.scene().fog = new THREE.Fog(
      new THREE.Color(settings.background),
      520 * dist,
      2300 * dist,
    );
  }, [settings.background, settings.starsDistance, fgRef]);

  // ---------- картинки-билборды ----------

  const imagesGroupRef = useRef<THREE.Group | null>(null);
  // каждая картинка — группа (спрайт + ореол внутри), drag двигает группу целиком
  const imageSpritesRef = useRef(
    new Map<string, { group: THREE.Group; spr: THREE.Sprite; halo: THREE.Sprite }>(),
  );
  const draggingImageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const group = new THREE.Group();
    fg.scene().add(group);
    imagesGroupRef.current = group;
    return () => {
      fg.scene().remove(group);
      imagesGroupRef.current = null;
      imageSpritesRef.current.clear();
    };
  }, [fgRef]);

  // синхронизация спрайтов со стором
  useEffect(() => {
    const group = imagesGroupRef.current;
    if (!group) return;
    const selectedImageId = selection?.type === 'image' ? selection.id : null;
    const seen = new Set<string>();

    for (const img of images) {
      seen.add(img.id);
      let entry = imageSpritesRef.current.get(img.id);
      if (!entry) {
        const g = new THREE.Group();
        const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
        const spr = new THREE.Sprite(mat);
        spr.userData.imageId = img.id;
        spr.userData.aspect = 1;
        new THREE.TextureLoader().load(img.dataUrl, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          mat.map = tex;
          spr.userData.aspect = tex.image?.width && tex.image?.height
            ? tex.image.width / tex.image.height
            : 1;
          mat.needsUpdate = true;
          // пересчитать масштаб сразу после загрузки текстуры
          const cur = useGraphStore.getState().images.find((i) => i.id === img.id);
          if (cur) spr.scale.set(cur.scale * spr.userData.aspect, cur.scale, 1);
        });
        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: makeDiscTexture('#38bdf8', 'ring'),
            transparent: true,
            depthWrite: false,
            opacity: 0.9,
          }),
        );
        halo.visible = false;
        g.add(halo);
        g.add(spr);
        group.add(g);
        entry = { group: g, spr, halo };
        imageSpritesRef.current.set(img.id, entry);
      }
      // пока картинку тащат мышью, позицию из стора не применяем — объект двигается напрямую
      if (draggingImageIdRef.current !== img.id) {
        entry.group.position.set(img.x, img.y, img.z);
      }
      const aspect = entry.spr.userData.aspect ?? 1;
      entry.spr.scale.set(img.scale * aspect, img.scale, 1);
      entry.spr.material.opacity = img.opacity;
      const hSize = img.scale * Math.max(aspect, 1) * 1.22 + 4;
      entry.halo.scale.set(hSize, hSize, 1);
      entry.halo.visible = selectedImageId === img.id;
    }

    for (const [id, entry] of imageSpritesRef.current) {
      if (!seen.has(id)) {
        group.remove(entry.group);
        entry.spr.material.map?.dispose();
        entry.spr.material.dispose();
        entry.halo.material.map = null;
        entry.halo.material.dispose();
        imageSpritesRef.current.delete(id);
      }
    }
  }, [images, selection]);

  // рейкаст клика по картинкам (они не часть force-графа)
  const pickImage = useCallback(
    (e: { clientX: number; clientY: number }): string | null => {
      const fg = fgRef.current;
      const group = imagesGroupRef.current;
      if (!fg || !group || imageSpritesRef.current.size === 0) return null;
      const rect = fg.renderer().domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, fg.camera());
      const sprites = [...imageSpritesRef.current.values()].map((en) => en.spr);
      const hits = ray.intersectObjects(sprites, false);
      return hits.length ? (hits[0].object.userData.imageId as string) : null;
    },
    [fgRef],
  );

  // ---------- перетаскивание картинок ----------

  const [hoverImageId, setHoverImageId] = useState<string | null>(null);
  const [imageDragging, setImageDragging] = useState(false);
  const imageDragRef = useRef<{ move: (e: MouseEvent) => void; up: (e: MouseEvent) => void } | null>(null);

  useEffect(
    () => () => {
      const d = imageDragRef.current;
      if (d) {
        window.removeEventListener('mousemove', d.move);
        window.removeEventListener('mouseup', d.up);
      }
    },
    [],
  );

  // hover по картинке: меняем курсор и блокируем drag узлов под ней
  const onCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (marqueeRef.current || imageDragRef.current) return;
      if (e.shiftKey || useGraphStore.getState().mode !== 'select') {
        if (hoverImageId) setHoverImageId(null);
        return;
      }
      const hit = pickImage(e.nativeEvent);
      if (hit !== hoverImageId) setHoverImageId(hit);
    },
    [pickImage, hoverImageId],
  );

  // drag по механике three.js DragControls (той же, что двигает узлы):
  // объект двигается напрямую в сцене, в стор позиция коммитится один раз — на mouseup
  const startImageDrag = useCallback(
    (e: React.MouseEvent, imageId: string) => {
      const fg = fgRef.current;
      const entry = imageSpritesRef.current.get(imageId);
      if (!fg || !entry) return;

      const obj = entry.group;
      const dom = fg.renderer().domElement;
      const cam = fg.camera();
      const ray = new THREE.Raycaster();
      // плоскость перпендикулярна взгляду камеры и проходит через объект
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        cam.getWorldDirection(new THREE.Vector3()),
        obj.position,
      );
      const toNdc = (ev: { clientX: number; clientY: number }) => {
        const rect = dom.getBoundingClientRect();
        return new THREE.Vector2(
          ((ev.clientX - rect.left) / rect.width) * 2 - 1,
          -((ev.clientY - rect.top) / rect.height) * 2 + 1,
        );
      };

      ray.setFromCamera(toNdc(e.nativeEvent), cam);
      const intersection = new THREE.Vector3();
      if (!ray.ray.intersectPlane(plane, intersection)) return;
      const offset = intersection.clone().sub(obj.position);

      const controls = fg.controls?.();
      if (controls) controls.enabled = false;
      draggingImageIdRef.current = imageId;
      setImageDragging(true);
      useGraphStore.getState().setSelection({ type: 'image', id: imageId });

      const move = (ev: MouseEvent) => {
        ray.setFromCamera(toNdc(ev), cam);
        if (ray.ray.intersectPlane(plane, intersection)) {
          obj.position.copy(intersection.sub(offset));
        }
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        imageDragRef.current = null;
        draggingImageIdRef.current = null;
        setImageDragging(false);
        if (controls) controls.enabled = true;
        // зафиксировать позицию в сторе один раз
        useGraphStore.getState().updateImage(imageId, {
          x: obj.position.x,
          y: obj.position.y,
          z: obj.position.z,
        });
        // гасим послележащий click, чтобы не сбросить выделение
        suppressClickRef.current = true;
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 60);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      imageDragRef.current = { move, up };
    },
    [fgRef],
  );

  // при первом показе вписать граф в экран, чтобы сцена не выглядела пустой
  useEffect(() => {
    const t = setTimeout(() => fgRef.current?.zoomToFit?.(1200, 70), 900);
    return () => clearTimeout(t);
  }, [fgRef]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__fg = fgRef.current;
    }
  }, [fgRef]);

  // фокус камеры по запросу (поиск)
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
      if (node.x == null) {
        if (attempts++ < 10) setTimeout(tryFocus, 250);
        return;
      }
      const y = node.y ?? 0;
      const z = node.z ?? 0;
      const dist = 150;
      const hyp = Math.hypot(node.x, y, z) || 1;
      const ratio = 1 + dist / hyp;
      fg.cameraPosition(
        { x: node.x * ratio, y: y * ratio, z: z * ratio },
        { x: node.x, y, z },
        1100,
      );
    };
    const t = setTimeout(tryFocus, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [focusRequest, fgRef]);

  // ---------- рамка выделения (Shift + drag) ----------

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // пока зажат Shift — камера и drag узлов отключены, мышь рисует рамку
  useEffect(() => {
    const controls = fgRef.current?.controls?.();
    if (controls) controls.enabled = !shiftDown;
  }, [shiftDown, fgRef]);

  const finishMarquee = useCallback(
    (m: Marquee) => {
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 60);

      const fg = fgRef.current;
      if (!fg) return;
      const x0 = Math.min(m.x0, m.x1);
      const x1 = Math.max(m.x0, m.x1);
      const y0 = Math.min(m.y0, m.y1);
      const y1 = Math.max(m.y0, m.y1);
      if (x1 - x0 < 4 && y1 - y0 < 4) return; // микродраг = обычный клик

      const st = useGraphStore.getState();
      const cam = fg.camera();
      const heightPx = containerRef.current?.clientHeight ?? 800;
      const fov = ((cam?.fov ?? 60) * Math.PI) / 360;
      const hits: string[] = [];

      for (const n of dataRef.current.nodes) {
        if (n.isCluster || n.x == null) continue;
        const p = fg.graph2ScreenCoords(n.x, n.y ?? 0, n.z ?? 0);
        if (!p) continue;
        const inside = p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
        if (inside) {
          hits.push(n.id);
          continue;
        }
        if (st.settings.tolerantSelect && cam) {
          // толерантный режим: узел считается выделенным, если его диск задет рамкой
          const dist = cam.position.distanceTo(SCRATCH_V.set(n.x, n.y ?? 0, n.z ?? 0));
          const rWorld = Math.max(2.2, (n.size ?? 6) * 0.85) * st.settings.nodeScale * 1.15;
          const pxR = dist > 0 ? (rWorld / (2 * dist * Math.tan(fov))) * heightPx : 0;
          const cx = Math.max(x0, Math.min(p.x, x1));
          const cy = Math.max(y0, Math.min(p.y, y1));
          if ((p.x - cx) ** 2 + (p.y - cy) ** 2 <= pxR * pxR) hits.push(n.id);
        }
      }
      st.setSelectionSet(hits);
    },
    [fgRef],
  );

  const marqueeListenersRef = useRef<{ move: (e: MouseEvent) => void; up: (e: MouseEvent) => void } | null>(null);

  useEffect(
    () => () => {
      const l = marqueeListenersRef.current;
      if (l) {
        window.removeEventListener('mousemove', l.move);
        window.removeEventListener('mouseup', l.up);
      }
    },
    [],
  );

  const onMarqueeDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // без Shift в режиме выбора — начать перетаскивание картинки под курсором
      if (!e.shiftKey && hoverImageId && useGraphStore.getState().mode === 'select') {
        startImageDrag(e, hoverImageId);
        return;
      }
      if (!e.shiftKey) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const m = {
        x0: e.clientX - rect.left,
        y0: e.clientY - rect.top,
        x1: e.clientX - rect.left,
        y1: e.clientY - rect.top,
      };
      marqueeRef.current = m;
      setMarquee(m);

      // слушатели навешиваются сразу, в том же тике — никакая гонка с рендером не возможна
      const move = (ev: MouseEvent) => {
        const r = containerRef.current?.getBoundingClientRect();
        if (!r || !marqueeRef.current) return;
        const next = { ...marqueeRef.current, x1: ev.clientX - r.left, y1: ev.clientY - r.top };
        marqueeRef.current = next;
        setMarquee(next);
      };
      const up = (ev: MouseEvent) => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        marqueeListenersRef.current = null;
        const r = containerRef.current?.getBoundingClientRect();
        const final = marqueeRef.current && r
          ? { ...marqueeRef.current, x1: ev.clientX - r.left, y1: ev.clientY - r.top }
          : null;
        marqueeRef.current = null;
        setMarquee(null);
        if (final) finishMarquee(final);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      marqueeListenersRef.current = { move, up };
    },
    [finishMarquee, hoverImageId, startImageDrag],
  );

  // ---------- внешний вид узлов ----------

  const selectedNodeId = selection?.type === 'node' ? selection.id : null;
  const selectedLinkId = selection?.type === 'link' ? selection.id : null;

  // узел — плоский билборд, всегда развёрнутый к камере
  const nodeObject = useCallback(
    (node: any) => {
      const g = new THREE.Group();
      const r = Math.max(2.2, (node.size ?? 6) * 0.85) * settings.nodeScale;
      const color = node.color ?? groupColor(node.group);
      const isSel = selectedNodeId === node.id || selectionSet.includes(node.id);
      const isPending = pendingSource === node.id;

      const disc = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: makeDiscTexture(color, node.isCluster ? 'cluster' : 'plain'),
          transparent: true,
          alphaTest: 0.08,
        }),
      );
      disc.scale.set(r * 2.3, r * 2.3, 1);
      g.add(disc);

      if (isSel || isPending) {
        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: makeDiscTexture(isPending ? '#fbbf24' : '#38bdf8', 'ring'),
            transparent: true,
            depthWrite: false,
            opacity: 0.95,
          }),
        );
        halo.scale.set(r * 3.6, r * 3.6, 1);
        g.add(halo);
      }

      if (settings.showLabels) {
        const text = node.isCluster ? `${node.label} · ${node.clusterSize ?? ''}` : node.label;
        const sprite = new SpriteText(text);
        sprite.color = 'rgba(226,232,240,0.95)';
        sprite.textHeight = Math.max(2.6, r * 0.42);
        sprite.backgroundColor = 'rgba(4,8,18,0.55)';
        sprite.padding = 1.1;
        sprite.borderRadius = 2.5;
        sprite.position.y = r * 1.25 + sprite.textHeight * 0.9;
        g.add(sprite);
      }
      return g;
    },
    [settings.nodeScale, settings.showLabels, selectedNodeId, selectionSet, pendingSource],
  );

  // ---------- события ----------

  const onNodeClick = useCallback((node: any, event?: MouseEvent) => {
    if (suppressClickRef.current) return;
    const st = useGraphStore.getState();
    if (node.isCluster) {
      st.toggleGroupCollapsed(node.group);
      return;
    }
    if (event?.shiftKey) {
      st.toggleInSelectionSet(node.id);
      return;
    }
    if (st.mode === 'add-link') {
      if (!st.pendingSource) {
        st.setPendingSource(node.id);
      } else {
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

  const onNodeRightClick = useCallback((node: any) => {
    const st = useGraphStore.getState();
    if (node.isCluster) return;
    if (st.nodes.some((n) => n.parentId === node.id)) st.toggleNodeExpanded(node.id);
  }, []);

  const onBackgroundClick = useCallback(
    (event?: MouseEvent) => {
      if (suppressClickRef.current) return;
      const st = useGraphStore.getState();
      // клик мог попасть по картинке-билборду (для force-графа это «фон»)
      const hitImage = event ? pickImage(event) : null;
      if (hitImage) {
        if (st.mode === 'delete') st.removeImage(hitImage);
        else st.setSelection({ type: 'image', id: hitImage });
        return;
      }
      if (st.mode === 'add-node') {
        const sel =
          st.selection?.type === 'node' ? st.nodes.find((n) => n.id === st.selection!.id) : undefined;
        const jitter = () => (Math.random() - 0.5) * 70;
        const anchor = sel && sel.x != null ? sel : undefined;
        const pos = anchor
          ? { x: (anchor.x ?? 0) + jitter(), y: (anchor.y ?? 0) + jitter(), z: (anchor.z ?? 0) + jitter() }
          : { x: jitter(), y: jitter(), z: jitter() };
        const id = st.addNode({ ...pos, group: sel?.group ?? 'Новые' }, sel?.id);
        st.setSelection({ type: 'node', id });
      } else {
        st.setPendingSource(null);
        if (st.mode === 'select') {
          st.setSelection(null);
          st.setSelectionSet([]);
        }
      }
    },
    [pickImage],
  );

  const onLinkClick = useCallback((link: any) => {
    if (suppressClickRef.current) return;
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

  const cursor = imageDragging
    ? 'grabbing'
    : shiftDown
      ? 'crosshair'
      : mode === 'add-node' || mode === 'add-link'
        ? 'crosshair'
        : mode === 'delete'
          ? 'not-allowed'
          : hoverImageId
            ? 'grab'
            : hoverId
              ? 'pointer'
              : 'default';

  if (!webglOk) {
    return (
      <div className="webgl-fallback">
        <div className="panel webgl-fallback-card">
          <h3>WebGL недоступен</h3>
          <p>
            Браузер не смог создать WebGL-контекст, поэтому 3D-сцена не может быть отрисована.
            Проверьте, что аппаратное ускорение включено. Граф полностью доступен на странице
            «2D Карта».
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="graph-canvas"
      style={{ cursor }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={onMarqueeDown}
      onMouseMove={onCanvasMouseMove}
    >
      <ForceGraph3D
        ref={fgRef}
        graphData={data as any}
        nodeId="id"
        nodeThreeObject={nodeObject}
        nodeLabel={(n: any) => `${n.label} · ${n.group}`}
        linkLabel={(l: any) => `${l.kind ?? 'связь'}${l.label ? ' · ' + l.label : ''}`}
        linkColor={(l: any) =>
          selectedLinkId === l.id ? '#38bdf8' : l.kind === 'зависимость' ? '#b48bf0' : '#8b9bb8'
        }
        linkWidth={(l: any) => (selectedLinkId === l.id ? 2.6 : l.kind === 'зависимость' ? 0.7 : 1.1)}
        linkOpacity={settings.linkOpacity}
        linkCurvature={(l: any) => (l.kind === 'поток' ? 0.18 : 0)}
        linkDirectionalParticles={settings.particles ? 2 : 0}
        linkDirectionalParticleWidth={1.7}
        linkDirectionalParticleSpeed={0.0045}
        backgroundColor={settings.background}
        showNavInfo={false}
        cooldownTime={settings.physics ? 15000 : 0}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.28}
        enableNodeDrag={!shiftDown && !hoverImageId}
        enableNavigationControls
        onNodeClick={onNodeClick}
        onNodeRightClick={onNodeRightClick}
        onNodeDrag={onNodeDrag}
        onNodeDragEnd={onNodeDragEnd}
        onNodeHover={(n: any) => setHoverId(n ? n.id : null)}
        onLinkClick={onLinkClick}
        onBackgroundClick={onBackgroundClick}
        onEngineTick={onEngineAlive}
        onEngineStop={onEngineAlive}
      />
      {marquee && (
        <div
          className="marquee"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      )}
    </div>
  );
}
