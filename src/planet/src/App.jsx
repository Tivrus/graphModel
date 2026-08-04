import { useState } from 'react';
import PlanetSelector from './components/PlanetSelector';
import Scene from './components/Scene';
import HologramOverlay from './components/HologramOverlay';

export default function App() {
  const [selectedPlanet, setSelectedPlanet] = useState('Земля');

  return (
    <div style={styles.app}>
      <PlanetSelector
        selected={selectedPlanet}
        onSelect={setSelectedPlanet}
      />
      <div style={styles.sceneContainer}>
        <Scene planetName={selectedPlanet} />
        <HologramOverlay planetName={selectedPlanet} />
      </div>
    </div>
  );
}

const styles = {
  app: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    background: '#02020a',
    overflow: 'hidden',
  },
  sceneContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
};
