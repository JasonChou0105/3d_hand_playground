import { useLayoutEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const DEFAULT_POSITION = [0, 0, 0];
const DEFAULT_SIZE = [1.5, 1.5, 1.5];

/** @param {unknown} value @param {number[]} fallback */
function vec3(value, fallback) {
  if (typeof value === "number") {
    return [value, value, value];
  }
  if (Array.isArray(value) && value.length >= 3) {
    return [Number(value[0]), Number(value[1]), Number(value[2])];
  }
  return fallback;
}

/**
 * Hand hover/pinch box. `size` = [width X, height Y, depth Z].
 * While pinched, the mesh lerps toward the finger ray hit on z = followPlaneZ (default: current mesh z).
 * Releasing pinch keeps the cube where it is (rest updates to that position).
 */
export default function Cube({
  hand,
  setTouching,
  position = DEFAULT_POSITION,
  size = DEFAULT_SIZE,
  followLerp = 0.5,
  followPlaneZ,
}) {
  const ref = useRef(null);
  const { camera, size: viewport } = useThree();
  const [hovered, setHovered] = useState(false);

  const worldPosRef = useRef(new THREE.Vector3());
  const projectedRef = useRef(new THREE.Vector3());
  const raycasterRef = useRef(new THREE.Raycaster());
  const ndcRef = useRef(new THREE.Vector2());
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const hitPointRef = useRef(new THREE.Vector3());
  const restRef = useRef(new THREE.Vector3());
  const wasPinchedRef = useRef(false);

  const box = vec3(size, DEFAULT_SIZE);
  const restArr = vec3(position, DEFAULT_POSITION);
  const r0 = restArr[0];
  const r1 = restArr[1];
  const r2 = restArr[2];

  useLayoutEffect(() => {
    restRef.current.set(r0, r1, r2);
    ref.current?.position.set(r0, r1, r2);
  }, [r0, r1, r2]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;

    const plane = planeRef.current;
    plane.normal.set(0, 0, 1);

    if (hand.pinched && hand.indexTip) {
      const planeZ = followPlaneZ ?? mesh.position.z;
      plane.constant = -planeZ;

      const fx = (1 - hand.indexTip.x) * viewport.width;
      const fy = hand.indexTip.y * viewport.height;

      const ndc = ndcRef.current;
      ndc.x = (fx / viewport.width) * 2 - 1;
      ndc.y = -(fy / viewport.height) * 2 + 1;

      const raycaster = raycasterRef.current;
      raycaster.setFromCamera(ndc, camera);

      const hit = hitPointRef.current;
      const ok = raycaster.ray.intersectPlane(plane, hit);

      if (ok) {
        mesh.position.lerp(hit, followLerp);
      }

      wasPinchedRef.current = true;
      setHovered(true);
      setTouching(true);
      return;
    }

    if (wasPinchedRef.current) {
      restRef.current.copy(mesh.position);
      wasPinchedRef.current = false;
    }

    mesh.position.lerp(restRef.current, followLerp);

    const worldPos = worldPosRef.current;
    const projected = projectedRef.current;

    mesh.getWorldPosition(worldPos);
    projected.copy(worldPos).project(camera);

    const cubeScreen = {
      x: (projected.x * 0.5 + 0.5) * viewport.width,
      y: (-projected.y * 0.5 + 0.5) * viewport.height,
    };

    if (!hand.indexTip) {
      if (hovered) {
        setHovered(false);
        setTouching(false);
      }
      return;
    }

    const finger = {
      x: (1 - hand.indexTip.x) * viewport.width,
      y: hand.indexTip.y * viewport.height,
    };

    const dx = finger.x - cubeScreen.x;
    const dy = finger.y - cubeScreen.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const touchPx = Math.max(90, Math.max(box[0], box[1]) * 120);
    const touching = dist < touchPx;

    if (touching !== hovered) {
      setHovered(touching);
      setTouching(touching);
    }
  });

  return (
    <mesh ref={ref}>
      <boxGeometry args={box} />
      <meshStandardMaterial
        color={
          hand.pinched ? "limegreen" : hovered ? "red" : "royalblue"
        }
      />
    </mesh>
  );
}
