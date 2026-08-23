import React from 'react';

function DetectorCard({ detector, active, onSelect }) {
  return (
    <button
      className={`detector-card${active ? ' detector-card--active' : ''}`}
      type="button"
      onClick={() => onSelect(detector.id)}
      aria-pressed={active}
      style={{ '--card-accent': detector.accent }}
    >
      <span className="detector-card__topline">
        <span className="detector-card__index">{detector.index}</span>
        <span className="detector-card__state">{active ? 'Selected' : detector.tag}</span>
      </span>
      <span className="detector-card__title">{detector.label}</span>
      <span className="detector-card__description">{detector.description}</span>
      <span className="detector-card__footer">
        <span>{detector.eyebrow}</span>
        <span aria-hidden="true">↗</span>
      </span>
    </button>
  );
}

export default DetectorCard;
