/// <reference types="vite/client" />

declare module 'd3-force-3d' {
  export function forceCollide(radius?: number | ((node: any) => number)): {
    radius(r: number | ((node: any) => number)): any;
    strength(s: number): any;
    iterations(n: number): any;
  };
  export function forceManyBody(): any;
  export function forceLink(links?: any[]): any;
  export function forceCenter(x?: number, y?: number, z?: number): any;
  export function forceSimulation(nodes?: any[]): any;
  export function forceRadial(radius: any, x?: number, y?: number, z?: number): any;
}
