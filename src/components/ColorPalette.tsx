const PALETTE = [
  '#38bdf8',
  '#818cf8',
  '#a78bfa',
  '#e879f9',
  '#fb7185',
  '#fb923c',
  '#fbbf24',
  '#a3e635',
  '#34d399',
  '#2dd4bf',
  '#67e8f9',
  '#94a3b8',
  '#f1f5f9',
  '#64748b',
  '#1e293b',
  '#0f172a',
];

interface Props {
  value: string;
  onChange: (hex: string) => void;
  onClear?: () => void;
}

/** сетка пресетов + свободный color picker */
export default function ColorPalette({ value, onChange, onClear }: Props) {
  const current = value.toLowerCase();

  return (
    <div className="color-palette">
      <div className="color-swatches" role="listbox" aria-label="Палитра">
        {PALETTE.map((hex) => (
          <button
            key={hex}
            type="button"
            role="option"
            aria-selected={current === hex}
            className={`color-swatch ${current === hex ? 'active' : ''}`}
            style={{ background: hex }}
            title={hex}
            onClick={() => onChange(hex)}
          />
        ))}
      </div>
      <div className="color-palette-row">
        <label className="color-custom" title="Свой цвет">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
          <span>{value}</span>
        </label>
        {onClear && (
          <button type="button" className="chip" onClick={onClear}>
            по группе
          </button>
        )}
      </div>
    </div>
  );
}
