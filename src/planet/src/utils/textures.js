import * as THREE from 'three';

export function createEarthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Океан
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
  oceanGrad.addColorStop(0, '#0a1a3a');
  oceanGrad.addColorStop(0.5, '#0d2247');
  oceanGrad.addColorStop(1, '#0a1a3a');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, 2048, 1024);

  // Континенты
  ctx.fillStyle = '#1a4a1a';
  const continents = [
    { x: 300, y: 360, w: 400, h: 240 },   // Северная Америка
    { x: 560, y: 600, w: 240, h: 280 },   // Южная Америка
    { x: 900, y: 320, w: 360, h: 200 },   // Европа
    { x: 960, y: 560, w: 320, h: 280 },   // Африка
    { x: 1400, y: 340, w: 440, h: 240 },  // Азия
    { x: 1500, y: 640, w: 200, h: 160 },  // Австралия
    { x: 1800, y: 200, w: 200, h: 120 },  // Гренландия
  ];

  continents.forEach(c => {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Неровности береговой линии
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      const ox = c.x + (Math.random() - 0.5) * c.w * 0.7;
      const oy = c.y + (Math.random() - 0.5) * c.h * 0.7;
      ctx.ellipse(ox, oy, c.w * 0.12, c.h * 0.12, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Горы (коричневые пятна)
  ctx.fillStyle = '#2a3a1a';
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 2048;
    const y = Math.random() * 1024;
    ctx.beginPath();
    ctx.ellipse(x, y, 15 + Math.random() * 30, 10 + Math.random() * 20, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }

  // Лёд
  ctx.fillStyle = '#e0f0ff';
  ctx.fillRect(0, 0, 2048, 60);
  ctx.fillRect(0, 964, 2048, 60);

  // Полярные шапки
  ctx.beginPath();
  ctx.ellipse(1024, 30, 400, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(1024, 994, 450, 45, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createEarthBumpMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 1024, 512);

  // Шум для рельефа
  for (let i = 0; i < 15000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const g = Math.floor(Math.random() * 120 + 40);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Горы — более светлые
  ctx.fillStyle = '#aaaaaa';
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    ctx.beginPath();
    ctx.ellipse(x, y, 20 + Math.random() * 40, 15 + Math.random() * 30, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createJupiterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const colors = ['#d4a574', '#c4956a', '#e8c9a0', '#a67c52', '#f4e4bc', '#8b6914', '#b8956a', '#d4b896'];
  const bandHeight = 16;

  for (let y = 0; y < 512; y += bandHeight) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    ctx.fillStyle = color;
    ctx.fillRect(0, y, 1024, bandHeight);

    // Неровности полос
    for (let x = 0; x < 1024; x += 40) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.fillRect(x + (Math.random() - 0.5) * 20, y, 20 + Math.random() * 30, bandHeight);
    }
  }

  // Большое красное пятно
  ctx.fillStyle = '#a05030';
  ctx.beginPath();
  ctx.ellipse(700, 300, 60, 40, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createMarsTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Базовый красный
  ctx.fillStyle = '#c1440e';
  ctx.fillRect(0, 0, 1024, 512);

  // Тёмные участки
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    ctx.fillStyle = `rgba(${80 + Math.random() * 40}, ${40 + Math.random() * 30}, ${20 + Math.random() * 20}, 0.6)`;
    ctx.beginPath();
    ctx.ellipse(x, y, 30 + Math.random() * 60, 20 + Math.random() * 40, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }

  // Полярные шапки
  ctx.fillStyle = '#e8e0d0';
  ctx.fillRect(0, 0, 1024, 40);
  ctx.fillRect(0, 472, 1024, 40);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
