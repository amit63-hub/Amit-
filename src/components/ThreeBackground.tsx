import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sphere, MeshDistortMaterial, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

function Particles() {
  const points = useMemo(() => {
    const p = new Float32Array(4000 * 3);
    for (let i = 0; i < 4000; i++) {
      p[i * 3] = (Math.random() - 0.5) * 40;
      p[i * 3 + 1] = (Math.random() - 0.5) * 40;
      p[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    return p;
  }, []);

  const pointRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    const time = performance.now() / 1000;
    if (pointRef.current) {
      pointRef.current.rotation.y = time * 0.02;
      pointRef.current.rotation.x = time * 0.01;
    }
  });

  return (
    <Points positions={points} ref={pointRef}>
      <PointMaterial
        transparent
        color="#3b82f6"
        size={0.03}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.4}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

function AICore() {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = performance.now() / 1000;
    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.5;
      meshRef.current.rotation.z = time * 0.3;
      const s = 1 + Math.sin(time * 2) * 0.05;
      meshRef.current.scale.set(s, s, s);
    }
    if (glowRef.current) {
      const s = 1.2 + Math.sin(time * 2) * 0.1;
      glowRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 15]} />
        <meshStandardMaterial 
          color="#3b82f6" 
          wireframe 
          transparent 
          opacity={0.3} 
          emissive="#3b82f6"
          emissiveIntensity={2}
        />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial 
          color="#8b5cf6" 
          transparent 
          opacity={0.05} 
        />
      </mesh>
    </group>
  );
}

function CentralGlobe() {
  const mesh = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  // Use public textures for Earth
  const [colorMap, normalMap, specularMap, cloudsMap] = useMemo(() => {
    const loader = new THREE.TextureLoader();
    return [
      loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg'),
      loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg'),
      loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg'),
      loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png')
    ];
  }, []);

  useFrame((state) => {
    const time = performance.now() / 1000;
    const { x, y } = state.mouse;

    if (mesh.current) {
      mesh.current.rotation.y = time * 0.05;
    }
    if (cloudRef.current) {
      cloudRef.current.rotation.y = time * 0.06;
    }
    if (groupRef.current) {
      // Gentle mouse follow/tilt
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, x * 0.1, 0.05);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -y * 0.1, 0.05);
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh ref={mesh} castShadow receiveShadow>
          <sphereGeometry args={[2.2, 64, 64]} />
          <meshPhongMaterial
            map={colorMap}
            normalMap={normalMap}
            specularMap={specularMap}
            shininess={15}
            specular={new THREE.Color(0x333333)}
          />
        </mesh>

        <mesh ref={cloudRef}>
          <sphereGeometry args={[2.23, 64, 64]} />
          <meshPhongMaterial
            map={cloudsMap}
            transparent={true}
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>

        <mesh ref={atmosphereRef}>
          <sphereGeometry args={[2.3, 64, 64]} />
          <meshPhongMaterial
            color="#4ea1d3"
            transparent={true}
            opacity={0.15}
            side={THREE.BackSide}
          />
        </mesh>
      </Float>
      
      <mesh rotation={[Math.PI / 2.5, 0, 0]}>
        <torusGeometry args={[4.2, 0.005, 16, 120]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.2} />
      </mesh>
      <mesh rotation={[-Math.PI / 3, Math.PI / 6, 0]}>
        <torusGeometry args={[4.8, 0.003, 16, 120]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

export default function ThreeBackground() {
  return (
    <div className="fixed inset-0 -z-10 bg-[#020617]">
      <Canvas camera={{ position: [0, 0, 8], fov: 60 }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#3b82f6" />
        <pointLight position={[-10, -10, 10]} intensity={1} color="#8b5cf6" />
        <spotLight position={[0, 15, 0]} angle={0.3} penumbra={1} intensity={2} color="#fff" />
        
        <Particles />
        <AICore />
        <CentralGlobe />
        
        <fog attach="fog" args={['#020617', 5, 20]} />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#020617]/80 pointer-events-none" />
      
      {/* Atmospheric blur overlays */}
      <div className="absolute top-0 left-0 w-full h-full opacity-40 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
    </div>
  );
}
