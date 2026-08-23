import React, { useEffect, useRef, useState } from 'react';
import './Haar.css';
import { publicAsset } from '../utils/paths';

const VIDEO_WIDTH = 480;
const VIDEO_HEIGHT = 480;

function Haar({ isActive, onStateChange }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const cvRef = useRef(null);
  const mountedRef = useRef(true);
  const onStateChangeRef = useRef(onStateChange);
  const [opencvReady, setOpencvReady] = useState(false);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    mountedRef.current = true;
    const scriptId = 'opencv-js-runtime';
    let script = document.getElementById(scriptId);
    const handleReady = () => {
      if (!window.cv) return;
      window.cv.onRuntimeInitialized = () => {
        if (!mountedRef.current) return;
        cvRef.current = window.cv;
        setOpencvReady(true);
        onStateChangeRef.current({
          status: 'Ready to start',
          statusTone: 'neutral',
          detail: 'OpenCV is ready for frontal-face detection.',
        });
      };
      if (window.cv.Mat) {
        cvRef.current = window.cv;
        setOpencvReady(true);
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = publicAsset('opencv.js');
      script.addEventListener('load', handleReady);
      document.body.appendChild(script);
    } else if (window.cv) {
      handleReady();
    }

    onStateChangeRef.current({
      status: 'Loading OpenCV',
      statusTone: 'loading',
      detail: 'Loading the OpenCV.js runtime and Haar cascade.',
    });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const stopCamera = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      if (canvasRef.current) {
        canvasRef.current.getContext('2d').clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      }
    };

    if (!isActive || !opencvReady) {
      if (!isActive) stopCamera();
      return stopCamera;
    }

    let cancelled = false;
    let classifier;
    let capture;
    let source;
    let gray;
    let destination;
    const cv = cvRef.current;

    const loadCascade = () => new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('GET', publicAsset('models/haarcascade_frontalface_default.xml'), true);
      request.responseType = 'arraybuffer';
      request.onload = () => {
        if (request.status !== 200) {
          reject(new Error(`Cascade request failed with status ${request.status}`));
          return;
        }
        try {
          const fileName = 'face-angle-haar.xml';
          if (cv.FS_createDataFile) {
            try { cv.FS_unlink(`/${fileName}`); } catch (error) { /* file is not mounted yet */ }
            cv.FS_createDataFile('/', fileName, new Uint8Array(request.response), true, false, false);
          }
          resolve(fileName);
        } catch (error) {
          reject(error);
        }
      };
      request.onerror = () => reject(new Error('Cascade request failed'));
      request.send();
    });

    const startCamera = async () => {
      try {
        const cascadeFile = await loadCascade();
        classifier = new cv.CascadeClassifier();
        classifier.load(cascadeFile);
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
        capture = new cv.VideoCapture(video);
        source = new cv.Mat(VIDEO_HEIGHT, VIDEO_WIDTH, cv.CV_8UC4);
        destination = new cv.Mat(VIDEO_HEIGHT, VIDEO_WIDTH, cv.CV_8UC4);
        gray = new cv.Mat();
        onStateChangeRef.current({ status: 'Searching', statusTone: 'active', detail: 'Scanning with Haar cascade…' });

        const processFrame = () => {
          if (cancelled || !streamRef.current) return;
          const startedAt = performance.now();
          try {
            capture.read(source);
            cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY, 0);
            const faces = new cv.RectVector();
            classifier.detectMultiScale(gray, faces, 1.2, 3, 0, new cv.Size(70, 70));
            destination.delete();
            destination = source.clone();
            let largestFace = null;
            let largestArea = 0;
            for (let index = 0; index < faces.size(); index += 1) {
              const face = faces.get(index);
              const area = face.width * face.height;
              if (area > largestArea) {
                largestArea = area;
                largestFace = face;
              }
            }
            if (largestFace) {
              cv.rectangle(
                destination,
                new cv.Point(largestFace.x, largestFace.y),
                new cv.Point(largestFace.x + largestFace.width, largestFace.y + largestFace.height),
                [69, 216, 202, 255],
                3
              );
            }
            cv.imshow(canvasRef.current, destination);
            faces.delete();
            const elapsed = performance.now() - startedAt;
            onStateChangeRef.current({
              status: largestFace ? 'Face detected' : 'Searching',
              statusTone: 'active',
              fps: String(Math.round(1000 / Math.max(elapsed, 1))),
              angle: '--',
              detail: largestFace ? 'Frontal face detected' : 'No face detected',
            });
          } catch (error) {
            console.error('Haar detection failed', error);
            onStateChangeRef.current({ status: 'Runtime error', statusTone: 'error', detail: 'OpenCV stopped while reading the frame.' });
          }
          timerRef.current = window.setTimeout(processFrame, 100);
        };
        processFrame();
      } catch (error) {
        console.error('Haar detector failed to start', error);
        onStateChangeRef.current({ status: 'Detector error', statusTone: 'error', detail: 'OpenCV or camera access could not be initialized.' });
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
      [source, destination, gray, classifier, capture].forEach((resource) => {
        if (resource && typeof resource.delete === 'function') resource.delete();
      });
    };
  }, [isActive, opencvReady]);

  return (
    <div className="detector-frame detector-frame--haar">
      <video ref={videoRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} muted playsInline hidden />
      <canvas ref={canvasRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} aria-label="OpenCV Haar camera output" />
      {!isActive && <div className="detector-frame__empty"><span>Haar cascade</span><small>Press start to activate the camera</small></div>}
    </div>
  );
}

export default Haar;
