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
    updateGraph: null, // 그래프 업데이트 함수 저장소
  });

  // 애니메이션 상태
  const animState = useRef({
    currentT: 0, // 0(2D) ~ 1(3D)
    targetT: 0,
    time: 0,
  });

  // 1. 초기화 및 애니메이션 루프
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

    // Main Line
    const maxPoints = 2000;
    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 });
    const mainLine = new THREE.Line(lineGeo, lineMat);
    lineGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
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

    // Axes
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

    sceneRefs.current = {
      scene, camera, renderer, mainLine, spheres, gridHelper, axes, animationId: null, updateGraph: null
    };

    // Controls Vars
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    const canvas = renderer.domElement;

    // --- Animation Loop ---
    const animate = () => {
      sceneRefs.current.animationId = requestAnimationFrame(animate);

      const state = animState.current;
      const refs = sceneRefs.current;
      
      // 1. Animation Logic
      state.currentT += (state.targetT - state.currentT) * 0.1;
      if (Math.abs(state.targetT - state.currentT) < 0.001) state.currentT = state.targetT;
      const t = state.currentT;

      // 2. Call Graph Update
      if (refs.updateGraph) {
        refs.updateGraph();
      }

      // 3. Camera Update
      const startPos = new THREE.Vector3(0, 0, 25);
      const endPos = new THREE.Vector3(10.14, 20.48, 10.14); // 55도
      const targetPos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      
      if (!isDragging && Math.abs(state.targetT - state.currentT) > 0.01) {
        refs.camera.position.copy(targetPos);
        refs.camera.lookAt(0, 0, 0);
      }

      // 4. Grid Update
      refs.gridHelper.rotation.x = THREE.MathUtils.lerp(Math.PI / 2, 0, t);
      state.time += 0.02;
      refs.gridHelper.position.y = Math.sin(state.time) * 0.05;

      // 5. Update Axes
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

      // 6. Render
      refs.renderer.render(refs.scene, refs.camera);
    };
    animate();

    // Event Listeners
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // [FIX] 포인터 이벤트 핸들러 강화
    const onPointerDown = (e) => { 
      e.preventDefault(); // 기본 드래그/선택 방지
      isDragging = true; 
      prevMouse = { x: e.clientX, y: e.clientY }; 
    };
    
    const onPointerUp = () => { isDragging = false; };
    
    const onPointerMove = (e) => {
      if (!isDragging) return;
      
      // [FIX] 여기서 'state' 변수가 정의되지 않아 오류가 발생했었습니다.
      // animState.current로 직접 접근하여 해결합니다.
      const currentAnimState = animState.current;
      if (Math.abs(currentAnimState.targetT - currentAnimState.currentT) > 0.1) return;

      const deltaX = e.clientX - prevMouse.x;
      const deltaY = e.clientY - prevMouse.y;
      prevMouse = { x: e.clientX, y: e.clientY };

      const offset = new THREE.Vector3().copy(camera.position);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta -= deltaX * 0.005;
      spherical.phi -= deltaY * 0.005;
      // 짐벌락 방지 및 회전 범위 제한
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

  // 2. 입력 및 모드 변경 감지
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs.mainLine) return;

    animState.current.targetT = is3DMode ? 1 : 0;

    // 그래프 포인트 미리 계산
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

    // 매 프레임 호출될 업데이트 함수 정의
    const updateGeometry = () => {
      const positions = refs.mainLine.geometry.attributes.position.array;
      const t = animState.current.currentT; // 현재 애니메이션 진행도 사용

      // 색상 업데이트
      const color2D = new THREE.Color(0x10b981);
      const color3D = new THREE.Color(0x8b5cf6);
      const curColor = color2D.lerp(color3D, t);
      refs.mainLine.material.color.set(curColor);
      refs.spheres.forEach(s => s.material.color.set(curColor));

      let ptIndex = 0;
      points.forEach((pt, i) => {
        const x = pt.x;
        // y: real -> imag 로 변환
        const y = (1 - t) * pt.real + t * pt.imag;
        // z: 0 -> real 로 변환 (실수축이 바닥으로 누움)
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

    // 업데이트 함수 등록 (animate 루프에서 호출됨)
    sceneRefs.current.updateGraph = updateGeometry;
    
    // 초기화용 1회 실행
    updateGeometry();

  }, [gExp, qExp, is3DMode]);

  return (
    <div 
      ref={mountRef} 
      className="w-full h-full cursor-move select-none" 
      style={{ touchAction: 'none' }} 
    />
  );
};

// -----------------------------------------------------------------------------
// 메인 앱 (반응형 UI 적용)
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
    // overflow-hidden을 추가하여 모바일 스크롤 바운스 방지
    <div className="flex flex-col h-screen w-full bg-gray-50 font-sans overflow-hidden">
      {/* 헤더: 모바일에서는 패딩과 텍스트 크기를 줄임 */}
      <div className="bg-white p-4 md:p-6 shadow-md z-10 relative flex-shrink-0">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">
          복소수 함수 시각화: <span className="font-mono text-purple-600 block md:inline mt-1 md:mt-0">f(x) = g(x) + q(x)i</span>
        </h1>
        <p className="text-xs md:text-sm text-gray-500 mb-4 md:mb-6">
          실수 함수 g(x)에 허수 성분 q(x)가 추가되어 차원이 확장되는 과정
          <span className="hidden md:inline">을 시각적으로 확인하세요.</span>
          <span className="text-xs text-gray-400 block mt-1">
            * '2x' 처럼 곱셈 기호 생략 가능
          </span>
        </p>

        {/* 입력 컨트롤: 모바일에서는 세로 배치(flex-col), PC에서는 가로 배치(md:flex-row) */}
        <div className="flex flex-col md:flex-row gap-3 md:gap-6 items-start md:items-end">
          
          {/* Step 1 Input */}
          <div className="flex flex-col w-full md:w-auto">
            <label className="text-sm font-semibold text-blue-600 mb-1 flex items-center justify-between">
              <span>Step 1: 실수부 g(x)</span>
              <span className="text-xs font-normal text-gray-400 ml-2">(2D Y축 / 3D 바닥)</span>
            </label>
            <div className="flex items-center w-full">
              <span className="bg-blue-100 text-blue-800 px-3 py-2 rounded-l-md font-mono flex-shrink-0">y =</span>
              <input
                type="text"
                value={gInput}
                onChange={(e) => setGInput(e.target.value)}
                placeholder="예: x^2"
                className="border border-blue-300 p-2 w-full md:w-48 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono min-w-0"
              />
            </div>
          </div>

          {/* Step 2 Input */}
          <div className="flex flex-col w-full md:w-auto">
            <label className="text-sm font-semibold text-red-600 mb-1 flex items-center justify-between">
              <span>Step 2: 허수부 q(x)</span>
              <span className="text-xs font-normal text-gray-400 ml-2">(3D 높이)</span>
            </label>
            <div className="flex items-center w-full">
              <span className="bg-red-100 text-red-800 px-3 py-2 rounded-l-md font-mono flex-shrink-0">z =</span>
              <input
                type="text"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="예: 2x"
                className="border border-red-300 p-2 w-full md:w-48 rounded-r-md focus:outline-none focus:ring-2 focus:ring-red-500 font-mono min-w-0"
              />
              <span className="ml-2 font-mono text-lg text-gray-400 flex-shrink-0">× i</span>
            </div>
          </div>

          {/* View Toggle Button */}
          <div className="flex items-center w-full md:w-auto pt-1 md:pt-0 md:pb-2">
             <button
               onClick={() => setIs3D(!is3D)}
               className={`w-full md:w-auto px-4 py-3 md:py-2 rounded-md font-bold transition-colors shadow-sm text-sm md:text-base ${
                 is3D 
                 ? 'bg-purple-600 text-white hover:bg-purple-700' 
                 : 'bg-green-500 text-white hover:bg-green-600'
               }`}
             >
               {is3D ? '3D 뷰 (회전 가능)' : '2D 뷰 (평면)'}
             </button>
          </div>
        </div>
        
        {/* Helper Text */}
        <div className="mt-3 md:mt-4 flex flex-col md:flex-row gap-1 text-[10px] md:text-xs text-gray-400">
           <span>사용 가능: 다항식, 삼각함수, 지수/로그 등</span>
           <span className="hidden md:inline">|</span>
           <span>터치 조작: 드래그(회전), 두 손가락(이동/줌)</span>
        </div>
      </div>

      {/* 캔버스 영역 */}
      <div className="flex-1 relative bg-gradient-to-b from-gray-100 to-gray-200 overflow-hidden">
        <ThreeCanvas gExp={gInput} qExp={qInput} is3DMode={is3D} />
        
        {/* 범례: 모바일에서는 하단에 작게 표시 */}
        <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-auto bg-white/90 backdrop-blur p-3 rounded-lg shadow-lg pointer-events-none select-none text-xs md:text-sm border border-gray-100">
          <h3 className="font-bold text-gray-700 mb-2 border-b pb-1">축 설명</h3>
          <ul className="space-y-1">
            <li className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-black"></div> 
              <span className="font-semibold text-gray-800">X축: 입력값</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500"></div> 
              <span className="font-semibold text-blue-600">
                {is3D ? 'Z축(바닥): 실수' : 'Y축(세로): 실수'}
              </span>
            </li>
            <li className={`flex items-center gap-2 transition-opacity ${is3D ? 'opacity-100' : 'opacity-40'}`}>
              <div className="w-4 h-4 rounded bg-red-500"></div> 
              <span className="font-semibold text-red-600">
                 {is3D ? 'Y축(높이): 허수' : 'Z축: 허수'}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
