import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

const DEFAULT_POSITION = [0, 0, 0];
const DEFAULT_SIZE = [1.5, 1.5, 1.5];
const DEFAULT_COLOR = "royalblue";

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
 * Hand hover/pinch box. Positions the Rapier rigid body in world space — the mesh
 * stays at local origin so the collider and visuals stay aligned.
 */
export default function Cube({
  id,
  hand,
  setTouching,
  grabbedId,
  setGrabbedId,
  position = DEFAULT_POSITION,
  size = DEFAULT_SIZE,
  followLerp = 0.5,
  followPlaneZ,
  fixed = false,
  color = DEFAULT_COLOR,
}) {
  const rigidBodyRef = useRef(null);
  const { camera, size: viewport } = useThree();
  const [hovered, setHovered] = useState(false);

  const worldPosRef = useRef(new THREE.Vector3());
  const projectedRef = useRef(new THREE.Vector3());
  const raycasterRef = useRef(new THREE.Raycaster());
  const ndcRef = useRef(new THREE.Vector2());
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const hitPointRef = useRef(new THREE.Vector3());
  const curWorldRef = useRef(new THREE.Vector3());
  const prevPinchedRef = useRef(false);

  const box = vec3(size, DEFAULT_SIZE);
  const hx = box[0] / 2;
  const hy = box[1] / 2;
  const hz = box[2] / 2;

  const restArr = vec3(position, DEFAULT_POSITION);
  const r0 = restArr[0];
  const r1 = restArr[1];
  const r2 = restArr[2];

  const initialPosition = useMemo(() => [r0, r1, r2], [r0, r1, r2]);

  useFrame(() => {
    const rb = rigidBodyRef.current;
    if (!rb || fixed) return;

    const isGrabbed = grabbedId === id;
    const pinchStarted = hand.pinched && !prevPinchedRef.current;
    const pinchEnded = !hand.pinched && prevPinchedRef.current;

    const tr = rb.translation();
    const worldPos = worldPosRef.current.set(tr.x, tr.y, tr.z);
    const projected = projectedRef.current;
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
      if (pinchEnded && isGrabbed) {
        setGrabbedId(null);
      }
      prevPinchedRef.current = hand.pinched;
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

    if (pinchStarted && touching && grabbedId == null && !fixed) {
      setGrabbedId(id);
    }

    const plane = planeRef.current;
    plane.normal.set(0, 0, 1);

    if (hand.pinched && isGrabbed && !fixed) {
      const planeZ = followPlaneZ ?? tr.z;
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
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        const cur = curWorldRef.current.set(tr.x, tr.y, tr.z);
        cur.lerp(hit, followLerp);
        rb.setTranslation({ x: cur.x, y: cur.y, z: cur.z }, true);
      }

      prevPinchedRef.current = hand.pinched;
      return;
    }

    if (pinchEnded && isGrabbed) {
      setGrabbedId(null);
    }

    prevPinchedRef.current = hand.pinched;
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      type={fixed ? "fixed" : "dynamic"}
      position={initialPosition}
    >
      <mesh castShadow>
        <boxGeometry args={box} />
        <meshStandardMaterial
          color={
            grabbedId === id && hand.pinched && !fixed
              ? "limegreen"
              : hovered && !fixed
                ? "red"
                : color
          }
        />
      </mesh>
      <CuboidCollider args={[hx, hy, hz]} />
    </RigidBody>
  );
}
