import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

const DEFAULT_POSITION = [0, 0, 0];
const DEFAULT_SIZE = [1.5, 1.5, 1.5];
const DEFAULT_COLOR = "royalblue";
const DEFAULT_THROW_MULTIPLIER = 0.65;
const DEFAULT_THROW_MAX_SPEED = 25;
const DEFAULT_THROW_SMOOTHING = 0.35;
const DEFAULT_THROW_MIN_SPEED = 0.05;

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
  followLerp = 0.65,
  followPlaneZ,
  fixed = false,
  color = DEFAULT_COLOR,
  throwVelocityMultiplier = DEFAULT_THROW_MULTIPLIER,
  throwVelocityMaxSpeed = DEFAULT_THROW_MAX_SPEED,
  throwVelocitySmoothing = DEFAULT_THROW_SMOOTHING,
  throwVelocityMinSpeed = DEFAULT_THROW_MIN_SPEED,
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
  const prevTargetPosRef = useRef(new THREE.Vector3());
  const prevTargetValidRef = useRef(false);
  const throwVelRef = useRef(new THREE.Vector3());
  const throwVelRawRef = useRef(new THREE.Vector3());
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

  useFrame((_, delta) => {
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

    const applyThrowVelocity = () => {
      const speed = throwVelRef.current.length();
      if (speed < throwVelocityMinSpeed) return;

      const v = throwVelRef.current;
      const scaled = throwVelRawRef.current.copy(v).multiplyScalar(throwVelocityMultiplier);

      // Clamp to avoid huge explosions from occasional tracking spikes.
      const scaledSpeed = scaled.length();
      if (scaledSpeed > throwVelocityMaxSpeed) {
        scaled.multiplyScalar(throwVelocityMaxSpeed / scaledSpeed);
      }

      rb.setLinvel({ x: scaled.x, y: scaled.y, z: scaled.z }, true);
      // Clear angular velocity so the throw feels “pure”.
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    };

    if (!hand.indexTip) {
      if (hovered) {
        setHovered(false);
        setTouching(false);
      }
      if (pinchEnded && grabbedId === id) {
        applyThrowVelocity();
        setGrabbedId(null);
        prevTargetValidRef.current = false;
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

    // New grab only when pinch starts on this cube; release only on unpinch (hand.pinched false).
    if (pinchStarted && touching && grabbedId == null && !fixed) {
      prevTargetValidRef.current = false;
      throwVelRef.current.set(0, 0, 0);
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

        // Estimate "hand velocity" from how fast the target position moves.
        if (delta > 0) {
          if (!prevTargetValidRef.current) {
            prevTargetPosRef.current.copy(cur);
            prevTargetValidRef.current = true;
          } else {
            throwVelRawRef.current
              .copy(cur)
              .sub(prevTargetPosRef.current)
              .multiplyScalar(1 / delta);

            if (throwVelRef.current.lengthSq() === 0) {
              throwVelRef.current.copy(throwVelRawRef.current);
            } else {
              // Smooth the velocity to reduce jitter on release.
              throwVelRef.current.lerp(
                throwVelRawRef.current,
                throwVelocitySmoothing
              );
            }

            prevTargetPosRef.current.copy(cur);
          }
        }
      }

      prevPinchedRef.current = hand.pinched;
      return;
    }

    if (pinchEnded && grabbedId === id) {
      applyThrowVelocity();
      setGrabbedId(null);
      prevTargetValidRef.current = false;
      throwVelRef.current.set(0, 0, 0);
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
