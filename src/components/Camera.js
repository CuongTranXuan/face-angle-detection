import { useEffect, useRef, useState } from "react";
import React from "react";
import * as faceapi from "face-api.js";
import "./Camera.css";

function Camera() {
  const videoRef = useRef(null);
  const [detecting, setDetecting] = useState(0);
  const canvasRef = useRef(null);
  const timeRef = useRef(null);
  const fpsRef = useRef(null);
  const faceangleRef = useRef(null);
  let forwardTimes = [];
  useEffect(async () => {
    await faceapi.loadSsdMobilenetv1Model("/models");
    await faceapi.loadFaceLandmarkTinyModel("/models");
    // await faceapi.loadFaceExpressionModel("/models");
    // await faceapi.loadMtcnnModel("/models");
    // await faceapi.loadFaceRecognitionModel("/models");
  }, []);

  const getVideo = () => {
    const constraints = (window.constraints = {
      audio: false,
      video: { width: 480, height: 480 },
    });
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        let video = videoRef.current;
        video.srcObject = stream;
        video.play();
        detect();
      })
      .catch((err) => {
        console.error("error:", err);
      });
  };
  const stopVideo = () => {
    let video = videoRef.current;
    let tracks = video.srcObject.getTracks();
    tracks.forEach((track) => {
      track.stop();
    });
    clearInterval(detecting);
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  };
  const updateTimeStats = (timeInMs) => {
    forwardTimes = [timeInMs].concat(forwardTimes).slice(0, 30);
    const avgTimeInMs =
      forwardTimes.reduce((total, t) => total + t) / forwardTimes.length;
    let time = timeRef.current;
    let fps = fpsRef.current;
    time.value = Math.round(avgTimeInMs) + " ms";
    fps.value = faceapi.utils.round(1000 / avgTimeInMs) + " fps";
  };
  const getTop = (l) => {
    return l.map((a) => a.y).reduce((a, b) => Math.min(a, b));
  };

  const getMeanPosition = (l) => {
    return l
      .map((a) => [a.x, a.y])
      .reduce((a, b) => [a[0] + b[0], a[1] + b[1]])
      .map((a) => a / l.length);
  };
  const detect = () => {
    let video = videoRef.current;
    let interval = setInterval(async () => {
      const ts = Date.now();
      // SSD face
      const useTinyModel = true;
      const minConfidence = 0.5;
      const maxResults = 2;
      const result = await faceapi
        .detectSingleFace(
          video,
          new faceapi.SsdMobilenetv1Options({ minConfidence, maxResults })
        )
        .withFaceLandmarks(useTinyModel);
      updateTimeStats(Date.now() - ts);
      if (result) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.setTransform(-1, 0, 0, 1, canvas.width, 0);
        const dims = faceapi.matchDimensions(canvas, video, true);
        const resizedDetections = faceapi.resizeResults(result, dims);

        let right_eye = getMeanPosition(
          resizedDetections["landmarks"].getRightEye()
        );
        let left_eye = getMeanPosition(
          resizedDetections["landmarks"].getLeftEye()
        );
        let nose = getMeanPosition(resizedDetections["landmarks"].getNose());
        let mouth = getMeanPosition(resizedDetections["landmarks"].getMouth());
        let jaw = getTop(resizedDetections["landmarks"].getJawOutline());
        // console.log(eye_left,eye_right, nose, mouth, jaw)
        // let rx = (jaw - mouth) / resizedDetections["_box"]["_height"];
        let ry =
          (left_eye[0] + (right_eye[0] - left_eye[0]) / 2 - nose[0]) /
          resizedDetections["detection"]["_box"]["_width"];
        let face_val = ry.toFixed(2);
        let faceangle = faceangleRef.current;

        if (face_val < -0.06) {
          //user moving in left direction
          faceangle.value =
            "user is facing left side, face angle = " + ry.toFixed(2);
        } else if (face_val >= 0.07) {
          //user moving in right direction
          faceangle.value =
            "user is facing right side, face angle = " + ry.toFixed(2);
        } else {
          //user face in facing front side of webcam
          faceangle.value =
            "user is facing straight, face angle = " + ry.toFixed(2);
        }

        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
      }
    }, 500);
    setDetecting(interval);
  };
  return (
    <div>
      <button onClick={getVideo.bind(this)}>Start</button>
      <button onClick={stopVideo.bind(this)}>Stop</button>
      <div id="playground">
        <video ref={videoRef} autoPlay={true} id="videoplay" />
        <canvas ref={canvasRef} id="overlay" />
      </div>
      <div id="fps_meter">
        <div>
          <label>Time:</label>
          <input disabled ref={timeRef} value="-" id="time" type="text" />
          <label>Estimated Fps:</label>
          <input disabled ref={fpsRef} value="-" id="fps" type="text" />
        </div>
        <div>
          <label>Estimated Face Pose: </label>
          <textarea
            disabled
            ref={faceangleRef}
            value="-"
          />
        </div>
      </div>
    </div>
  );
}

export default Camera;
