import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import './Camera.css';
import { publicAsset } from '../utils/paths';

const VIDEO_WIDTH = 480;
const VIDEO_HEIGHT = 480;

function meanPosition(points) {
  const total = points.reduce((sum, point) => [sum[0] + point.x, sum[1] + point.y], [0, 0]);
  return [total[0] / points.length, total[1] / points.length];
}

function classifyAngle(value) {
  if (value < -0.06) return 'Facing left';
  if (value >= 0.07) return 'Facing right';
  return 'Facing straight';
}

function Camera({ isActive, onStateChange }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);
  const onStateChangeRef = useRef(onStateChange);
  const processingRef = useRef(false);
  const [modelsReady, setModelsReady] = useState(false);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    mountedRef.current = true;
    const loadModels = async () => {
      try {
        onStateChangeRef.current({
          status: 'Loading model',
          statusTone: 'loading',
          detail: 'Loading SSD MobileNet and tiny landmark weights.',
        });
        const modelPath = publicAsset('models');
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelPath),
        ]);
        if (!mountedRef.current) return;
        setModelsReady(true);
        onStateChangeRef.current({
          status: 'Ready to start',
          statusTone: 'neutral',
          detail: 'Models loaded. Allow the camera to begin tracking.',
        });
      } catch (error) {
        console.error('Face API model loading failed', error);
        onStateChangeRef.current({
          status: 'Model error',
          statusTone: 'error',
          detail: 'Face API weights could not be loaded from this build.',
        });
      }
    };
    loadModels();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const stopCamera = () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      processingRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      if (canvasRef.current) {
        canvasRef.current.getContext('2d').clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      }
    };

    if (!isActive || !modelsReady) {
      if (!isActive) stopCamera();
      return stopCamera;
    }

    let cancelled = false;
    const startCamera = async () => {
      try {
        onStateChangeRef.current({
          status: 'Requesting camera',
          statusTone: 'loading',
          detail: 'Allow camera access to start the face-api stream.',
        });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT, facingMode: 'user' },
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
        onStateChangeRef.current({ status: 'Searching', statusTone: 'active', detail: 'Scanning for a face…' });

        intervalRef.current = window.setInterval(async () => {
          if (processingRef.current || !videoRef.current || videoRef.current.readyState < 2) return;
          processingRef.current = true;
          const startedAt = performance.now();
          try {
            const result = await faceapi
              .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
              .withFaceLandmarks(true);
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
            const dims = faceapi.matchDimensions(canvas, videoRef.current, true);
            const elapsed = performance.now() - startedAt;
            const fps = Math.round(1000 / Math.max(elapsed, 1));

            if (result) {
              const resized = faceapi.resizeResults(result, dims);
              const rightEye = meanPosition(resized.landmarks.getRightEye());
              const leftEye = meanPosition(resized.landmarks.getLeftEye());
              const nose = meanPosition(resized.landmarks.getNose());
              const angle = (leftEye[0] + (rightEye[0] - leftEye[0]) / 2 - nose[0]) / resized.detection.box.width;
              const direction = classifyAngle(angle);
              context.save();
              context.translate(canvas.width, 0);
              context.scale(-1, 1);
              faceapi.draw.drawDetections(canvas, resized);
              faceapi.draw.drawFaceLandmarks(canvas, resized);
              context.restore();
              onStateChangeRef.current({
                status: 'Face detected',
                statusTone: 'active',
                fps: String(fps),
                angle: angle.toFixed(2),
                detail: direction,
              });
            } else {
              onStateChangeRef.current({
                status: 'Searching',
                statusTone: 'active',
                fps: String(fps),
                angle: '--',
                detail: 'No face detected',
              });
            }
          } catch (error) {
            console.error('Face API detection failed', error);
            onStateChangeRef.current({ status: 'Runtime error', statusTone: 'error', detail: 'The detector stopped while reading the frame.' });
          } finally {
            processingRef.current = false;
          }
        }, 250);
      } catch (error) {
        console.error('Camera access failed', error);
        onStateChangeRef.current({
          status: 'Camera unavailable',
          statusTone: 'error',
          detail: 'Camera permission was denied or is not available in this browser.',
        });
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isActive, modelsReady]);

  return (
    <div className="detector-frame detector-frame--face-api">
      <video ref={videoRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} muted playsInline hidden />
      <canvas ref={canvasRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} aria-label="Face API camera output" />
      {!isActive && <div className="detector-frame__empty"><span>Face API</span><small>Press start to activate the camera</small></div>}
    </div>
  );
}

export default Camera;
