"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Float } from "@react-three/drei";
import ParticleField from "./ParticleField";
import HandModel from "./HandModel";

export default function HeroScene() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 55 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#0a0a18"]} />
        <fog attach="fog" args={["#0a0a18", 6, 18]} />

        {/* Ambient + point lights */}
        <ambientLight intensity={0.15} />
        <pointLight position={[3, 3, 5]} intensity={0.8} color="#8b5cf6" />
        <pointLight position={[-3, -2, 4]} intensity={0.5} color="#06b6d4" />
        <pointLight position={[0, 5, -3]} intensity={0.4} color="#d946ef" />

        {/* Floating hand */}
        <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
          <HandModel />
        </Float>

        {/* Particles */}
        <ParticleField count={500} />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.4}
          maxPolarAngle={Math.PI / 1.8}
          minPolarAngle={Math.PI / 3}
        />
      </Canvas>
    </div>
  );
}
