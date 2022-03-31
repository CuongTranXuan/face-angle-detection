import { useEffect, useRef, useState } from "react";
var Module = {};
function Blazeface() {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // const fpsRef = useRef(null);
    const btnRef = useRef(null);

   

    let has_simd;
    let has_threads;

    let wasmModuleLoaded = false;
    let wasmModuleLoadedCallbacks = [];

    let dst = null;
    let resultarray = null;
    let resultbuffer = null;

    let class_names = [
        "person",
        "bicycle",
        "car",
        "motorcycle",
        "airplane",
        "bus",
        "train",
        "truck",
        "boat",
        "traffic light",
        "fire hydrant",
        "stop sign",
        "parking meter",
        "bench",
        "bird",
        "cat",
        "dog",
        "horse",
        "sheep",
        "cow",
        "elephant",
        "bear",
        "zebra",
        "giraffe",
        "backpack",
        "umbrella",
        "handbag",
        "tie",
        "suitcase",
        "frisbee",
        "skis",
        "snowboard",
        "sports ball",
        "kite",
        "baseball bat",
        "baseball glove",
        "skateboard",
        "surfboard",
        "tennis racket",
        "bottle",
        "wine glass",
        "cup",
        "fork",
        "knife",
        "spoon",
        "bowl",
        "banana",
        "apple",
        "sandwich",
        "orange",
        "broccoli",
        "carrot",
        "hot dog",
        "pizza",
        "donut",
        "cake",
        "chair",
        "couch",
        "potted plant",
        "bed",
        "dining table",
        "toilet",
        "tv",
        "laptop",
        "mouse",
        "remote",
        "keyboard",
        "cell phone",
        "microwave",
        "oven",
        "toaster",
        "sink",
        "refrigerator",
        "book",
        "clock",
        "vase",
        "scissors",
        "teddy bear",
        "hair drier",
        "toothbrush",
    ];

    let colors = [
        "rgb( 54,  67, 244)",
        "rgb( 99,  30, 233)",
        "rgb(176,  39, 156)",
        "rgb(183,  58, 103)",
        "rgb(181,  81,  63)",
        "rgb(243, 150,  33)",
        "rgb(244, 169,   3)",
        "rgb(212, 188,   0)",
        "rgb(136, 150,   0)",
        "rgb( 80, 175,  76)",
        "rgb( 74, 195, 139)",
        "rgb( 57, 220, 205)",
        "rgb( 59, 235, 255)",
        "rgb(  7, 193, 255)",
        "rgb(  0, 152, 255)",
        "rgb( 34,  87, 255)",
        "rgb( 72,  85, 121)",
        "rgb(158, 158, 158)",
        "rgb(139, 125,  96)",
    ];

    useEffect(() => {
        const script = document.createElement("script");
        script.src = "/wasmFeatureDetect.js";
        script.async = true;
        console.log("debug")
        script.onload = () => onWasmReady();
        document.body.appendChild(script);
        // return () => {
        //     document.body.removeChild(script);
        // };
    }, []);
    const onWasmReady = () => {
        let blazeface_module_name = "";
        const wasmFeatureDetect = window.wasmFeatureDetect;
        console.log("wasm module is loaded");
        Module.onRuntimeInitialized = function () {
            wasmModuleLoaded = true;
            for (let i = 0; i < wasmModuleLoadedCallbacks.length; i++) {
                wasmModuleLoadedCallbacks[i]();
            }
        };

        wasmFeatureDetect.simd().then((simdSupported) => {
            has_simd = simdSupported;
            console.log(has_simd);
            wasmFeatureDetect.threads().then((threadsSupported) => {
                has_threads = threadsSupported;

                if (has_simd) {
                    if (has_threads) {
                        blazeface_module_name = "blazeface-simd-threads";
                    } else {
                        blazeface_module_name = "blazeface-simd";
                    }
                } else {
                    if (has_threads) {
                        blazeface_module_name = "blazeface-threads";
                    } else {
                        blazeface_module_name = "blazeface-basic";
                    }
                }
                console.log("load " + blazeface_module_name);

                let blazefacewasm = "/ncnn/" + blazeface_module_name + ".wasm";
                let blazefacejs = "/ncnn/" + blazeface_module_name + ".js";

                fetch(blazefacewasm)
                    .then((response) => response.arrayBuffer())
                    .then((buffer) => {
                        Module.wasmBinary = buffer;
                        let script = document.createElement("script");
                        script.src = blazefacejs;
                        script.onload = function () {
                            console.log("Emscripten boilerplate loaded.");
                        };
                        document.body.appendChild(script);
                    });
            });
        });
    };

    const startVideo = () => {
        const constraints = (window.constraints = {
            audio: false,
            video: { width: 640, height: 480 },
        });
        let video = videoRef.current;
        let canvas = canvasRef.current;
        let ctx = canvas.getContext("2d");
        navigator.mediaDevices
            .getUserMedia(constraints)
            .then((stream) => {
                video.srcObject = stream;
                video.play();
            })
            .catch((err) => {
                console.error("error:", err);
            });
        // Wait until the video stream canvas play
        // video.addEventListener(
        //     "canplay",
        //     function (e) {
        //         if (!isStreaming) {
        //             // videoWidth isn't always set correctly in all browsers
        //             // if (video.videoWidth > 0)
        //             //     h = video.videoHeight / (video.videoWidth / w);
        //             canvas.setAttribute("width", 480);
        //             canvas.setAttribute("height", 640);
        //             isStreaming = true;
        //         }
        //     },
        //     false
        // );

        // Wait for the video to start to play
        video.addEventListener("play", function () {
            //Setup image memory
            let id = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let d = id.data;
            console.log(d);
            console.log( Module._malloc() );
            const mallocAndCallSFilter = () => {
                dst = Module._malloc(d.length);

                // max 20 objects
                resultarray = new Float32Array(16 * 20);
                resultbuffer = window.Module._malloc(
                    16 * 20 * Float32Array.BYTES_PER_ELEMENT
                );

                Module.HEAPF32.set(
                    resultarray,
                    resultbuffer / Float32Array.BYTES_PER_ELEMENT
                );

                console.log("What " + d.length);

                sFilter();
            }
            if (wasmModuleLoaded) {
                mallocAndCallSFilter();
            } else {
                mallocAndCallSFilter();
            }

            
        });
    };
    function ncnn_blazeface() {
        let video = videoRef.current;
        let canvas = canvasRef.current;
        let ctx = canvas.getContext("2d");

        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = imageData.data;
        Module.HEAPU8.set(data, dst);

        // let t0 = performance.now();
        Module._blazeface_ncnn(dst, canvas.width, canvas.height, resultbuffer);
        // let t1 = performance.now();
        // console.log("blazeface_ncnn " + (t1 - t0) + " milliseconds.")
        // let fps_counter = document.getElementById("fps");
        // fps_counter.innerText = (1000 / (t1 - t0)).toFixed(2).toString();
        let face_angle = document.getElementById("angle");
        let face_status = document.getElementById("status");
        face_angle.innerText = 10;
        // resultarray
        let qaqarray = Module.HEAPF32.subarray(
            resultbuffer / Float32Array.BYTES_PER_ELEMENT,
            resultbuffer / Float32Array.BYTES_PER_ELEMENT + 16 * 20
        );

        let i;
        for (i = 0; i < 20; i++) {
            let label = qaqarray[i * 16 + 0];
            let prob = qaqarray[i * 16 + 1];
            let bbox_x = qaqarray[i * 16 + 2];
            let bbox_y = qaqarray[i * 16 + 3];
            let bbox_w = qaqarray[i * 16 + 4];
            let bbox_h = qaqarray[i * 16 + 5];
            let p1_x = qaqarray[i * 16 + 6];
            let p1_y = qaqarray[i * 16 + 7];
            let p2_x = qaqarray[i * 16 + 8];
            let p2_y = qaqarray[i * 16 + 9];
            let p3_x = qaqarray[i * 16 + 10];
            let p3_y = qaqarray[i * 16 + 11];
            let p4_x = qaqarray[i * 16 + 12];
            let p4_y = qaqarray[i * 16 + 13];
            let p5_x = qaqarray[i * 16 + 14];
            let p5_y = qaqarray[i * 16 + 15];

            if (label == -233) continue;

            // console.log('qaq ' + label + ' = ' + prob);

            ctx.strokeStyle = colors[i % 19];
            ctx.strokeRect(bbox_x, bbox_y, bbox_w, bbox_h);

            ctx.fillStyle = "rgb(255,0,255)";
            ctx.fillRect(p1_x, p1_y, 5, 5); // right eye
            ctx.fillRect(p2_x, p2_y, 5, 5); // left eye
            ctx.fillRect(p3_x, p3_y, 5, 5); // nose
            ctx.fillRect(p4_x, p4_y, 5, 5); // right mouth
            ctx.fillRect(p5_x, p5_y, 5, 5); // left mouth
            let face_val = (p2_x + (p1_x - p2_x) / 2 - p3_x) / bbox_w;
            face_angle.innerText = face_val;
            if (face_val < -0.06) {
                //user moving in left direction
                face_status.innerText = "user is facing left side";
            } else if (face_val >= 0.07) {
                //user moving in right direction
                face_status.innerText = "user is facing right side ";
            } else {
                //user face in facing front side of webcam
                face_status.innerText = "user is facing straight ";
            }
            let text =
                class_names[label] +
                " = " +
                parseFloat(prob * 100).toFixed(2) +
                "%";

            ctx.textBaseline = "top";
            let text_width = ctx.measureText(text).width;
            let text_height = parseInt(ctx.font, 10);

            let x = bbox_x;
            let y = bbox_y - text_height;
            if (y < 0) y = 0;
            if (x + text_width > canvas.width) x = canvas.width - text_width;

            ctx.fillStyle = "rgb(255,255,255)";
            ctx.fillRect(x, y, text_width, text_height);
            ctx.font = "20pt Arial";
            ctx.fillStyle = "rgb(0,0,0)";
            ctx.fillText(text, x, y);
        }
    }

    //Request Animation Frame function
    const sFilter = () => {
        let video = videoRef.current;
        let canvas = canvasRef.current;
        let ctx = canvas.getContext("2d");

        ctx.fillRect(0, 0, 480,640);
        ctx.drawImage(video, 0, 0, 480, 640);

        ncnn_blazeface();

        window.requestAnimationFrame(sFilter);
    };
    const stopVideo = () => {
        let video = videoRef.current;
        let tracks = video.srcObject.getTracks();
        tracks.forEach((track) => {
            track.stop();
        });
        const canvas = canvasRef.current;
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    };
    return (
        <div>
            <div>
                <div>
                    <h1>ncnn webassembly blazeface</h1>
                </div>
            </div>
            <div>
                <canvas id="canvas" width="640" ref={canvasRef}></canvas>
                <video id="video" ref={videoRef}></video>
            </div>
            <div>
                <button ref={btnRef} onClick={startVideo.bind(this)}>
                    Start
                </button>
                <p>
                    FPS: <span id="fps">0</span>
                </p>
                <p>
                    Face angle: <span id="angle">0</span>
                </p>
                <p>
                    Face status: <span id="status">0</span>
                </p>
            </div>
        </div>
    );
}

export default Blazeface;
