import React, { useState, useEffect, useRef } from 'react';
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
// [NEW] 튜토리얼 카드 컴포넌트 (플로팅 형태)
// -----------------------------------------------------------------------------
const TutorialCard = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);

  // 닫힐 때 스텝 초기화
  useEffect(() => {
    if (!isOpen) setStep(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const tutorials = [
    {
      title: "복소함수 시각화 🚀",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            <strong>f(x) = g(x) + q(x)i</strong> 꼴의 복소함수를 3차원 공간에서 이해해보세요.
          </p>
          <div className="text-xs bg-blue-50 p-2 rounded text-blue-700">
            * 실수부(g)와 허수부(q)가 합쳐져 입체적인 그래프가 됩니다.
          </div>
        </div>
      )
    },
    {
      title: "3차원 좌표계 이해 📐",
      content: (
        <div className="space-y-2 text-sm">
          <ul className="list-disc list-inside space-y-1">
            <li><span className="font-bold">x축:</span> 입력값 (검정)</li>
            <li><span className="font-bold text-blue-600">z축(바닥):</span> 실수값 g(x)</li>
            <li><span className="font-bold text-red-600">y축(높이):</span> 허수값 q(x)</li>
          </ul>
          <p className="text-xs text-gray-500 mt-1">2D 뷰에서는 실수값(파랑)만 보입니다.</p>
        </div>
      )
    },
    {
      title: "그래프 조작법 🎮",
      content: (
        <div className="space-y-2 text-sm">
          <p>마우스를 이용해 자유롭게 관찰하세요.</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-100 p-1 rounded text-center">🖱️ 드래그<br/>회전</div>
            <div className="bg-gray-100 p-1 rounded text-center">🖱️ 우클릭<br/>이동</div>
            <div className="bg-gray-100 p-1 rounded text-center">🔍 휠<br/>확대/축소</div>
          </div>
        </div>
      )
    },
    {
      title: "값 대입 & 관찰 👇",
      content: (
        <div className="space-y-2 text-sm">
          <p>오른쪽 아래 <strong>노란색 패널</strong>을 보세요.</p>
          <p>슬라이더를 움직여 특정 <strong>x값</strong>에서의 위치와 계산 결과를 실시간으로 확인할 수 있습니다.</p>
          <div className="text-xs text-gray-400 mt-1">
            * 그래프 위의 노란 점을 찾아보세요!
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (step < tutorials.length - 1) setStep(step + 1);
    else onClose();
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    // 우측 상단 플로팅 카드 스타일
    <div className="absolute top-4 right-4 z-30 w-72 bg-white/95 backdrop-blur border border-gray-200 shadow-xl rounded-lg overflow-hidden transition-all duration-300 animate-fade-in-down">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-4 py-3 flex justify-between items-center border-b border-gray-300">
        <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
          <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">{step + 1}</span>
          {tutorials[step].title}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg leading-none">&times;</button>
      </div>

      {/* 내용 */}
      <div className="p-4 min-h-[100px] text-gray-600">
        {tutorials[step].content}
      </div>

      {/* 네비게이션 */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
        <div className="flex gap-1">
          {tutorials.map((_, idx) => (
            <div 
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === step ? 'bg-blue-500' : 'bg-gray-300'}`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          {step > 0 && (
            <button 
              onClick={handlePrev}
              className="text-xs px-3 py-1.5 rounded bg-white border border-gray-300 hover:bg-gray-100 text-gray-600 transition-colors"
            >
              이전
            </button>
          )}
          <button 
            onClick={handleNext}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors"
          >
            {step === tutorials.length - 1 ? '시작하기' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 통합 Three.js 캔버스 컴포넌트
// -----------------------------------------------------------------------------
const ThreeCanvas = ({ gExp, qExp, is3DMode, evalX }) => {
  const mountRef = useRef(null);
  
  const sceneRefs = useRef({
    scene: null,
    camera: null,
    renderer: null,
    mainLine: null,
    spheres: [],
    gridHelper: null,
    axes: { x: null, real: null, imag: null },
    marker: null, 
    markerLines: [],
    animationId: null,
    updateGraph: null,
  });

  const animState = useRef({
    currentT: 0, 
    targetT: 0,
    time: 0,
  });

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f9fafb');

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 25);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    const gridHelper = new THREE.GridHelper(30, 30, 0xdddddd, 0xeeeeee);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    const maxPoints = 2000;
    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 });
    const mainLine = new THREE.Line(lineGeo, lineMat);
    lineGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
    scene.add(mainLine);

    const sphereGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0x10b981 });
    const spheres = [];
    for (let i = 0; i < 50; i++) {
      const mesh = new THREE.Mesh(sphereGeo, sphereMat);
      mesh.visible = false;
      scene.add(mesh);
      spheres.push(mesh);
    }

    const markerGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const markerMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffa500, emissiveIntensity: 0.5 });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.visible = false;
    scene.add(marker);

    const markerLines = [];
    for(let i=0; i<3; i++) {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const mat = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.5, dashSize: 0.2, gapSize: 0.1 });
        const line = new THREE.Line(geo, mat); 
        scene.add(line);
        markerLines.push(line);
    }

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
      scene, camera, renderer, mainLine, spheres, gridHelper, axes, marker, markerLines, animationId: null, updateGraph: null
    };

    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    const canvas = renderer.domElement;

    const animate = () => {
      sceneRefs.current.animationId = requestAnimationFrame(animate);

      const state = animState.current;
      const refs = sceneRefs.current;
      
      state.currentT += (state.targetT - state.currentT) * 0.1;
      if (Math.abs(state.targetT - state.currentT) < 0.001) state.currentT = state.targetT;
      const t = state.currentT;

      if (refs.updateGraph) {
        refs.updateGraph();
      }

      const startPos = new THREE.Vector3(0, 0, 25);
      const endPos = new THREE.Vector3(10.14, 20.48, 10.14);
      const targetPos = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      
      if (!isDragging && Math.abs(state.targetT - state.currentT) > 0.01) {
        refs.camera.position.copy(targetPos);
        refs.camera.lookAt(0, 0, 0);
      }

      refs.gridHelper.rotation.x = THREE.MathUtils.lerp(Math.PI / 2, 0, t);
      state.time += 0.02;
      refs.gridHelper.position.y = Math.sin(state.time) * 0.05;

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

      refs.renderer.render(refs.scene, refs.camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const onPointerDown = (e) => { 
      e.preventDefault(); 
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

  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs.mainLine) return;

    animState.current.targetT = is3DMode ? 1 : 0;

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

    let markerPos = { x: 0, y: 0, z: 0, valid: false };
    if (evalX !== undefined && evalX !== '') {
        const x = parseFloat(evalX);
        if (!isNaN(x)) {
            let r = 0, i = 0;
            if (gExp) {
                const val = evaluateFunction(gExp, x);
                if (!isNaN(val)) r = val;
            }
            if (qExp) {
                const val = evaluateFunction(qExp, x);
                if (!isNaN(val)) i = val;
            }
            markerPos = { x, real: r, imag: i, valid: true };
        }
    }

    const updateGeometry = () => {
      const positions = refs.mainLine.geometry.attributes.position.array;
      const t = animState.current.currentT;

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

      if (markerPos.valid) {
          refs.marker.visible = true;
          const mx = markerPos.x;
          const my = (1 - t) * markerPos.real + t * markerPos.imag;
          const mz = (1 - t) * 0 + t * markerPos.real;
          refs.marker.position.set(mx, my, mz);

          const lines = refs.markerLines;
          
          lines[0].geometry.setFromPoints([new THREE.Vector3(mx, my, mz), new THREE.Vector3(mx, 0, mz)]);
          lines[0].visible = true;

          lines[1].geometry.setFromPoints([new THREE.Vector3(mx, 0, mz), new THREE.Vector3(mx, 0, 0)]);
          lines[1].visible = true;

          lines[2].geometry.setFromPoints([new THREE.Vector3(mx, 0, mz), new THREE.Vector3(0, 0, mz)]);
          lines[2].visible = is3DMode || Math.abs(mz) > 0.1;

      } else {
          refs.marker.visible = false;
          refs.markerLines.forEach(l => l.visible = false);
      }
    };

    sceneRefs.current.updateGraph = updateGeometry;
    updateGeometry();

  }, [gExp, qExp, is3DMode, evalX]);

  return (
    <div 
      ref={mountRef} 
      className="w-full h-full cursor-move select-none" 
      style={{ touchAction: 'none' }} 
    />
  );
};

// -----------------------------------------------------------------------------
// 메인 앱
// -----------------------------------------------------------------------------
export default function App() {
  const [gInput, setGInput] = useState('x^2 - 2x + 1'); 
  const [qInput, setQInput] = useState('');
  const [is3D, setIs3D] = useState(false);
  const [evalX, setEvalX] = useState('2');
  const [evalResult, setEvalResult] = useState({ r: 0, i: 0, valid: false });
  const [showTutorial, setShowTutorial] = useState(true);

  const presets = [
    { name: '기본 2차함수', g: 'x^2 - 2x + 1', q: '' },
    { name: '오일러 나선', g: 'cos(x)', q: 'sin(x)' },
    { name: '감쇠 진동', g: 'exp(-0.2x)cos(3x)', q: 'exp(-0.2x)sin(3x)' },
    { name: '복소 지수함수', g: 'exp(x)', q: '0' },
  ];

  const applyPreset = (preset) => {
    setGInput(preset.g);
    setQInput(preset.q);
    if(preset.q !== '') setIs3D(true);
  };

  useEffect(() => {
    if (qInput.trim() !== '' && !is3D) {
      setIs3D(true);
    } else if (qInput.trim() === '' && is3D) {
      setIs3D(false);
    }
  }, [qInput]);

  useEffect(() => {
      if (evalX === '' || isNaN(parseFloat(evalX))) {
          setEvalResult({ ...evalResult, valid: false });
          return;
      }
      const x = parseFloat(evalX);
      let r = 0, i = 0;
      let valid = true;
      
      if (gInput) {
          const val = evaluateFunction(gInput, x);
          if (isNaN(val)) valid = false;
          else r = val;
      }
      if (qInput) {
          const val = evaluateFunction(qInput, x);
          if (isNaN(val)) i = 0;
          else i = val;
      }
      setEvalResult({ r, i, valid });
  }, [evalX, gInput, qInput]);

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 font-sans overflow-hidden">
      {/* 헤더 */}
      <div className="bg-white p-4 md:p-6 shadow-md z-10 relative flex-shrink-0">
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">
                복소수 함수 시각화: <span className="font-mono text-purple-600 block md:inline mt-1 md:mt-0">f(x) = g(x) + q(x)i</span>
                </h1>
                {/* 튜토리얼 다시 열기 버튼 */}
                <button 
                  onClick={() => setShowTutorial(true)}
                  className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-sm font-bold flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition-colors mb-2"
                  title="튜토리얼 보기"
                >
                  ?
                </button>
            </div>
            
            <div className="hidden md:flex gap-2">
                {presets.map((p, idx) => (
                    <button 
                        key={idx}
                        onClick={() => applyPreset(p)}
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded transition-colors"
                    >
                        {p.name}
                    </button>
                ))}
            </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 md:gap-6 items-start md:items-end mb-1 mt-2">
          <div className="flex flex-col w-full md:w-auto">
            <label className="text-sm font-semibold text-blue-600 mb-1 flex items-center justify-between">
              <span>Step 1: 실수부 g(x)</span>
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

          <div className="flex flex-col w-full md:w-auto">
            <label className="text-sm font-semibold text-red-600 mb-1 flex items-center justify-between">
              <span>Step 2: 허수부 q(x)</span>
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

          <div className="flex items-center w-full md:w-auto pt-1 md:pt-0">
             <button
               onClick={() => setIs3D(!is3D)}
               className={`w-full md:w-auto px-4 py-3 md:py-2 rounded-md font-bold transition-colors shadow-sm text-sm md:text-base ${
                 is3D 
                 ? 'bg-purple-600 text-white hover:bg-purple-700' 
                 : 'bg-green-500 text-white hover:bg-green-600'
               }`}
             >
               {is3D ? '3D 뷰' : '2D 뷰'}
             </button>
          </div>
        </div>
        
        <div className="md:hidden mt-3">
            <select 
                onChange={(e) => {
                    const preset = presets.find(p => p.name === e.target.value);
                    if(preset) applyPreset(preset);
                }}
                className="w-full border p-2 rounded text-sm bg-gray-50 text-gray-600"
                defaultValue=""
            >
                <option value="" disabled>✨ 예제 함수 선택하기</option>
                {presets.map((p, idx) => (
                    <option key={idx} value={p.name}>{p.name}</option>
                ))}
            </select>
        </div>
      </div>

      <div className="flex-1 relative bg-gradient-to-b from-gray-100 to-gray-200 overflow-hidden">
        {/* 튜토리얼 카드 (이제 캔버스 내부, 우측 상단에 위치) */}
        <TutorialCard isOpen={showTutorial} onClose={() => setShowTutorial(false)} />

        <ThreeCanvas gExp={gInput} qExp={qInput} is3DMode={is3D} evalX={evalX} />
        
        <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-auto bg-white/90 backdrop-blur p-3 rounded-lg shadow-lg pointer-events-none select-none text-xs md:text-sm border border-gray-100 z-10">
          <ul className="space-y-1">
            <li className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400 border border-yellow-600"></div> 
              <span className="font-semibold text-gray-800">현재 위치 (x={evalX})</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500"></div> 
              <span className="font-semibold text-blue-600">실수 g(x)</span>
            </li>
            <li className={`flex items-center gap-2 transition-opacity ${is3D ? 'opacity-100' : 'opacity-40'}`}>
              <div className="w-3 h-3 rounded bg-red-500"></div> 
              <span className="font-semibold text-red-600">허수 q(x)</span>
            </li>
          </ul>
        </div>

        <div className="absolute bottom-24 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-auto z-20">
            <div className="bg-yellow-50/90 backdrop-blur border border-yellow-200 shadow-lg rounded-md p-3 flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-sm font-bold text-yellow-700 whitespace-nowrap">x 값 대입:</span>
                    <input 
                        type="number" 
                        value={evalX}
                        onChange={(e) => setEvalX(e.target.value)}
                        className="border border-yellow-300 p-1 w-24 rounded text-center font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
                    />
                    <input 
                        type="range" 
                        min="-10" max="10" step="0.1"
                        value={evalX || 0}
                        onChange={(e) => setEvalX(e.target.value)}
                        className="w-24 md:w-32 accent-yellow-500"
                    />
                </div>
                
                <div className="flex-1 text-center md:text-left min-w-[280px]">
                    {evalResult.valid ? (
                        <div className="text-sm font-mono bg-white/80 px-3 py-1 rounded border border-yellow-200 block shadow-sm w-full text-center">
                            <span className="text-gray-600">f({evalX}) = </span>
                            <span className="text-blue-600 font-bold">{parseFloat(evalResult.r.toFixed(3))}</span>
                            <span className="text-gray-400 mx-1">+</span>
                            <span className="text-red-600 font-bold">{parseFloat(evalResult.i.toFixed(3))}</span>
                            <span className="text-gray-500">i</span>
                        </div>
                    ) : (
                        <span className="text-xs text-red-400">유효하지 않은 수식입니다.</span>
                    )}
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}
