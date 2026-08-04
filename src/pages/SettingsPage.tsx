import { useRef } from 'react';
import { Download, FileJson, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useGraphStore } from '../store/graphStore';
import { downloadText, parseGraphFile, readFileAsText, serializeGraph } from '../utils/transfer';

export default function SettingsPage() {
  const settings = useGraphStore((s) => s.settings);
  const updateSettings = useGraphStore((s) => s.updateSettings);
  const nodes = useGraphStore((s) => s.nodes);
  const links = useGraphStore((s) => s.links);
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = () => {
    const s = useGraphStore.getState();
    const date = new Date().toISOString().slice(0, 10);
    downloadText(
      `graph-model-${date}.json`,
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
    } catch (err) {
      alert(`Не удалось импортировать: ${(err as Error).message}`);
    }
  };

  return (
    <div className="page settings-page">
      <div className="settings-grid">
        <section className="card panel">
          <h3>Физика раскладки</h3>
          <label className="field">
            <span>Отталкивание узлов · {settings.charge}</span>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={settings.charge}
              onChange={(e) => updateSettings({ charge: Number(e.target.value) })}
            />
            <p className="hint">
              Чем выше — тем сильнее узлы разъезжаются. Закреплённые узлы не двигаются — снимите
              закрепление в статусбаре («открепить все»), если слайдер почти не влияет.
            </p>
          </label>
          <label className="field">
            <span>Длина связей · {settings.linkDistance}</span>
            <input
              type="range"
              min={15}
              max={200}
              step={5}
              value={settings.linkDistance}
              onChange={(e) => updateSettings({ linkDistance: Number(e.target.value) })}
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.physics}
              onChange={(e) => updateSettings({ physics: e.target.checked })}
            />
            <span>Симуляция включена (выкл — заморозить раскладку)</span>
          </label>
        </section>

        <section className="card panel">
          <h3>Внешний вид</h3>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.showLabels}
              onChange={(e) => updateSettings({ showLabels: e.target.checked })}
            />
            <span>Подписи узлов</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.particles}
              onChange={(e) => updateSettings({ particles: e.target.checked })}
            />
            <span>Частицы на связях</span>
          </label>
          <label className="field">
            <span>Масштаб узлов · {settings.nodeScale.toFixed(2)}</span>
            <input
              type="range"
              min={0.4}
              max={2.2}
              step={0.05}
              value={settings.nodeScale}
              onChange={(e) => updateSettings({ nodeScale: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Прозрачность связей · {settings.linkOpacity.toFixed(2)}</span>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={settings.linkOpacity}
              onChange={(e) => updateSettings({ linkOpacity: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Фон сцены</span>
            <input
              type="color"
              value={settings.background}
              onChange={(e) => updateSettings({ background: e.target.value })}
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.stars}
              onChange={(e) => updateSettings({ stars: e.target.checked })}
            />
            <span>Звёзды в 3D</span>
          </label>
          <label className="field">
            <span>Плотность звёзд · ×{settings.starsDensity.toFixed(2)}</span>
            <input
              type="range"
              min={0.15}
              max={3}
              step={0.05}
              value={settings.starsDensity}
              onChange={(e) => updateSettings({ starsDensity: Number(e.target.value) })}
              disabled={!settings.stars}
            />
          </label>
          <label className="field">
            <span>Отдалённость тумана · ×{settings.starsDistance.toFixed(2)}</span>
            <input
              type="range"
              min={0.4}
              max={2.4}
              step={0.05}
              value={settings.starsDistance}
              onChange={(e) => updateSettings({ starsDistance: Number(e.target.value) })}
            />
          </label>
        </section>

        <section className="card panel">
          <h3>Взаимодействие</h3>
          <label className="field">
            <span>Сенса камеры (вращение/панорама) · ×{settings.sensitivity.toFixed(2)}</span>
            <input
              type="range"
              min={0.2}
              max={2.5}
              step={0.05}
              value={settings.sensitivity}
              onChange={(e) => updateSettings({ sensitivity: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Сенса зума · ×{settings.zoomSensitivity.toFixed(2)}</span>
            <input
              type="range"
              min={0.2}
              max={2.5}
              step={0.05}
              value={settings.zoomSensitivity}
              onChange={(e) => updateSettings({ zoomSensitivity: Number(e.target.value) })}
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.pinOnDrag}
              onChange={(e) => updateSettings({ pinOnDrag: e.target.checked })}
            />
            <span>Закреплять узел после перетаскивания</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.tolerantSelect}
              onChange={(e) => updateSettings({ tolerantSelect: e.target.checked })}
            />
            <span>Толерантное выделение — рамка захватывает узлы, задетые краем</span>
          </label>
          <p className="hint">
            Закреплённые узлы не участвуют в физике и сохраняют позицию. Открепить можно в инспекторе
            узла или кнопкой «открепить все» в статус-баре.
          </p>
        </section>

        <section className="card panel">
          <h3>
            <FileJson size={16} /> Данные
          </h3>
          <p className="hint">
            Узлов: {nodes.length} · связей: {links.length}. Модель автосохраняется в браузере.
          </p>
          <div className="btn-row">
            <button className="btn" onClick={onExport}>
              <Download size={14} /> Экспорт JSON
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Импорт JSON
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImportFile} />
          </div>
          <div className="btn-row">
            <button
              className="btn ghost"
              onClick={() => {
                if (confirm('Заменить текущий граф демонстрационным примером?'))
                  useGraphStore.getState().resetToSample();
              }}
            >
              <RotateCcw size={14} /> Сбросить к примеру
            </button>
            <button
              className="btn danger"
              onClick={() => {
                if (confirm('Удалить все узлы и связи? Действие необратимо.'))
                  useGraphStore.getState().clearGraph();
              }}
            >
              <Trash2 size={14} /> Очистить граф
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
