import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { useGraphStore } from './store/graphStore';
import { extractGraphSpec } from './utils/ai';
import './index.css';

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__graphStore = useGraphStore;
  (window as unknown as Record<string, unknown>).__extractGraphSpec = extractGraphSpec;
}

createRoot(document.getElementById('app')!).render(
  <HashRouter>
    <App />
  </HashRouter>,
);
