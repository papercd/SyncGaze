// src/components/Crosshair.tsx
import React from 'react';
import { useCrosshairSettings } from '../state/crosshairSettingsContext';

interface CrosshairProps {
  color?: string;
  size?: number;
  thickness?: number;
  gap?: number;
}

export const Crosshair: React.FC<CrosshairProps> = ({
  color,
  size,
  thickness,
  gap
}) => {
  const crosshairSettings = useCrosshairSettings();

  const finalColor = color ?? crosshairSettings.color;
  const finalSize = size ?? crosshairSettings.size;
  const finalThickness = thickness ?? crosshairSettings.thickness;
  const finalGap = gap ?? crosshairSettings.gap;

  const style = {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none' as const,
    zIndex: 10
  };

  const lineStyle = {
    position: 'absolute' as const,
    backgroundColor: finalColor
  };

  return (
    <div style={style}>
      {/* Center dot */}
      <div
        style={{
          ...lineStyle,
          width: `${finalThickness}px`,
          height: `${finalThickness}px`,
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      />
      
      {/* Top line */}
      <div
        style={{
          ...lineStyle,
          width: `${finalThickness}px`,
          height: `${finalSize}px`,
          left: '50%',
          bottom: `${finalGap}px`,
          transform: 'translateX(-50%)'
        }}
      />
      
      {/* Bottom line */}
      <div
        style={{
          ...lineStyle,
          width: `${finalThickness}px`,
          height: `${finalSize}px`,
          left: '50%',
          top: `${finalGap}px`,
          transform: 'translateX(-50%)'
        }}
      />
      
      {/* Left line */}
      <div
        style={{
          ...lineStyle,
          width: `${finalSize}px`,
          height: `${finalThickness}px`,
          top: '50%',
          right: `${finalGap}px`,
          transform: 'translateY(-50%)'
        }}
      />
      
      {/* Right line */}
      <div
        style={{
          ...lineStyle,
          width: `${finalSize}px`,
          height: `${finalThickness}px`,
          top: '50%',
          left: `${finalGap}px`,
          transform: 'translateY(-50%)'
        }}
      />
    </div>
  );
};
