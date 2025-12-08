import './CrosshairSettingsPanel.css';
import React from 'react';
import { Crosshair } from './Crosshair';
import {
  useCrosshairSettings,
  CROSSHAIR_GAP_RANGE,
  CROSSHAIR_SIZE_RANGE,
  CROSSHAIR_THICKNESS_RANGE,
  DEFAULT_CROSSHAIR_SETTINGS,
} from '../state/crosshairSettingsContext';

const CrosshairSettingsPanel: React.FC = () => {
  const {
    color,
    size,
    thickness,
    gap,
    setCrosshairColor,
    setCrosshairSize,
    setCrosshairThickness,
    setCrosshairGap,
    resetCrosshairSettings,
  } = useCrosshairSettings();

  const handleColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCrosshairColor(event.target.value);
  };

  const handleReset = () => resetCrosshairSettings();

  return (
    <div className="crosshair-settings">
      <div className="crosshair-settings__preview">
        <div className="crosshair-settings__stage" aria-label="Crosshair preview">
          <Crosshair />
        </div>
        <div className="crosshair-settings__meta">
          <span className="crosshair-settings__chip" style={{ backgroundColor: color }} />
          <span className="crosshair-settings__meta-text">
            {color.toUpperCase()} • Size {size}px • Thickness {thickness}px • Gap {gap}px
          </span>
          {color !== DEFAULT_CROSSHAIR_SETTINGS.color && (
            <span className="crosshair-settings__pill">Custom color</span>
          )}
        </div>
      </div>

      <div className="crosshair-settings__grid">
        <label className="crosshair-settings__control">
          <div className="crosshair-settings__label">
            <span>Color</span>
            <span className="crosshair-settings__value">{color.toUpperCase()}</span>
          </div>
          <div className="crosshair-settings__color-input">
            <input
              type="color"
              value={color}
              onChange={handleColorChange}
              aria-label="Crosshair color"
            />
            <input
              type="text"
              value={color.toUpperCase()}
              readOnly
              aria-label="Hex color value"
            />
          </div>
        </label>

        <label className="crosshair-settings__control">
          <div className="crosshair-settings__label">
            <span>Size</span>
            <span className="crosshair-settings__value">{size}px</span>
          </div>
          <input
            type="range"
            min={CROSSHAIR_SIZE_RANGE.min}
            max={CROSSHAIR_SIZE_RANGE.max}
            value={size}
            onChange={(event) => setCrosshairSize(Number(event.target.value))}
            aria-label="Crosshair size"
          />
        </label>

        <label className="crosshair-settings__control">
          <div className="crosshair-settings__label">
            <span>Thickness</span>
            <span className="crosshair-settings__value">{thickness}px</span>
          </div>
          <input
            type="range"
            min={CROSSHAIR_THICKNESS_RANGE.min}
            max={CROSSHAIR_THICKNESS_RANGE.max}
            value={thickness}
            onChange={(event) => setCrosshairThickness(Number(event.target.value))}
            aria-label="Crosshair thickness"
          />
        </label>

        <label className="crosshair-settings__control">
          <div className="crosshair-settings__label">
            <span>Gap</span>
            <span className="crosshair-settings__value">{gap}px</span>
          </div>
          <input
            type="range"
            min={CROSSHAIR_GAP_RANGE.min}
            max={CROSSHAIR_GAP_RANGE.max}
            value={gap}
            onChange={(event) => setCrosshairGap(Number(event.target.value))}
            aria-label="Crosshair gap"
          />
        </label>
      </div>

      <div className="crosshair-settings__actions">
        <button type="button" className="crosshair-settings__reset" onClick={handleReset}>
          Reset to default
        </button>
      </div>
    </div>
  );
};

export default CrosshairSettingsPanel;
