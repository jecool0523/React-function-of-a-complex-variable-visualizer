import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';

// -----------------------------------------------------------------------------
// 수식 파서 유틸리티
// -----------------------------------------------------------------------------
const evaluateFunction = (expression, x) => {
  try {
    if (!expression || !expression.trim()) return NaN;
    if (/[^x0-9+\-*/().^ \t\r\nsincostanlogexpsqrtPIe]/.test(expression)) return NaN;

    let jsExp = expression.toLowerCase();
    jsExp = jsExp.replace(/(\d)\s*([a-z(])/g, '$1*$2');
    jsExp = jsExp.replace(/([x])\s*([0-9(])/g, '$1*$2');
    jsExp = jsExp.replace(/(\))\s*([0-9a-z(])/g, '$1*$2');

    jsExp = jsExp
      .replace(/\^/g, '**')
      .replace(/sin/g, 'Math.sin')
      .replace(/cos/g, 'Math.cos')
      .replace(/tan/g, 'Math.tan')
      .replace(/log/g, 'Math.log')
      .replace(/exp/g, 'Math.exp')
      .replace(/sqrt/g, 'Math.sqrt')
      .replace(/pi/g, 'Math.PI')
      .replace(/\be\b/g, 'Math.E');

    const func = new Function('x', `return ${jsExp};`);
    return func(x);
  } catch (e) {
    return NaN;
  }
};

// -----------------------------------------------------------------------------
// Pure Three.js Canvas Component
// -----------------------------------------------------------------------------
const ThreeCanvas = ({ gExp, qExp, is3DMode }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  
  // 애니메이션 상태 관리
  const animState = useRef({
    currentT: 0, // 0(2D) ~ 1(3D) 현재 진행도
    targetT: 0,  // 목표 진행도
  });

  // 데이터 캐싱 (매 프레임 계산 방지)
  const dataCache = useRef({
    points: [], // {x, real, imag}
    valid: false
  });

  // 객체 참조 (업데이트용)
  const objectsRef = useRef({
    mainLine: null,
    spheres: [],
    gridHelper: null,
    xAxis: null,
    realAxis: null,
    imagAxis: null,
  });

  // 1. 데이터 계산 (입력이 바뀔 때만 수행)
  useEffect(() => {
    const points = [];
    const range = 10;
    const step = 0.1;

    for (let x = -range; x <= range; x += step) {
      let real = 0;
      let imag = 0;

      if (gExp) {
        const val = evaluateFunction(gExp, x);
        if (!isNaN(val)) real = val;
      }
      if (qExp) {
        const val = evaluateFunction(qExp, x);
        if (!isNaN(val)) imag = val;
      }
      points.push({ x, real, imag });
    }
    
    dataCache.current = { points, valid: true };
  }, [gExp, qExp]);

  // 2. 목표 상태 설정 (2D <-> 3D 전환 시)
  useEffect(() => {
    animState.current.targetT = is3DMode ? 1 : 0;
  }, [is3DMode]);

  // 3. Three.js 초기화 및 렌더 루프
  useEffect(() => {
    if (!mountRef.current) return;

    // -- Init Scene --
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f9fafb');
    sceneRef.current = scene;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 25);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // -- Create Objects (초기 생성 후 위치만 업데이트) --
    
    // Grid
    const gridHelper = new THREE.GridHelper(30, 30, 0xdddddd, 0xeeeeee);
    gridHelper.rotation.x = Math.PI / 2; // 초기 2D 상태 (벽면)
    scene.add(gridHelper);
    objectsRef.current.gridHelper = gridHelper;

    // Function Line (BufferGeometry)
    // 최대 점 개수를 예상하여 미리 버퍼 생성
    const maxPoints = 1000; 
    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 });
    const mainLine = new THREE.Line(lineGeo, lineMat);
    lineGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
    scene.add(mainLine);
    objectsRef.current.mainLine = mainLine;

    // Spheres (Pool)
    const sphereGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0x10b981 });
    const spheres = [];
    for(let i=0; i<50; i++) { // 충분한 개수 생성
      const mesh = new THREE.Mesh(sphereGeo, sphereMat);
      mesh.visible = false;
      scene.add(mesh);
      spheres.push(mesh);
    }
    objectsRef.current.spheres = spheres;

    // Axes Lines
    const createAxis = (color) => {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0)]);
      const mat = new THREE.LineBasicMaterial({ color });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      return line;
    };
    objectsRef.current.xAxis = createAxis(0x000000);
    objectsRef.current.realAxis = createAxis(0x3b82f6); // Blue
    objectsRef.current.imagAxis = createAxis(0xef4444); // Red

    // -- Animation Loop --
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // 1. Lerp 't' value for smooth transition
      const state = animState.current;
      state.currentT += (state.targetT - state.currentT) * 0.1;

      if (Math.abs(state.targetT - state.currentT) < 0.001) {
        state.currentT = state.targetT;
      }
      
      const t = state.currentT; // 0.0 (2D) -> 1.0 (3D)

      // 2. Camera Update
      // 2D Pos: (0, 0, 25)
      // 3D Pos: (10, 20, 10) -> 약 55도 이상의 각도로 내려다보는 시점 (그래프 겹침 방지)
      const startPos = new THREE.Vector3(0, 0, 25);
      const endPos = new THREE.Vector3(10, 20, 10);
      const camPos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      
      // 사용자가 드래그 중이 아닐 때만 카메라 자동 이동
      if (Math.abs(state.targetT - state.currentT) > 0.01) {
        camera.position.copy(camPos);
        camera.lookAt(0, 0, 0);
      }

      // 3. Grid Rotation
      // 2D: Math.PI/2 (90도, 벽), 3D: 0 (0도, 바닥)
      if (objectsRef.current.gridHelper) {
        objectsRef.current.gridHelper.rotation.x = THREE.MathUtils.lerp(Math.PI / 2, 0, t);
      }

      // 4. Update Axes
      const range = 15;
      
      // X Axis
      const xGeo = objectsRef.current.xAxis.geometry;
      xGeo.setFromPoints([new THREE.Vector3(-range, 0, 0), new THREE.Vector3(range, 0, 0)]);

      // Real Axis (Blue): Y축(2D) -> Z축(3D, 바닥 깊이)
      const realGeo = objectsRef.current.realAxis.geometry;
      const realEnd = new THREE.Vector3(0, range * (1-t), range * t); // Y에서 Z로 이동
      const realStart = new THREE.Vector3(0, -range * (1-t), -range * t);
      realGeo.setFromPoints([realStart, realEnd]);

      // Imag Axis (Red): 0(2D) -> Y축(3D, 높이)
      const imagGeo = objectsRef.current.imagAxis.geometry;
      const imagEnd = new THREE.Vector3(0, range * t, 0); 
      const imagStart = new THREE.Vector3(0, -range * t, 0);
      imagGeo.setFromPoints([imagStart, imagEnd]);

      // 5. Update Graph Points
      if (dataCache.current.valid && objectsRef.current.mainLine) {
        const pointsData = dataCache.current.points;
        const positions = objectsRef.current.mainLine.geometry.attributes.position.array;
        
        // Color Interpolation (Green -> Purple)
        const color2D = new THREE.Color(0x10b981);
        const color3D = new THREE.Color(0x8b5cf6);
        const curColor = color2D.lerp(color3D, t);
        objectsRef.current.mainLine.material.color.set(curColor);
        objectsRef.current.spheres.forEach(s => s.material.color.set(curColor));

        let ptIndex = 0;
        pointsData.forEach((pt, i) => {
          // 좌표 변환 로직
          const x = pt.x;
          const y = (1 - t) * pt.real + t * pt.imag;
          const z = (1 - t) * 0 + t * pt.real;

          positions[ptIndex++] = x;
          positions[ptIndex++] = y;
          positions[ptIndex++] = z;

          // Sphere update
          if (i % 5 === 0) { 
            const sphereIdx = Math.floor(i / 5);
            if (sphereIdx < objectsRef.current.spheres.length) {
              const sphere = objectsRef.current.spheres[sphereIdx];
              sphere.visible = true;
              sphere.position.set(x, y, z);
            }
          }
        });
        
        objectsRef.current.mainLine.geometry.attributes.position.needsUpdate = true;
        objectsRef.current.mainLine.geometry.setDrawRange(0, pointsData.length);

        // 남은 구체 숨기기
        const usedSpheres = Math.floor(pointsData.length / 5);
        for(let k = usedSpheres; k < objectsRef.current.spheres.length; k++) {
          objectsRef.current.spheres[k].visible = false;
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // -- Custom Controls --
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    const canvas = renderer.domElement;

    const onPointerDown = (e) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => { isDragging = false; };
    const onPointerMove = (e) => {
      if (!isDragging) return;
      if (Math.abs(animState.current.targetT - animState.current.currentT) > 0.1) return;

      const deltaX = e.clientX - prevMouse.x;
      const deltaY = e.clientY - prevMouse.y;
      prevMouse = { x: e.clientX, y: e.clientY };

      const offset = new THREE.Vector3().copy(camera.position);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta -= deltaX * 0.005;
      spherical.phi -= deltaY * 0.005;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
      offset.setFromSpherical(spherical);
      camera.position.copy(offset);
      camera.lookAt(0, 0, 0);
    };
    const onWheel = (e) => {
      e.preventDefault();
      const offset = new THREE.Vector3().copy(camera.position);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.radius += e.deltaY * 0.02;
      spherical.radius = Math.max(5, Math.min(100, spherical.radius));
      offset.setFromSpherical(spherical);
      camera.position.copy(offset);
      camera.lookAt(0, 0, 0);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('wheel', onWheel);
      renderer.dispose();
    };
  }, []);

  // 2. 그래프 및 모드 업데이트 (Update) - 애니메이션과는 별도로 상태 동기화용
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const camera = cameraRef.current;
    
    if (camera) {
      if (is3DMode) {
        // 애니메이션이 이미 완료된 상태라면 강제 위치 조정
        if (Math.abs(camera.position.z - 25) < 1 && camera.position.x === 0 && camera.position.y === 0) {
           camera.position.set(10, 20, 10);
           camera.lookAt(0, 0, 0);
        }
      } else {
        camera.position.set(0, 0, 25);
        camera.lookAt(0, 0, 0);
      }
    }
  }, [is3DMode]);

  return <div ref={mountRef} className="w-full h-full" />;
};

// -----------------------------------------------------------------------------
// 메인 앱
// -----------------------------------------------------------------------------
export default function App() {
  const [gInput, setGInput] = useState('x^2 - 2x + 1'); 
  const [qInput, setQInput] = useState('');
  const [is3D, setIs3D] = useState(false);

  useEffect(() => {
    if (qInput.trim() !== '' && !is3D) {
      setIs3D(true);
    } else if (qInput.trim() === '' && is3D) {
      setIs3D(false);
    }
  }, [qInput]);

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 font-sans">
      <div className="bg-white p-6 shadow-md z-10 relative">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          복소수 함수 시각화: <span className="font-mono text-purple-600">f(x) = g(x) + q(x)i</span>
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          실수 함수 g(x)에 허수 성분 q(x)가 추가되어 차원이 확장되는 과정을 시각적으로 확인하세요.
          <br/>
          <span className="text-xs text-gray-400">
            * '2x', '3x^2' 처럼 곱셈 기호 없이 입력해도 됩니다. (다항함수 지원)
          </span>
        </p>

        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-blue-600 mb-1">
              Step 1: 실수부 g(x) (2D Y축 / 3D 바닥)
            </label>
            <div className="flex items-center">
              <span className="bg-blue-100 text-blue-800 px-3 py-2 rounded-l-md font-mono">y =</span>
              <input
                type="text"
                value={gInput}
                onChange={(e) => setGInput(e.target.value)}
                placeholder="예: 2x^2 + 3x - 1"
                className="border border-blue-300 p-2 w-48 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-semibold text-red-600 mb-1">
              Step 2: 허수부 q(x) (3D 높이)
            </label>
            <div className="flex items-center">
              <span className="bg-red-100 text-red-800 px-3 py-2 rounded-l-md font-mono">z =</span>
              <input
                type="text"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="예: 2x, 5"
                className="border border-red-300 p-2 w-48 rounded-r-md focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
              />
              <span className="ml-2 font-mono text-lg text-gray-400">× i</span>
            </div>
          </div>

          <div className="flex items-center pb-2">
             <button
               onClick={() => setIs3D(!is3D)}
               className={`px-4 py-2 rounded-md font-bold transition-colors shadow-sm ${
                 is3D 
                 ? 'bg-purple-600 text-white hover:bg-purple-700' 
                 : 'bg-green-500 text-white hover:bg-green-600'
               }`}
             >
               {is3D ? '3D 뷰 (회전 가능)' : '2D 뷰 (평면)'}
             </button>
          </div>
        </div>
        
        <div className="mt-4 flex gap-2 text-xs text-gray-500">
           <span>사용 가능: 다항식(2x+1), 삼각함수(sin, cos), 지수/로그(exp, log) 등</span>
           <span className="text-gray-300">|</span>
           <span>마우스: 좌클릭 드래그(회전), 우클릭 드래그(이동), 휠(줌)</span>
        </div>
      </div>

      <div className="flex-1 relative bg-gradient-to-b from-gray-100 to-gray-200 overflow-hidden">
        {/* Pure Three.js Canvas */}
        <ThreeCanvas gExp={gInput} qExp={qInput} is3DMode={is3D} />
        
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur p-4 rounded-lg shadow-lg pointer-events-none select-none">
          <h3 className="font-bold text-gray-700 mb-2 border-b pb-1">축 설명 (Axis Legend)</h3>
          <ul className="text-sm space-y-2">
            <li className="flex items-center gap-2">
              <div className="w-8 h-1 bg-black"></div> 
              <span className="font-semibold text-gray-800">X축: 입력값</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-8 h-1 bg-blue-500"></div> 
              <span className="font-semibold text-blue-600">
                {is3D ? 'Z축(바닥): 실수 g(x)' : 'Y축(세로): 실수 g(x)'}
              </span>
            </li>
            <li className={`flex items-center gap-2 transition-opacity ${is3D ? 'opacity-100' : 'opacity-40'}`}>
              <div className="w-8 h-1 bg-red-500"></div> 
              <span className="font-semibold text-red-600">
                 {is3D ? 'Y축(높이): 허수 q(x)i' : 'Z축: 허수 q(x)i'}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}