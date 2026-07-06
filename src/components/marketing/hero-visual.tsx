"use client";

import { Environment, Float } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh } from "three";

function DocumentStack() {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const { pointer } = useThree();

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.y += delta * 0.18;
    groupRef.current.rotation.x +=
      (pointer.y * 0.18 - groupRef.current.rotation.x) * 0.045;
    groupRef.current.rotation.z +=
      (-pointer.x * 0.12 - groupRef.current.rotation.z) * 0.04;

    if (coreRef.current) {
      coreRef.current.rotation.x -= delta * 0.22;
      coreRef.current.rotation.z += delta * 0.16;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.24} floatIntensity={0.55}>
      <group ref={groupRef}>
        {[-0.56, -0.28, 0, 0.28, 0.56].map((offset, index) => (
          <mesh
            key={offset}
            position={[offset * 0.42, offset * 0.16, offset]}
            rotation={[0.18 + index * 0.035, -0.34 + index * 0.04, 0.1]}
          >
            <boxGeometry args={[2.5, 0.035, 1.62]} />
            <meshPhysicalMaterial
              color={index === 2 ? "#34f5d6" : "#d8fff7"}
              roughness={0.18}
              metalness={0.02}
              transmission={0.62}
              transparent
              opacity={0.24}
              thickness={0.6}
            />
          </mesh>
        ))}

        <mesh ref={coreRef} position={[0, 0.06, 0]} rotation={[0.4, 0.2, 0.1]}>
          <icosahedronGeometry args={[0.58, 1]} />
          <meshStandardMaterial
            color="#22f2d2"
            emissive="#0b6c60"
            emissiveIntensity={0.35}
            metalness={0.35}
            roughness={0.24}
            wireframe
          />
        </mesh>
      </group>
    </Float>
  );
}

export default function HeroVisual() {
  return (
    <Canvas
      camera={{ position: [0, 0.2, 5.2], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 3]} intensity={1.25} />
      <pointLight position={[-3, -1, 2]} color="#22f2d2" intensity={0.85} />
      <DocumentStack />
      <Environment preset="city" />
    </Canvas>
  );
}
