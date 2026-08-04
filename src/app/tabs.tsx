import type { ComponentType } from 'react';
import WorkspacePage from '../pages/WorkspacePage';
import FlatViewPage from '../pages/FlatViewPage';
import DocsPage from '../pages/DocsPage';
import SettingsPage from '../pages/SettingsPage';

export interface AppRoute {
  id: string;
  path: string;
  element: ComponentType;
  /** 3D остаётся смонтированным */
  keepAlive?: boolean;
}

/** служебные маршруты (не «вкладки проектов») */
export const APP_ROUTES: AppRoute[] = [
  { id: 'canvas3d', path: '/', element: WorkspacePage, keepAlive: true },
  { id: 'canvas2d', path: '/flat', element: FlatViewPage },
  { id: 'docs', path: '/docs', element: DocsPage },
  { id: 'settings', path: '/settings', element: SettingsPage },
];

export const UTILITY_PATHS = new Set(['/docs', '/settings']);
