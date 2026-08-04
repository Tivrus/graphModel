export default function HologramOverlay({ planetName }) {
  return (
    <>
      {/* Scanlines */}
      <div style={styles.scanlines} />
      {/* Vignette */}
      <div style={styles.vignette} />
      {/* Glow corners */}
      <div style={styles.glowCorners} />
      {/* Planet info */}
      <div style={styles.info}>
        <h1 style={styles.planetName}>{planetName}</h1>
        <div style={styles.subtitle}>Голографическая проекция v1.0</div>
      </div>
      {/* Controls hint */}
      <div style={styles.hint}>
        ЛКМ — вращение  •  Колёсико — приближение
      </div>
      {/* Corner brackets */}
      <div style={{ ...styles.corner, ...styles.cornerTL }} />
      <div style={{ ...styles.corner, ...styles.cornerTR }} />
      <div style={{ ...styles.corner, ...styles.cornerBL }} />
      <div style={{ ...styles.corner, ...styles.cornerBR }} />
    </>
  );
}

const styles = {
  scanlines: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 255, 0.03) 2px, rgba(0, 255, 255, 0.03) 4px)',
    pointerEvents: 'none',
    zIndex: 5,
  },
  vignette: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.6) 100%)',
    pointerEvents: 'none',
    zIndex: 5,
  },
  glowCorners: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    boxShadow: 'inset 0 0 120px rgba(0, 100, 255, 0.12)',
    pointerEvents: 'none',
    zIndex: 5,
  },
  info: {
    position: 'absolute',
    top: '32px',
    right: '40px',
    zIndex: 10,
    textAlign: 'right',
  },
  planetName: {
    color: '#00ffff',
    fontSize: '48px',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '6px',
    textShadow: '0 0 20px rgba(0, 255, 255, 0.6), 0 0 40px rgba(0, 100, 255, 0.3)',
    fontWeight: 300,
  },
  subtitle: {
    color: '#4488aa',
    fontSize: '12px',
    letterSpacing: '4px',
    marginTop: '8px',
    textTransform: 'uppercase',
  },
  hint: {
    position: 'absolute',
    bottom: '28px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    color: 'rgba(0, 200, 255, 0.5)',
    fontSize: '12px',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    pointerEvents: 'none',
  },
  corner: {
    position: 'absolute',
    width: '40px',
    height: '40px',
    borderColor: 'rgba(0, 255, 255, 0.3)',
    borderStyle: 'solid',
    pointerEvents: 'none',
    zIndex: 10,
  },
  cornerTL: {
    top: '20px',
    left: '20px',
    borderWidth: '2px 0 0 2px',
  },
  cornerTR: {
    top: '20px',
    right: '20px',
    borderWidth: '2px 2px 0 0',
  },
  cornerBL: {
    bottom: '20px',
    left: '20px',
    borderWidth: '0 0 2px 2px',
  },
  cornerBR: {
    bottom: '20px',
    right: '20px',
    borderWidth: '0 2px 2px 0',
  },
};
