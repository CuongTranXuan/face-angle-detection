import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import './Camera.css';
import { publicAsset } from '../utils/paths';

const VIDEO_WIDTH = 480;
const VIDEO_HEIGHT = 480;
const DETECTION_INTERVAL_MS = 500;
const MIN_CONFIDENCE = 0.5;
const MAX_RESULTS = 2;
const USE_TINY_MODEL = true;

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
          faceapi.loadSsdMobilenetv1Model(modelPath),
          faceapi.loadFaceLandmarkTinyModel(modelPath),
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
      if (videoRef.current) {
        if (process.env.NODE_ENV !== 'test') videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      if (canvasRef.current && process.env.NODE_ENV !== 'test') {
        const context = canvasRef.current.getContext('2d');
        if (context) context.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
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
        const canvas = canvasRef.current;
        video.srcObject = stream;
        await video.play();
        onStateChangeRef.current({ status: 'Searching', statusTone: 'active', detail: 'Scanning for a face…' });

        intervalRef.current = window.setInterval(async () => {
          if (processingRef.current || !videoRef.current || videoRef.current.readyState < 2) return;
          processingRef.current = true;
          const startedAt = performance.now();
          try {
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Canvas 2D context is unavailable');
            const result = await faceapi
              .detectSingleFace(
                videoRef.current,
                new faceapi.SsdMobilenetv1Options({
                  minConfidence: MIN_CONFIDENCE,
                  maxResults: MAX_RESULTS,
                })
              )
              .withFaceLandmarks(USE_TINY_MODEL);
            context.clearRect(0, 0, canvas.width, canvas.height);
            const dims = faceapi.matchDimensions(canvas, videoRef.current, true);
            context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            const elapsed = performance.now() - startedAt;
            const fps = Math.round(1000 / Math.max(elapsed, 1));
            if (result) {
              const resized = faceapi.resizeResults(result, dims);
              const rightEye = meanPosition(resized.landmarks.getRightEye());
              const leftEye = meanPosition(resized.landmarks.getLeftEye());
              const nose = meanPosition(resized.landmarks.getNose());
              const angle = (leftEye[0] + (rightEye[0] - leftEye[0]) / 2 - nose[0]) / resized.detection._box._width;
              const direction = classifyAngle(angle);
              faceapi.draw.drawDetections(canvas, resized);
              faceapi.draw.drawFaceLandmarks(canvas, resized);
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
        }, DETECTION_INTERVAL_MS);
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
