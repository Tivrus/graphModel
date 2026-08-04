/** API, которое preload отдаёт в renderer (Electron) */
export interface GraphModelDesktopApi {
  isElectron: true;
  platform: string;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
}

declare global {
  interface Window {
    graphModel?: GraphModelDesktopApi;
  }
}

export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && window.graphModel?.isElectron === true;
}
