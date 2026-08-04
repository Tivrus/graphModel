import { forceCollide } from 'd3-force-3d';
import type { VizSettings } from '../types';

type LayoutSettings = Pick<VizSettings, 'charge' | 'linkDistance' | 'nodeScale' | 'physics'>;

/**
 * Применяет силы раскладки к инстансу force-graph (2D/3D).
 * Важно вызывать и после первого тика движка, и при смене настроек —
 * иначе слайдер показывает одно значение, а в симуляции остаётся дефолт библиотеки (−30/−60).
 */
export function applySimulationForces(
  fg: any,
  settings: LayoutSettings,
  dimensions: 2 | 3,
): void {
  if (!fg || typeof fg.d3Force !== 'function') return;

  // в 3D та же сила «размазывана» по осям — без буста слайдер почти не чувствуется
  const dimBoost = dimensions === 3 ? 2.2 : 1;
  const repulsion = -Math.max(1, settings.charge) * dimBoost;

  const charge = fg.d3Force('charge');
  if (charge && typeof charge.strength === 'function') {
    charge.strength(repulsion);
    // потолок дистанции: иначе при большом charge дальние узлы улетают хаотично
    if (typeof charge.distanceMax === 'function') {
      charge.distanceMax(Math.max(140, settings.linkDistance * 5 + settings.charge * 0.9));
    }
  }

  const link = fg.d3Force('link');
  if (link && typeof link.distance === 'function') {
    link.distance(settings.linkDistance);
  }

  // столкновения — иначе при слабом отталкивании узлы слипаются и кажется, что слайдер «мёртвый»
  const radiusOf = (node: { size?: number; isCluster?: boolean; clusterSize?: number }) => {
    const base = Math.max(3, (node.size ?? 6) * 0.9 * settings.nodeScale);
    return base + (node.isCluster ? 4 : 2);
  };
  const existing = fg.d3Force('collide');
  if (existing && typeof existing.radius === 'function') {
    existing.radius(radiusOf);
    if (typeof existing.strength === 'function') existing.strength(0.9);
  } else {
    fg.d3Force('collide', forceCollide(radiusOf).strength(0.9).iterations(2));
  }

  if (settings.physics) {
    fg.d3ReheatSimulation?.();
  }
}
