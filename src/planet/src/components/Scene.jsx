import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createEarthTexture, createEarthBumpMap, createJupiterTexture, createMarsTexture } from '../utils/textures';

const PLANETS = [
  { name: 'Меркурий', color: '#8c8c8c', size: 0.6, emissive: 0.1 },
  { name: 'Венера',   color: '#e6b85c', size: 0.9, emissive: 0.15 },
  { name: 'Земля',    color: '#4a90d9', size: 1.0, emissive: 0.2, type: 'earth' },
  { name: 'Марс',     color: '#c1440e', size: 0.8, emissive: 0.15, type: 'mars' },
  { name: 'Юпитер',   color: '#d4a574', size: 1.8, emissive: 0.1, type: 'jupiter' },
  { name: 'Сатурн',   color: '#e8d5a3', size: 1.5, emissive: 0.1, hasRings: true },
  { name: 'Уран',     color: '#7de3f4', size: 1.2, emissive: 0.25 },
  { name: 'Нептун',   color: '#3b5cc9', size: 1.15, emissive: 0.2 },
];

export default function Scene({ planetName, onLoaded = undefined }) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const planetGroupRef = useRef(null);
  const frameIdRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const w = mount.clientWidth;
    const h = mount.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02020a, 0.02);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0.5, 4);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 8;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404080, 2);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x4488ff, 3, 20);
    pointLight.position.set(3, 2, 4);
    scene.add(pointLight);

    const backLight = new THREE.PointLight(0xff4488, 1, 20);
    backLight.position.set(-3, -1, -4);
    scene.add(backLight);

    const topLight = new THREE.PointLight(0x00ffff, 0.5, 20);
    topLight.position.set(0, 5, 0);
    scene.add(topLight);

    // Particles
    const particlesGeo = new THREE.BufferGeometry();
    const particlesCount = 600;
    const posArray = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 10;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMat = new THREE.PointsMaterial({
      size: 0.015,
      color: 0x44aaff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particles);

    // Animation
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      particles.rotation.y -= 0.0003;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const handleResize = () => {
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    onLoaded?.();

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Обновление планеты
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Удаляем старую планету
    const oldGroup = planetGroupRef.current;
    if (oldGroup) {
      scene.remove(oldGroup);
      oldGroup.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    const planet = PLANETS.find(p => p.name === planetName);
    if (!planet) return;

    const planetGroup = new THREE.Group();
    planetGroupRef.current = planetGroup;

    // Geometry
    const geometry = new THREE.SphereGeometry(planet.size, 64, 64);

    // Material
    let material;
    if (planet.type === 'earth') {
      material = new THREE.MeshStandardMaterial({
        map: createEarthTexture(),
        bumpMap: createEarthBumpMap(),
        bumpScale: 0.06,
        color: 0xffffff,
        emissive: 0x113355,
        emissiveIntensity: 0.3,
        metalness: 0.1,
        roughness: 0.8,
        transparent: true,
        opacity: 0.95,
      });
    } else if (planet.type === 'mars') {
      material = new THREE.MeshStandardMaterial({
        map: createMarsTexture(),
        color: 0xffffff,
        emissive: new THREE.Color(planet.color),
        emissiveIntensity: planet.emissive * 0.4,
        metalness: 0.1,
        roughness: 0.85,
        transparent: true,
        opacity: 0.92,
      });
    } else if (planet.type === 'jupiter') {
      material = new THREE.MeshStandardMaterial({
        map: createJupiterTexture(),
        color: 0xffffff,
        emissive: new THREE.Color(planet.color),
        emissiveIntensity: planet.emissive * 0.4,
        metalness: 0.05,
        roughness: 0.7,
        transparent: true,
        opacity: 0.9,
      });
    } else {
      material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(planet.color),
        emissive: new THREE.Color(planet.color),
        emissiveIntensity: planet.emissive,
        metalness: 0.3,
        roughness: 0.4,
        transparent: true,
        opacity: 0.85,
      });
    }

    const mesh = new THREE.Mesh(geometry, material);
    planetGroup.add(mesh);

    // Wireframe overlay
    const wireGeo = new THREE.WireframeGeometry(geometry);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.12,
    });
    const wireframe = new THREE.LineSegments(wireGeo, wireMat);
    wireframe.scale.set(1.02, 1.02, 1.02);
    planetGroup.add(wireframe);

    // Inner glow
    const glowGeo = new THREE.SphereGeometry(planet.size * 1.12, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(planet.color),
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    planetGroup.add(glow);

    // Outer glow halo
    const haloGeo = new THREE.SphereGeometry(planet.size * 1.3, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(planet.color),
      transparent: true,
      opacity: 0.02,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    planetGroup.add(halo);

    // Rings for Saturn
    if (planet.hasRings) {
      const ringGeo = new THREE.RingGeometry(planet.size * 1.3, planet.size * 2.0, 128);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xc4a882,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2.2;
      planetGroup.add(ring);

      // Second ring
      const ring2Geo = new THREE.RingGeometry(planet.size * 2.1, planet.size * 2.4, 128);
      const ring2Mat = new THREE.MeshBasicMaterial({
        color: 0xa09070,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
      ring2.rotation.x = Math.PI / 2.2;
      planetGroup.add(ring2);
    }

    scene.add(planetGroup);

    // Entrance animation
    planetGroup.scale.set(0, 0, 0);
    let scale = 0;
    const entranceInterval = setInterval(() => {
      scale += 0.05;
      if (scale >= 1) {
        scale = 1;
        clearInterval(entranceInterval);
      }
      planetGroup.scale.set(scale, scale, scale);
    }, 16);

    return () => {
      clearInterval(entranceInterval);
    };
  }, [planetName]);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    />
  );
}
