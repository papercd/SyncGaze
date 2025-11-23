// src/components/Environment.tsx
import * as THREE from 'three';

export const Environment: React.FC = () => {
  return (
    <>
            // Wider room example
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#2c3e50" />
      </mesh>

      <gridHelper args={[20, 20, '#34495e', '#7f8c8d']} position={[0, 0.01, 0]} />

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 10, 0]}>
        <planeGeometry args={[20, 10]} />
        <meshStandardMaterial color="#34495e" />
      </mesh>

      {/* Front wall */}
      <mesh position={[0, 5, -5]}>
        <planeGeometry args={[20, 10]} />
        <meshStandardMaterial color="#7f8c8d" />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 5, 5]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[20, 10]} />
        <meshStandardMaterial color="#7f8c8d" />
      </mesh>

      {/* Left wall */}
      <mesh position={[-10, 5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#95a5a6" />
      </mesh>

      {/* Right wall */}
      <mesh position={[10, 5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#95a5a6" />
      </mesh>
      {/* Lighting setup */}
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 9, 0]} intensity={0.8} castShadow />
      <pointLight position={[-3, 7, 3]} intensity={0.5} />
      <pointLight position={[3, 7, -3]} intensity={0.5} />
      
      {/* Directional light for better shadows */}
      <directionalLight
        position={[5, 5, 5]}
        intensity={0.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
    </>
  );
};