'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BoardMatrix, PlacedTile } from '@/engine/types';

interface Board3DProps {
  board: BoardMatrix;
  draftTiles: (PlacedTile & { rackId: string })[];
  onCellClick: (row: number, col: number) => void;
}

function makeTileTexture(letter: string, points: number, isDraft: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  if (isDraft) {
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(1, '#facc15');
  } else {
    grad.addColorStop(0, '#fef3c7');
    grad.addColorStop(1, '#fde68a');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = isDraft ? '#ca8a04' : '#d97706';
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, 236, 236);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 148px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter.toUpperCase(), 124, 132);

  ctx.font = '800 44px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#92400e';
  ctx.fillText(String(points), 206, 208);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCellTexture(bonus: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const palette: Record<string, { bg: string; fg: string; label: string }> = {
    STAR: { bg: '#f59e0b', fg: '#0f172a', label: '★' },
    TW: { bg: '#e11d48', fg: '#ffffff', label: 'TW' },
    DW: { bg: '#f472b6', fg: '#0f172a', label: 'DW' },
    TL: { bg: '#0284c7', fg: '#ffffff', label: 'TL' },
    DL: { bg: '#2dd4bf', fg: '#0f172a', label: 'DL' },
    TRAP: { bg: '#7e22ce', fg: '#fde047', label: '🦊' },
    NONE: { bg: '#1e293b', fg: '#475569', label: '' },
  };

  const style = palette[bonus] || palette.NONE;
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 122, 122);

  if (style.label) {
    ctx.fillStyle = style.fg;
    ctx.font = '900 54px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.label, 64, 68);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function Board3D({ board, draftTiles, onCellClick }: Board3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const tilesGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const onCellClickRef = useRef(onCellClick);
  onCellClickRef.current = onCellClick;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 680;
    const height = container.clientHeight || 460;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0c192c, 0.018);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);
    camera.position.set(0, 16.5, 13.5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minDistance = 9;
    controls.maxDistance = 28;
    controlsRef.current = controls;

    const ambient = new THREE.AmbientLight(0xdbeafe, 0.85);
    scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
    sunLight.position.set(10, 22, 12);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    const rimLight = new THREE.PointLight(0x38bdf8, 1.1, 45);
    rimLight.position.set(-12, 8, -12);
    scene.add(rimLight);

    const waterGeo = new THREE.CircleGeometry(45, 48);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.25,
      metalness: 0.35,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.85;
    scene.add(water);

    const islandGeo = new THREE.CylinderGeometry(11.6, 12.6, 0.9, 32);
    const islandMat = new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.85 });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.y = -0.55;
    island.receiveShadow = true;
    scene.add(island);

    const frameGeo = new THREE.BoxGeometry(15.8, 0.45, 15.8);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.4 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = -0.15;
    frame.receiveShadow = true;
    scene.add(frame);

    const cellMeshes: THREE.Mesh[] = [];
    const cellGeo = new THREE.BoxGeometry(0.94, 0.14, 0.94);

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const bonus = board[r][c].bonus;
        const mat = new THREE.MeshStandardMaterial({
          map: makeCellTexture(bonus),
          roughness: 0.45,
        });
        const cellMesh = new THREE.Mesh(cellGeo, mat);
        cellMesh.position.set(c - 7, 0.12, r - 7);
        cellMesh.receiveShadow = true;
        cellMesh.userData = { row: r, col: c };
        scene.add(cellMesh);
        cellMeshes.push(cellMesh);
      }
    }

    const tilesGroup = new THREE.Group();
    scene.add(tilesGroup);
    tilesGroupRef.current = tilesGroup;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (dist > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...cellMeshes, ...tilesGroup.children], false);
      if (hits.length > 0) {
        const { row, col } = hits[0].object.userData;
        if (typeof row === 'number' && typeof col === 'number') {
          onCellClickRef.current(row, col);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 680;
      const h = container.clientHeight || 460;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let animId = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      water.position.y = -0.88 + Math.sin(elapsed * 1.6) * 0.05;

      tilesGroup.children.forEach((child, idx) => {
        if (child.userData.isDraft) {
          child.position.y = 0.56 + Math.sin(elapsed * 5 + idx) * 0.06;
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [board]);

  useEffect(() => {
    const group = tilesGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const tileGeo = new THREE.BoxGeometry(0.88, 0.34, 0.88);
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 });

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const draft = draftTiles.find((d) => d.row === r && d.col === c);
        const committed = board[r][c].tile;
        const active = draft || committed;
        if (!active) continue;

        const isDraft = Boolean(draft);
        const topMat = new THREE.MeshStandardMaterial({
          map: makeTileTexture(active.letter, active.points, isDraft),
          roughness: 0.3,
        });

        const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
        const mesh = new THREE.Mesh(tileGeo, materials);
        mesh.position.set(c - 7, isDraft ? 0.56 : 0.36, r - 7);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { row: r, col: c, isDraft };
        group.add(mesh);
      }
    }
  }, [board, draftTiles]);

  function resetCamera() {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 16.5, 13.5);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  }

  return (
    <div className="relative w-full h-[380px] sm:h-[470px] rounded-3xl overflow-hidden border-2 border-sky-400/40 shadow-2xl bg-sky-950">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      <div className="absolute top-3 left-3 bg-slate-950/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 text-[11px] font-bold text-sky-200 pointer-events-none">
        🖱️ Drag to Rotate • Scroll to Zoom • Tap Square to Place
      </div>

      <button
        type="button"
        onClick={resetCamera}
        className="absolute top-3 right-3 bg-amber-400 hover:bg-amber-300 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-black shadow-md transition active:scale-95"
      >
        🎥 Reset 3D View
      </button>
    </div>
  );
}
