// src/components/Crosshair.tsx
import React from 'react';

interface CrosshairProps {
  color?: string;
  size?: number;
  thickness?: number;
  gap?: number;
}

export const Crosshair: React.FC<CrosshairProps> = ({
  color = 'white',
  size = 10,
  thickness = 2,
  gap = 5
}) => {
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
    backgroundColor: color
  };

  return (
    <div style={style}>
      {/* Center dot */}
      <div
        style={{
          ...lineStyle,
          width: `${thickness}px`,
          height: `${thickness}px`,
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      />
      
      {/* Top line */}
      <div
        style={{
          ...lineStyle,
          width: `${thickness}px`,
          height: `${size}px`,
          left: '50%',
          bottom: `${gap}px`,
          transform: 'translateX(-50%)'
        }}
      />
      
      {/* Bottom line */}
      <div
        style={{
          ...lineStyle,
          width: `${thickness}px`,
          height: `${size}px`,
          left: '50%',
          top: `${gap}px`,
          transform: 'translateX(-50%)'
        }}
      />
      
      {/* Left line */}
      <div
        style={{
          ...lineStyle,
          width: `${size}px`,
          height: `${thickness}px`,
          top: '50%',
          right: `${gap}px`,
          transform: 'translateY(-50%)'
        }}
      />
      
      {/* Right line */}
      <div
        style={{
          ...lineStyle,
          width: `${size}px`,
          height: `${thickness}px`,
          top: '50%',
          left: `${gap}px`,
          transform: 'translateY(-50%)'
        }}
      />
    </div>
  );
};