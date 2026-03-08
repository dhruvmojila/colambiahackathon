"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Procedural animated hand made of glowing wireframe geometry.
 * Represents an open palm with spread fingers.
 */
export default function HandModel() {
  const groupRef = useRef();
  const glowRef = useRef();

  // Create finger geometries procedurally
  const fingers = useMemo(() => {
    return [
      { pos: [-0.45, 0.7, 0], rot: [0, 0, 0.2], len: 0.7, rad: 0.07 }, // thumb
      { pos: [-0.22, 1.1, 0], rot: [0, 0, 0.08], len: 0.85, rad: 0.055 }, // index
      { pos: [0, 1.15, 0], rot: [0, 0, 0], len: 0.95, rad: 0.055 }, // middle
      { pos: [0.2, 1.1, 0], rot: [0, 0, -0.06], len: 0.85, rad: 0.055 }, // ring
      { pos: [0.38, 0.95, 0], rot: [0, 0, -0.12], len: 0.65, rad: 0.05 }, // pinky
    ];
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // Gentle floating + rotation
    groupRef.current.rotation.y = Math.sin(t * 0.4) * 0.3;
    groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.1 - 0.1;
    groupRef.current.position.y = Math.sin(t * 0.5) * 0.15;

    // Pulse glow
    if (glowRef.current) {
      glowRef.current.material.opacity = 0.12 + Math.sin(t * 1.5) * 0.05;
    }
  });

  const wireframeMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("hsl(270, 70%, 65%)"),
        wireframe: true,
        transparent: true,
        opacity: 0.6,
      }),
    [],
  );

  const edgeMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("hsl(185, 80%, 65%)"),
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      }),
    [],
  );

  return (
    <group ref={groupRef} scale={1.4} position={[0, -0.3, 0]}>
      {/* Palm */}
      <mesh material={wireframeMat}>
        <boxGeometry args={[0.9, 1.0, 0.25, 3, 4, 2]} />
      </mesh>
      <mesh material={edgeMat} scale={1.08}>
        <boxGeometry args={[0.9, 1.0, 0.25, 3, 4, 2]} />
      </mesh>

      {/* Fingers */}
      {fingers.map((f, i) => (
        <group key={i} position={f.pos} rotation={f.rot}>
          <mesh material={wireframeMat}>
            <capsuleGeometry args={[f.rad, f.len, 4, 8]} />
          </mesh>
          <mesh material={edgeMat} scale={1.1}>
            <capsuleGeometry args={[f.rad, f.len, 4, 8]} />
          </mesh>
        </group>
      ))}

      {/* Inner glow sphere */}
      <mesh ref={glowRef} scale={1.8}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshBasicMaterial
          color="hsl(270, 60%, 50%)"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}
