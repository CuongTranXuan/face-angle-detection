import React from "react";

class Haar extends React.Component {
    constructor(props) {
        super(props);
        this.btnRef = React.createRef();
        this.videoRef = React.createRef();
        this.canvasRef = React.createRef();
        this.fpsRef = React.createRef();
    }
    componentDidMount() {
        const script = document.createElement("script");
        script.src = "/opencv.js";
        script.async = true;
        script.onload = () => this.onOpenCvReady();
        document.body.appendChild(script);
    }
    componentWillUnmount() {
        let scriptToremove = "/opencv.js";
        let allsuspects = document.getElementsByTagName("script");
        for (let i = allsuspects.length; i >= 0; i--) {
            if (
                allsuspects[i] &&
                allsuspects[i].getAttribute("src") !== null &&
                allsuspects[i]
                    .getAttribute("src")
                    .indexOf(`${scriptToremove}`) !== -1
            ) {
                allsuspects[i].parentNode.removeChild(allsuspects[i]);
            }
        }
    }
    createFileFromUrl(path, url, callback) {
        let request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.responseType = "arraybuffer";
        request.onload = function (ev) {
            if (request.readyState === 4) {
                if (request.status === 200) {
                    let data = new Uint8Array(request.response);
                    window.cv.FS_createDataFile(
                        "/",
                        path,
                        data,
                        true,
                        false,
                        false
                    );
                    callback();
                } else {
                    console.log(
                        "Failed to load " + url + " status: " + request.status
                    );
                }
            }
        };
        request.send();
    }
    onOpenCvReady() {
        const cv = window.cv;
        cv["onRuntimeInitialized"] = () => {
            console.log("OpenCV.js is ready!", cv);
            this.createFileFromUrl(
                "face.xml",
                "models/haarcascade_frontalface_default.xml",
                () => {
                    console.log("OK");
                }
            );
            // this.createFileFromUrl(
            //     "eye.xml",
            //     "models/haarcascade_eye.xml",
            //     () => {
            //         console.log("OK");
            //     }
            // );

            let video = this.videoRef.current;

            let src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
            let dst = new cv.Mat(video.height, video.width, cv.CV_8UC4);
            let gray = new cv.Mat();
            let cap = new cv.VideoCapture(video);
            let faces = new cv.RectVector();
            let eyes = new cv.RectVector();
            let classifier = new cv.CascadeClassifier();
            let eyeClassifier = new cv.CascadeClassifier();
            let streaming = false;
            const fps = document.getElementById("fps");
            const face_pose = document.getElementById("face-pose");
            const maxFPS = 30;
            const minDelay = 1000 / maxFPS;

            function processVideo() {
                try {
                    if (!streaming) {
                        return;
                    }
                    let begin = Date.now();
                    // start processing.
                    cap.read(dst);
                    // src.copyTo(dst);
                    cv.cvtColor(dst, gray, cv.COLOR_RGBA2GRAY, 0);
                    // detect faces.
                    classifier.detectMultiScale(gray, faces, 1.2, 3, 0, new cv.Size(70));
                    // draw faces.
                    let maxAreaFaceId = -1
                    let maxArea = 0
                    for (let i = 0; i < faces.size(); ++i) {
                        let face = faces.get(i);
                        let area = face.width * face.height
                        if (area > maxArea) {
                            maxArea = area
                            maxAreaFaceId = i
                        }
                    }
                    if (maxAreaFaceId != -1) {
                        let face = faces.get(maxAreaFaceId);
                        let point1 = new cv.Point(face.x, face.y);
                        let point2 = new cv.Point(face.x + face.width, face.y + face.height);
                        cv.rectangle(dst, point1, point2, [0, 255, 0, 255], 2);
                        let halfFace = {
                            x: face.x,
                            y: face.y,
                            width: face.width,
                            height: Math.round(face.height/2)
                        }
                        face_pose.innerText = "Straight, face angle not calculated ";
                        // let maxEyeWidth = Math.round(face.width/3)
                        // eyeClassifier.detectMultiScale(gray.roi(halfFace), eyes, 1.2, 5, 0, new cv.Size(30), new cv.Size(maxEyeWidth));

                        // for (let j = 0; j < eyes.size(); ++j) {
                        //     let point1 = new cv.Point(eyes.get(j).x, eyes.get(j).y);
                        //     let point2 = new cv.Point(eyes.get(j).x + eyes.get(j).width,
                        //                             eyes.get(j).y + eyes.get(j).height);
                        //     cv.rectangle(dst.roi(halfFace), point1, point2, [255, 255, 0, 255], 2);
                        // }
                    } else {
                        face_pose.innerText = "not detected"
                    }
                    cv.imshow('canvasOutput', dst);
                    // schedule the next one.
                    let dur = Date.now() - begin
                    let delay = minDelay - dur
                    // console.log(dur, 1000/dur)
                    fps.innerText = (1000 / Math.max(minDelay, dur)).toFixed(2).toString()
                    setTimeout(processVideo, delay);
                } catch (err) {
                    console.log(err)
                    // utils.printError(err);
                }
            };
            const btn = this.btnRef.current;
            btn.onclick = run

            function run() {
                streaming = !streaming
                if (streaming) {
                    navigator.mediaDevices.getUserMedia({ video: {width: 480, height: 480, facingMode: "user"}, audio: false })
                    .then(function(stream) {
                        video.srcObject = stream;
                        video.play();
                    })
                    .catch(function(err) {
                        console.log("An error occurred! " + err);
                    });
                    classifier.load("/face.xml")
                    eyeClassifier.load("/eye.xml")
                    processVideo()
                    btn.innerText = "Stop"
                } else {
                    btn.innerText = "Start"
                }
            }
            // schedule the first one.
            // setTimeout(processVideo, 0);
        };
    }
    render() {
        return (
            <div>
                <div>
                    <div>
                        <div>
                            <button id="start-or-stop" ref={this.btnRef}>
                                Start
                            </button>
                            <video
                                id="input-video"
                                width="480"
                                height="480"
                                hidden
                                ref={this.videoRef}
                            ></video>
                            <canvas
                                id="canvasOutput"
                                width="480"
                                height="480"
                                ref={this.canvasRef}
                            ></canvas>
                            <p>
                                FPS: <span id="fps">0</span>
                            </p>
                            <p>
                                Face pose: <span id="face-pose">no face</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default Haar;
