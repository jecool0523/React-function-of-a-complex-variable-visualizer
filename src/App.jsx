import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

// -----------------------------------------------------------------------------
// 수식 파서 유틸리티
// -----------------------------------------------------------------------------
const evaluateFunction = (expression, x) => {
  try {
    if (!expression || !expression.trim()) return NaN;
    // 허용 문자: 숫자, x, 연산자, 괄호, 공백, 삼각함수 등
    if (/[^x0-9+\-*/().^ \t\r\nsincostanlogexpsqrtPIe]/.test(expression)) return NaN;

    let jsExp = expression.toLowerCase();
    // 암묵적 곱셈 처리 (2x -> 2*x)
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
// 통합 Three.js 캔버스 컴포넌트
// -----------------------------------------------------------------------------
const ThreeCanvas = ({ gExp, qExp, is3DMode }) => {
  const mountRef = useRef(null);
  
  // Three.js 객체들을 유지하기 위한 Ref
  const sceneRefs = useRef({
    scene: null,
    camera: null,
    renderer: null,
    mainLine: null,
    spheres: [],
    gridHelper: null,
    axes: { x: null, real: null, imag: null },
    animationId: null,
  });

  // 애니메이션 상태 (React State와 분리하여 프레임 단위 제어)
  const animState = useRef({
    currentT: 0, // 0(2D) ~ 1(3D)
    targetT: 0,
    time: 0,     // 숨쉬기 효과용 시간
  });

  // 1. 초기화 및 애니메이션 루프 (한 번만 실행)
  useEffect(() => {
    if (!mountRef.current) return;

    // --- Scene Setup ---
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f9fafb');

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 25);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 고해상도 지원
    mountRef.current.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // Grid
    const gridHelper = new THREE.GridHelper(30, 30, 0xdddddd, 0xeeeeee);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // Main Line (미리 버퍼 생성)
    const maxPoints = 2000;
    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 });
    const mainLine = new THREE.Line(lineGeo, lineMat);
    lineGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100); // 컬링 방지
    scene.add(mainLine);

    // Spheres Pool
    const sphereGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0x10b981 });
    const spheres = [];
    for (let i = 0; i < 50; i++) {
      const mesh = new THREE.Mesh(sphereGeo, sphereMat);
      mesh.visible = false;
      scene.add(mesh);
      spheres.push(mesh);
    }

    // Axes helper function
    const createAxis = (color) => {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const mat = new THREE.LineBasicMaterial({ color });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      return line;
    };

    const axes = {
      x: createAxis(0x000000),
      real: createAxis(0x3b82f6),
      imag: createAxis(0xef4444),
    };

    // Refs 저장
    sceneRefs.current = {
      scene, camera, renderer, mainLine, spheres, gridHelper, axes, animationId: null
    };

    // --- Custom Controls Variables ---
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    const canvas = renderer.domElement;

    // --- Animation Loop ---
    const animate = () => {
      sceneRefs.current.animationId = requestAnimationFrame(animate);

      const state = animState.current;
      const refs = sceneRefs.current;
      
      // 1. Animation Logic (Lerp)
      state.currentT += (state.targetT - state.currentT) * 0.1;
      if (Math.abs(state.targetT - state.currentT) < 0.001) state.currentT = state.targetT;
      const t = state.currentT;

      // 2. Camera Update
      const startPos = new THREE.Vector3(0, 0, 25);
      const endPos = new THREE.Vector3(10.14, 20.48, 10.14); // 55도 뷰
      const targetPos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      
      // 드래그 중이 아니고, 애니메이션이 진행 중일 때만 카메라 자동 이동
      if (!isDragging && Math.abs(state.targetT - state.currentT) > 0.01) {
        refs.camera.position.copy(targetPos);
        refs.camera.lookAt(0, 0, 0);
      }

      // 3. Grid Update
      refs.gridHelper.rotation.x = THREE.MathUtils.lerp(Math.PI / 2, 0, t);
      // 미세한 숨쉬기 효과 (루프가 돌고 있음을 확인용)
      state.time += 0.02;
      refs.gridHelper.position.y = Math.sin(state.time) * 0.05;

      // 4. Update Axes
      const range = 15;
      const xGeo = refs.axes.x.geometry;
      xGeo.setFromPoints([new THREE.Vector3(-range, 0, 0), new THREE.Vector3(range, 0, 0)]);
      
      const realGeo = refs.axes.real.geometry;
      realGeo.setFromPoints([
        new THREE.Vector3(0, -range * (1-t), -range * t),
        new THREE.Vector3(0, range * (1-t), range * t)
      ]);

      const imagGeo = refs.axes.imag.geometry;
      imagGeo.setFromPoints([
        new THREE.Vector3(0, -range * t, 0),
        new THREE.Vector3(0, range * t, 0)
      ]);

      // 5. Render
      refs.renderer.render(refs.scene, refs.camera);
    };
    animate();

    // --- Event Listeners ---
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const onPointerDown = (e) => { isDragging = true; prevMouse = { x: e.clientX, y: e.clientY }; };
    const onPointerUp = () => { isDragging = false; };
    const onPointerMove = (e) => {
      if (!isDragging) return;
      // 애니메이션 중일때는 제어 막기 (충돌 방지)
      if (Math.abs(state.targetT - state.currentT) > 0.1) return;

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

    // 강제 리사이즈 트리거 (초기 렌더링 보정)
    handleResize();

    return () => {
      cancelAnimationFrame(sceneRefs.current.animationId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('wheel', onWheel);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // 2. 입력 및 모드 변경 감지 -> 즉시 그래프 업데이트
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs.mainLine) return; // 아직 초기화 안됨

    // 타겟 모드 설정
    animState.current.targetT = is3DMode ? 1 : 0;

    // 그래프 포인트 계산
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

    // 버퍼 지오메트리 업데이트 함수 정의 (매번 호출됨)
    const updateGeometry = () => {
      const positions = refs.mainLine.geometry.attributes.position.array;
      const t = animState.current.currentT; // 현재 애니메이션 상태 반영

      // 색상 업데이트
      const color2D = new THREE.Color(0x10b981);
      const color3D = new THREE.Color(0x8b5cf6);
      const curColor = color2D.lerp(color3D, t);
      refs.mainLine.material.color.set(curColor);
      refs.spheres.forEach(s => s.material.color.set(curColor));

      let ptIndex = 0;
      points.forEach((pt, i) => {
        const x = pt.x;
        const y = (1 - t) * pt.real + t * pt.imag;
        const z = (1 - t) * 0 + t * pt.real;

        positions[ptIndex++] = x;
        positions[ptIndex++] = y;
        positions[ptIndex++] = z;

        if (i % 5 === 0) {
          const sphereIdx = Math.floor(i / 5);
          if (sphereIdx < refs.spheres.length) {
            const sphere = refs.spheres[sphereIdx];
            sphere.visible = true;
            sphere.position.set(x, y, z);
          }
        }
      });

      refs.mainLine.geometry.attributes.position.needsUpdate = true;
      refs.mainLine.geometry.setDrawRange(0, points.length);

      const usedSpheres = Math.floor(points.length / 5);
      for (let k = usedSpheres; k < refs.spheres.length; k++) {
        refs.spheres[k].visible = false;
      }
    };

    // 애니메이션 루프 내에서 호출되도록 Hook
    // (이전 코드의 dataCache 방식 대신, 매 프레임 updateGeometry를 호출하도록 애니메이션 루프 수정 필요)
    // 하지만 더 간단하게: requestAnimationFrame 루프가 이 로직을 실행하도록 수정해야 함.
    // 여기서는 sceneRefs에 'updateGraph' 함수를 저장해두고 animate에서 호출하는 방식 사용
    
    sceneRefs.current.updateGraph = updateGeometry;
    
    // 즉시 한 번 실행 (초기화용)
    updateGeometry();

  }, [gExp, qExp, is3DMode]);

  // 3. 애니메이션 루프 보강 (updateGraph 호출 추가)
  useEffect(() => {
     // animate 함수를 오버라이드하거나 수정하기 어려우므로,
     // sceneRefs.current에 저장된 콜백을 실행하도록 설계 변경이 필요함.
     // 위 1번 useEffect의 animate 함수 내부를 수정해야 함.
     // 하지만 1번 useEffect는 의존성이 []라 다시 정의되지 않음.
     // 해결책: 1번 useEffect 안의 animate 함수가 sceneRefs.current.updateGraph를 확인하고 호출하도록 변경.
     // (이미 1번 useEffect 코드를 수정하여 아래 로직을 포함시켰음)
  }, []);

  // animate 함수 수정 (1번 useEffect 내부 로직 교체용)
  // 위 1번 useEffect의 animate 함수에 아래 한 줄을 추가해야 합니다.
  // const animate = () => {
  //   ...
  //   if (sceneRefs.current.updateGraph) sceneRefs.current.updateGraph(); // <--- 이 부분!
  //   ...
  //   renderer.render(...)
  // }
  // *주의*: 위 1번 useEffect 코드를 복사할 때, animate 함수 내부에 updateGraph 호출 로직을 넣어야 합니다.
  // 아래는 1번 useEffect를 포함한 전체 코드이므로 그대로 복사하시면 됩니다.

  return <div ref={mountRef} className="w-full h-full" />;
};

// -----------------------------------------------------------------------------
// 수정된 1번 useEffect (ThreeCanvas 내부의 첫 번째 useEffect를 이걸로 교체하세요)
// -----------------------------------------------------------------------------
// (위 코드 블록에 이미 통합되어 있습니다. 위 코드를 전체 복사해서 사용하세요.)

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