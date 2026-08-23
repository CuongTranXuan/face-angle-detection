import React, { useEffect, useRef, useState } from 'react';
import './Blazeface.css';
import { publicAsset } from '../utils/paths';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const MAX_FACES = 20;

const colors = ['#9d7bff', '#45d8ca', '#ffb45b', '#ff7f92', '#e8e7e2'];

function classifyAngle(value) {
  if (value < -0.06) return 'Facing left';
  if (value >= 0.07) return 'Facing right';
  return 'Facing straight';
}

function Blazeface({ isActive, onStateChange }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const memoryRef = useRef({ dst: null, resultBuffer: null });
  const moduleRef = useRef(null);
  const mountedRef = useRef(true);
  const onStateChangeRef = useRef(onStateChange);
  const [moduleReady, setModuleReady] = useState(false);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    const scriptIds = ['wasm-feature-detect', 'blazeface-runtime'];

    const loadScript = (id, src) => new Promise((resolve, reject) => {
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
        } else {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', reject, { once: true });
        }
        return;
      }
      const script = document.createElement('script');
      script.id = id;
      script.async = true;
      script.src = src;
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
      }, { once: true });
      script.addEventListener('error', () => reject(new Error(`Unable to load ${src}`)), { once: true });
      document.body.appendChild(script);
    });

    const loadRuntime = async () => {
      try {
        onStateChangeRef.current({ status: 'Loading WASM', statusTone: 'loading', detail: 'Selecting the fastest supported NCNN runtime.' });
        await loadScript(scriptIds[0], publicAsset('wasmFeatureDetect.js'));
        const wasmFeatureDetect = window.wasmFeatureDetect;
        if (!wasmFeatureDetect) throw new Error('WASM feature detection is unavailable');
        const [simdSupported, threadsSupported] = await Promise.all([
          wasmFeatureDetect.simd(),
          wasmFeatureDetect.threads(),
        ]);
        const moduleName = simdSupported
          ? (threadsSupported ? 'blazeface-simd-threads' : 'blazeface-simd')
          : (threadsSupported ? 'blazeface-threads' : 'blazeface-basic');

        window.Module = window.Module || {};
        const wasmResponse = await fetch(publicAsset(`ncnn/${moduleName}.wasm`));
        if (!wasmResponse.ok) throw new Error(`Unable to load ${moduleName}.wasm`);
        window.Module.wasmBinary = await wasmResponse.arrayBuffer();
        await loadScript(scriptIds[1], publicAsset(`ncnn/${moduleName}.js`));
        const loadedModule = window.Module;
        if (!loadedModule._blazeface_ncnn || !loadedModule._malloc) throw new Error('NCNN runtime exports are missing');
        moduleRef.current = loadedModule;
        if (!cancelled && mountedRef.current) {
          setModuleReady(true);
          onStateChangeRef.current({ status: 'Ready to start', statusTone: 'neutral', detail: `${moduleName} runtime is ready for camera input.` });
        }
      } catch (error) {
        console.error('BlazeFace WASM loading failed', error);
        onStateChangeRef.current({ status: 'Runtime error', statusTone: 'error', detail: 'The NCNN WebAssembly runtime could not be loaded.' });
      }
    };

    loadRuntime();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const releaseMemory = () => {
      const module = moduleRef.current;
      const memory = memoryRef.current;
      if (module && module._free) {
        if (memory.dst) module._free(memory.dst);
        if (memory.resultBuffer) module._free(memory.resultBuffer);
      }
      memoryRef.current = { dst: null, resultBuffer: null };
    };

    const stopCamera = () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      const canvas = canvasRef.current;
      if (canvas && process.env.NODE_ENV !== 'test') {
        const context = canvas.getContext('2d');
        if (context) context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      releaseMemory();
    };

    if (!isActive || !moduleReady) {
      if (!isActive) stopCamera();
      return stopCamera;
    }

    let cancelled = false;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const module = moduleRef.current;
        const imageBytes = CANVAS_WIDTH * CANVAS_HEIGHT * 4;
        memoryRef.current.dst = module._malloc(imageBytes);
        memoryRef.current.resultBuffer = module._malloc(16 * MAX_FACES * Float32Array.BYTES_PER_ELEMENT);
        onStateChangeRef.current({ status: 'Searching', statusTone: 'active', detail: 'Scanning with NCNN keypoints…' });

        const processFrame = () => {
          if (cancelled || !streamRef.current) return;
          const startedAt = performance.now();
          context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          context.save();
          context.translate(CANVAS_WIDTH, 0);
          context.scale(-1, 1);
          context.drawImage(video, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          const imageData = context.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          context.restore();
          module.HEAPU8.set(imageData.data, memoryRef.current.dst);
          module._blazeface_ncnn(CANVAS_WIDTH, CANVAS_HEIGHT, memoryRef.current.dst, memoryRef.current.resultBuffer);
          const results = module.HEAPF32.subarray(
            memoryRef.current.resultBuffer / Float32Array.BYTES_PER_ELEMENT,
            memoryRef.current.resultBuffer / Float32Array.BYTES_PER_ELEMENT + 16 * MAX_FACES
          );
          let foundFace = false;
          let latestAngle = '--';
          let latestDirection = 'No face detected';
          for (let index = 0; index < MAX_FACES; index += 1) {
            const offset = index * 16;
            const label = results[offset];
            const probability = results[offset + 1];
            if (label === -233 || probability <= 0) continue;
            foundFace = true;
            const bboxX = results[offset + 2];
            const bboxY = results[offset + 3];
            const bboxW = results[offset + 4];
            const bboxH = results[offset + 5];
            const rightEyeX = results[offset + 6];
            const leftEyeX = results[offset + 8];
            const noseX = results[offset + 10];
            const angle = (leftEyeX + (rightEyeX - leftEyeX) / 2 - noseX) / bboxW;
            latestAngle = angle.toFixed(2);
            latestDirection = classifyAngle(angle);
            context.strokeStyle = colors[index % colors.length];
            context.lineWidth = 3;
            context.strokeRect(bboxX, bboxY, bboxW, bboxH);
            context.fillStyle = '#f4f3ef';
            context.font = '600 15px Manrope, sans-serif';
            context.fillText(`${Math.round(probability * 100)}%`, bboxX + 8, Math.max(20, bboxY + 22));
            [6, 8, 10, 12, 14].forEach((pointOffset) => {
              context.fillStyle = '#ffb45b';
              context.beginPath();
              context.arc(results[offset + pointOffset], results[offset + pointOffset + 1], 4, 0, Math.PI * 2);
              context.fill();
            });
          }
          const elapsed = performance.now() - startedAt;
          onStateChangeRef.current({
            status: foundFace ? 'Face detected' : 'Searching',
            statusTone: 'active',
            fps: String(Math.round(1000 / Math.max(elapsed, 1))),
            angle: latestAngle,
            detail: latestDirection,
          });
          frameRef.current = window.requestAnimationFrame(processFrame);
        };
        processFrame();
      } catch (error) {
        console.error('BlazeFace camera failed to start', error);
        onStateChangeRef.current({ status: 'Camera unavailable', statusTone: 'error', detail: 'Camera permission was denied or is not available.' });
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isActive, moduleReady]);

  return (
    <div className="detector-frame detector-frame--blazeface">
      <video ref={videoRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} muted playsInline hidden />
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} aria-label="BlazeFace camera output" />
      {!isActive && <div className="detector-frame__empty"><span>BlazeFace</span><small>Press start to activate the camera</small></div>}
    </div>
  );
}

export default Blazeface;
