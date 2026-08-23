# Face / Angle — Browser Vision Lab

A browser-based face-angle detection playground that puts three local inference methods on one screen. Choose a detector, allow camera access, and compare its live status, frame rate, and face-angle signal without sending frames to a server.

## Detection methods

| Method | Runtime | Signal | Best for |
| --- | --- | --- | --- |
| Face API | SSD MobileNet + tiny landmarks | Landmark-based angle proxy | Pose-aware experiments |
| Haar cascade | OpenCV.js | Frontal-face detection | Lightweight classic CV |
| BlazeFace | NCNN WebAssembly | Bounding box, keypoints, and angle proxy | Fast native-compiled inference |

Only the selected detector is mounted and allowed to use the camera. Switching methods stops the previous stream and releases its animation loop or timer before the next detector starts.

## Run locally

```bash
npm ci
npm start
```

Open the local development URL shown by Create React App, then allow camera access when prompted. The demo requires a secure origin in production; `localhost` is allowed for local development.

To create a production bundle locally:

```bash
npm run build
```

The build script includes the OpenSSL compatibility flag required by the repository’s Create React App 4 toolchain when running on modern Node.js versions.

## GitHub Pages

Every push to `main` runs [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml). The workflow builds the app with `PUBLIC_URL=/<repository-name>`, copies the entry document to `404.html` for Pages fallback behavior, and publishes the generated `build/` directory through GitHub Pages.

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. After the first successful workflow run, the demo is available at:

```text
https://<github-owner>.github.io/<repository-name>/
```

The camera and detector runtimes execute in the visitor’s browser. No captured frames are uploaded by this project.
