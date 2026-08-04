const PLANETS = [
  'Меркурий', 'Венера', 'Земля', 'Марс',
  'Юпитер', 'Сатурн', 'Уран', 'Нептун'
];

export default function PlanetSelector({ selected, onSelect }) {
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Солнечная система</h2>
      <div style={styles.divider} />
      <div style={styles.list}>
        {PLANETS.map(name => (
          <button
            key={name}
            onClick={() => onSelect(name)}
            style={{
              ...styles.button,
              ...(selected === name ? styles.buttonActive : {}),
            }}
            onMouseEnter={(e) => {
              if (selected !== name) {
                e.currentTarget.style.background = 'rgba(0, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(0, 255, 255, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (selected !== name) {
                e.currentTarget.style.background = 'rgba(0, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = 'rgba(0, 255, 255, 0.08)';
              }
            }}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '280px',
    background: 'rgba(2, 4, 20, 0.88)',
    backdropFilter: 'blur(12px)',
    borderRight: '1px solid rgba(0, 255, 255, 0.15)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    zIndex: 10,
    overflowY: 'auto',
    height: '100%',
  },
  title: {
    color: '#00ffff',
    fontSize: '20px',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '3px',
    textShadow: '0 0 10px rgba(0, 255, 255, 0.5)',
  },
  divider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, #00ffff, transparent)',
    marginBottom: '8px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  button: {
    padding: '14px 18px',
    background: 'rgba(0, 255, 255, 0.03)',
    border: '1px solid rgba(0, 255, 255, 0.08)',
    borderRadius: '8px',
    color: '#88aacc',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 400,
    transition: 'all 0.3s ease',
    textAlign: 'left',
    letterSpacing: '1px',
    fontFamily: 'inherit',
  },
  buttonActive: {
    background: 'rgba(0, 255, 255, 0.12)',
    borderColor: 'rgba(0, 255, 255, 0.4)',
    color: '#00ffff',
    fontWeight: 600,
    textShadow: '0 0 8px rgba(0, 255, 255, 0.6)',
  },
};
