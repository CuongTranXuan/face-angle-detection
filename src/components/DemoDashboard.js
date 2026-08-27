import React, { useMemo, useState } from 'react';
import Camera from './Camera';
import Haar from './Haar';
import Blazeface from './Blazeface';
import DetectorCard from './DetectorCard';
import './DemoDashboard.css';

const detectors = [
  {
    id: 'face-api',
    index: '01',
    label: 'Face API',
    eyebrow: 'SSD + landmarks',
    tag: 'Landmarks',
    description: 'A landmark-aware detector that estimates pose from eye and nose geometry.',
    accent: '#155eef',
    component: Camera,
  },
  {
    id: 'haar',
    index: '02',
    label: 'Haar cascade',
    eyebrow: 'OpenCV.js',
    tag: 'Classic CV',
    description: 'A compact OpenCV pipeline for fast frontal-face detection in the browser.',
    accent: '#00a878',
    component: Haar,
  },
  {
    id: 'blazeface',
    index: '03',
    label: 'BlazeFace',
    eyebrow: 'NCNN + WebAssembly',
    tag: 'WASM',
    description: 'A native-compiled detector with keypoints for a lightweight angle proxy.',
    accent: '#ff8a00',
    component: Blazeface,
  },
];

const defaultTelemetry = {
  status: 'Ready to start',
  statusTone: 'neutral',
  fps: '--',
  angle: '--',
  detail: 'Choose a method, then allow camera access to begin.',
};

function DemoDashboard() {
  const [activeMethod, setActiveMethod] = useState(detectors[0].id);
  const [running, setRunning] = useState(false);
  const [telemetry, setTelemetry] = useState(defaultTelemetry);

  const activeDetector = useMemo(
    () => detectors.find((detector) => detector.id === activeMethod) || detectors[0],
    [activeMethod]
  );
  const ActiveDetector = activeDetector.component;

  const selectDetector = (methodId) => {
    if (methodId === activeMethod) return;
    setRunning(false);
    setActiveMethod(methodId);
    setTelemetry({
      ...defaultTelemetry,
      detail: 'The selected detector is ready when you are.',
    });
  };

  const updateTelemetry = (nextTelemetry) => {
    setTelemetry((current) => ({ ...current, ...nextTelemetry }));
  };

  const toggleDetector = () => {
    setRunning((current) => !current);
    setTelemetry((current) => ({
      ...current,
      status: running ? 'Paused' : 'Starting…',
      statusTone: running ? 'neutral' : 'loading',
      detail: running ? 'Camera stream paused.' : 'Requesting camera access and warming the model.',
    }));
  };

  return (
    <main className="dashboard-shell">
      <div className="dashboard-glow dashboard-glow--one" />
      <div className="dashboard-glow dashboard-glow--two" />

      <header className="dashboard-header page-width">
        <a className="brand-mark" href="./" aria-label="Face angle detection home">
          <span className="brand-mark__glyph" aria-hidden="true">◎</span>
          <span>
            <strong>FACE / ANGLE</strong>
            <small>browser vision lab</small>
          </span>
        </a>
        <div className="header-meta">
          <span className="header-meta__dot" />
          <span>Web camera playground</span>
        </div>
      </header>

      <section className="hero page-width">
        <div className="hero__copy">
          <p className="eyebrow">Face angle // signal arcade</p>
          <h1>Pick a lane.<br /><em>Read the angle.</em></h1>
          <p className="hero__lede">
            Three local vision engines. One camera feed. Pick a lane, press start, and watch the face signal resolve in real time.
          </p>
        </div>
        <div className="hero__stamp" aria-label="Three detection methods available">
          <span className="hero__stamp-number">03</span>
          <span className="hero__stamp-label">vision<br />lanes</span>
        </div>
      </section>

      <section className="method-grid page-width" aria-label="Detection methods">
        {detectors.map((detector) => (
          <DetectorCard
            key={detector.id}
            detector={detector}
            active={detector.id === activeMethod}
            onSelect={selectDetector}
          />
        ))}
      </section>

      <section className="workspace page-width">
        <div className="workspace__bar">
          <div>
            <p className="eyebrow">Live workspace</p>
            <h2>{activeDetector.label}<span> / {activeDetector.eyebrow}</span></h2>
          </div>
          <div className="workspace__controls">
            <span className={`status-pill status-pill--${telemetry.statusTone}`}>
              <span className="status-pill__dot" />
              {telemetry.status}
            </span>
            <button className="primary-button" type="button" onClick={toggleDetector}>
              <span className="primary-button__icon">{running ? '■' : '▶'}</span>
              {running ? 'Stop detector' : 'Start detector'}
            </button>
          </div>
        </div>

        <div className="workspace__body">
          <div className="detector-stage" style={{ '--stage-accent': activeDetector.accent }}>
            <div className="detector-stage__corner detector-stage__corner--tl" />
            <div className="detector-stage__corner detector-stage__corner--tr" />
            <div className="detector-stage__corner detector-stage__corner--bl" />
            <div className="detector-stage__corner detector-stage__corner--br" />
            <ActiveDetector isActive={running} onStateChange={updateTelemetry} />
          </div>

          <aside className="telemetry-panel" aria-label="Live detector telemetry">
            <div className="telemetry-panel__intro">
              <span className="telemetry-panel__label">Signal monitor</span>
              <span className="telemetry-panel__method">{activeDetector.id}</span>
            </div>
            <div className="telemetry-metric telemetry-metric--large">
              <span className="telemetry-metric__label">Detected state</span>
              <strong>{telemetry.detail}</strong>
            </div>
            <div className="telemetry-metric-grid">
              <div className="telemetry-metric">
                <span className="telemetry-metric__label">Frame rate</span>
                <strong>{telemetry.fps}<small>{telemetry.fps === '--' ? '' : ' fps'}</small></strong>
              </div>
              <div className="telemetry-metric">
                <span className="telemetry-metric__label">Angle proxy</span>
                <strong>{telemetry.angle}</strong>
              </div>
            </div>
            <div className="telemetry-note">
              <span className="telemetry-note__icon">✦</span>
              <p>Keep your face inside the frame. The selected detector owns the camera until you stop or switch methods.</p>
            </div>
          </aside>
        </div>
      </section>

      <footer className="dashboard-footer page-width">
        <span>LOCAL INFERENCE // NO FRAMES UPLOADED</span>
        <span>FACE / ANGLE // INSERT COIN <b>↗</b></span>
      </footer>
    </main>
  );
}

export default DemoDashboard;
