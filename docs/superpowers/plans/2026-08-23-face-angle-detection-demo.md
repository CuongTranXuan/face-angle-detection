# Unified Face-Angle Detection Demo Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with a fresh verification checkpoint after each task.

**Goal:** Replace the route-only primitive demo with a polished single-screen dashboard that exposes all detection methods in the repository, runs one selected detector at a time on a shared camera surface, and deploys correctly through GitHub Pages.

**Architecture:** Keep the existing Create React App and detector implementations, but add a dashboard shell that owns the selected method, camera lifecycle, status copy, and presentation. The dashboard will render the existing detector components through a shared method registry, while each detector reports its runtime state through a small callback contract and cleans up its camera/animation resources on unmount. The deployment workflow will build with a repository-relative `PUBLIC_URL`, publish the generated `build/` directory to GitHub Pages, and avoid relying on the checked-in `docs/` artifact.

**Tech Stack:** React 17, Create React App 4, face-api.js, OpenCV.js, NCNN WebAssembly, CSS, GitHub Actions, GitHub Pages.

**Spec:** Confirmed in chat: one unified screen; one active detector at a time; available methods are face-api.js SSD + landmarks, OpenCV Haar cascade, and NCNN/BlazeFace WebAssembly; preserve author identity `cuongtranxuan.pfiev@gmail.com`.

## Global Constraints

- Preserve the existing detector libraries and model assets unless a change is required to make the unified demo work.
- Keep camera access user-initiated and stop tracks/animation loops when switching detectors or leaving the page.
- Use repository-relative paths for deployed assets so GitHub Pages project hosting works.
- Do not change Git author identity; commits must continue to use `cuongtranxuan.pfiev@gmail.com`.
- Do not run three camera/inference loops concurrently.

---

### Task 1: Create a detector contract and unified dashboard shell

**Files:**
- Modify: `src/App.js`
- Modify: `src/App.css`
- Modify: `src/index.css`
- Create: `src/components/DemoDashboard.js`
- Create: `src/components/DemoDashboard.css`
- Create: `src/components/DetectorCard.js`

**Interfaces:**
- `DemoDashboard` owns `activeMethod`, `isRunning`, and the active detector metadata.
- Detector entries use `{ id, label, eyebrow, description, accent, component }`.
- Detector components receive `onStateChange({ status, statusTone, fps, angle, detail })` and `onReady()` callbacks, and they must render their camera surface inside the dashboard’s `.detector-stage` region.
- The dashboard exposes a single primary action, detector selector cards, status metrics, a capability note, and a deployment-safe root route.

- [ ] **Step 1: Add the method registry and dashboard route.**

  Replace the route-only `App` implementation with a root route that renders `DemoDashboard`, registering the three existing methods as `face-api`, `haar`, and `blazeface`. Retain direct `/haar` and `/blaze` routes only as compatibility aliases if they do not duplicate camera state.

- [ ] **Step 2: Add the dashboard structure.**

  Build a responsive layout with a compact product header, intro copy, detector cards, a large camera stage, live metric tiles for status/FPS/angle, and a short “how it works” footer. Selecting a card changes `activeMethod`; the active detector is mounted only after the previous one is unmounted.

- [ ] **Step 3: Replace default CRA styling with a coherent visual system.**

  Use dark navy surfaces, warm off-white typography, electric violet/cyan accents, soft borders, subtle grid/noise effects, and responsive breakpoints. Keep controls keyboard-focusable and provide visible selected/active states.

- [ ] **Step 4: Add the reusable detector card.**

  Make `DetectorCard` render method name, short description, capability tag, active state, and a selector button. Use `button` semantics rather than clickable generic containers.

- [ ] **Step 5: Run the app build after the shell-only change.**

  Run `npm run build` from the repository root. Expected result: CRA produces a valid build without missing imports; detector runtime behavior is unchanged at this checkpoint.

### Task 2: Adapt each detector to the shared dashboard contract

**Files:**
- Modify: `src/components/Camera.js`
- Modify: `src/components/Camera.css`
- Modify: `src/components/Haar.js`
- Modify: `src/components/Haar.css`
- Modify: `src/components/Blazeface.js`
- Modify: `src/components/Blazeface.css`

**Interfaces:**
- Each detector accepts `onStateChange` and `onReady` props.
- Each detector reports at least `status`, `statusTone`, `fps`, and `angle` when available.
- Each detector calls cleanup on unmount: stop all active media tracks, clear intervals/timeouts, cancel animation frames, and release WebAssembly/OpenCV resources where the current implementation owns them.

- [ ] **Step 1: Refactor the face-api detector lifecycle.**

  Convert mutable DOM output fields into React state/callback updates, start the stream only from the dashboard’s detector action, and stop tracks plus the detection interval on unmount. Preserve SSD MobileNet face detection and landmark-based angle classification.

- [ ] **Step 2: Refactor the Haar detector lifecycle.**

  Replace global `document.getElementById` output writes with callback updates, make OpenCV script/model loading deployment-safe through a path helper, avoid starting inference before the classifier is loaded, and clean the processing timer and stream on unmount.

- [ ] **Step 3: Refactor the NCNN/BlazeFace detector lifecycle.**

  Preserve the SIMD/thread feature selection and NCNN WebAssembly assets, but add guarded loading/error states, prevent duplicate script injection, keep a cancelable animation-frame id, stop media tracks, and report calculated angle/direction through the shared callback.

- [ ] **Step 4: Align detector presentation styles.**

  Remove each detector’s standalone page framing and style only its video/canvas surface, loading overlay, and method-specific helper text so the dashboard remains the single source of visual hierarchy.

- [ ] **Step 5: Run tests and build.**

  Run `npm test -- --watchAll=false` and `npm run build`. Expected result: the existing test suite completes and the production bundle compiles.

### Task 3: Make GitHub Pages serving reliable

**Files:**
- Create: `.github/workflows/deploy-pages.yml`
- Modify: `package.json`
- Modify: `public/index.html`
- Modify: `README.md`
- Create: `public/404.html`

**Interfaces:**
- Workflow triggers on pushes to `main` and supports manual dispatch.
- Build receives `PUBLIC_URL=/${repository-name}` through the workflow environment, with `repository-name` derived from `${{ github.event.repository.name }}`.
- Pages deployment publishes `build/` using the official Pages artifact/deploy actions.
- The app uses `process.env.PUBLIC_URL` for static asset URLs and a root dashboard route that does not require client-side navigation for the primary flow.

- [ ] **Step 1: Add the Pages workflow.**

  Configure checkout, Node setup, `npm ci`, `npm run build`, upload of `build/` as the Pages artifact, and deployment to the `github-pages` environment. Grant `contents: read`, `pages: write`, and `id-token: write` permissions.

- [ ] **Step 2: Add a repository-relative asset helper.**

  Use `process.env.PUBLIC_URL || ''` when loading OpenCV, WASM feature detection, detector modules, and model files. Ensure generated URLs do not contain a doubled slash.

- [ ] **Step 3: Add SPA fallback and update project instructions.**

  Copy the built entry fallback into `public/404.html` through the build workflow or provide a static fallback compatible with the root dashboard. Update the README with local start/build commands, the supported detector list, camera permission requirements, and the Pages deployment behavior.

- [ ] **Step 4: Validate the Pages build locally.**

  Run `PUBLIC_URL=/face-angle-detection npm run build`, inspect `build/index.html` and `build/asset-manifest.json`, and confirm emitted references begin with `/face-angle-detection/` rather than `/`.

### Task 4: Verify integration and preserve author metadata

**Files:**
- Modify: repository files from Tasks 1–3 only.
- Test: generated production bundle and source-level checks.

- [ ] **Step 1: Run the full validation commands.**

  Run `npm test -- --watchAll=false`, `npm run build`, and `PUBLIC_URL=/face-angle-detection npm run build`. Check that all commands exit successfully.

- [ ] **Step 2: Inspect the final diff.**

  Run `git diff --check`, inspect `git status --short`, and search for root-absolute detector asset paths such as `src="/opencv.js"`, `fetch("/ncnn/`, and `load("/models"` in source files. Replace any remaining deployment-breaking paths.

- [ ] **Step 3: Verify author identity before committing.**

  Run `git config user.email` and, if necessary, set only the local repository value to `cuongtranxuan.pfiev@gmail.com`; do not alter global configuration. Commit the completed changes with a focused message.

- [ ] **Step 4: Report the changed files and checks.**

  Summarize the unified dashboard behavior, detector coverage, Pages workflow, and exact validation results. Mention any browser-only limitation that cannot be exercised in the sandbox, especially live camera permission and WebAssembly runtime behavior.
