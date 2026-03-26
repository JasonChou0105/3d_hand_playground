import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

const DEFAULT_POSITION = [0, 0, 0];
const DEFAULT_SIZE = [1.5, 1.5, 1.5];
const DEFAULT_COLOR = "royalblue";
const DEFAULT_THROW_MULTIPLIER = 0.65;
const DEFAULT_THROW_MAX_SPEED = 10;
const DEFAULT_THROW_SMOOTHING = 0.35;
const DEFAULT_THROW_MIN_SPEED = 0.05;
/** World-space half-extent added on each axis for hover/grab raycast (±padding to box size). */
const DEFAULT_GRAB_HOVER_PADDING = 0;

const REST_Z_EPS = 1e-5;

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
  grabbedIdLeft,
  setGrabbedIdLeft,
  grabbedIdRight,
  setGrabbedIdRight,
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
  grabHoverPadding = DEFAULT_GRAB_HOVER_PADDING,
  /** World Y of floor top; clamps pinch motion so box bottom stays on or above (Y-up). */
  floorTopY,
}) {
  const rigidBodyRef = useRef(null);
  const grabHitMeshRef = useRef(null);
  const { camera, size: viewport } = useThree();
  const [hovered, setHovered] = useState(false);

  const raycasterRef = useRef(new THREE.Raycaster());
  const ndcRef = useRef(new THREE.Vector2());
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const hitPointRef = useRef(new THREE.Vector3());
  const curWorldRef = useRef(new THREE.Vector3());
  const prevTargetPosRef = useRef(new THREE.Vector3());
  const prevTargetValidRef = useRef(false);
  const throwVelRef = useRef(new THREE.Vector3());
  const throwVelRawRef = useRef(new THREE.Vector3());
  const prevPinchedLeftRef = useRef(false);
  const prevPinchedRightRef = useRef(false);

  const box = vec3(size, DEFAULT_SIZE);
  const hx = box[0] / 2;
  const hy = box[1] / 2;
  const hz = box[2] / 2;

  const restArr = vec3(position, DEFAULT_POSITION);
  const r0 = restArr[0];
  const r1 = restArr[1];
  const r2 = restArr[2];

  const initialPosition = useMemo(() => [r0, r1, r2], [r0, r1, r2]);

  const grabHitBox = useMemo(() => {
    const p = grabHoverPadding;
    return [
      Math.max(1e-4, box[0] + 2 * p),
      Math.max(1e-4, box[1] + 2 * p),
      Math.max(1e-4, box[2] + 2 * p),
    ];
  }, [box[0], box[1], box[2], grabHoverPadding]);

  useFrame((_, delta) => {
    const rb = rigidBodyRef.current;
    if (!rb || fixed) return;

    const restZ = r2;

    const enforceRestZ = () => {
      const t = rb.translation();
      if (Math.abs(t.z - restZ) > REST_Z_EPS) {
        rb.setTranslation({ x: t.x, y: t.y, z: restZ }, true);
      }
      const v = rb.linvel();
      if (Math.abs(v.z) > REST_Z_EPS) {
        rb.setLinvel({ x: v.x, y: v.y, z: 0 }, true);
      }
    };

    const isGrabbedLeft = grabbedIdLeft === id;
    const isGrabbedRight = grabbedIdRight === id;

    const leftPinched = hand.pinched === true;
    const rightPinched = hand.rightPinched === true;

    const pinchEndedLeft = !leftPinched && prevPinchedLeftRef.current;
    const pinchEndedRight = !rightPinched && prevPinchedRightRef.current;

    const leftIndexTip = hand.indexTip;
    const rightIndexTip = hand.rightIndexTip;
    const leftHasIndex = !!leftIndexTip;
    const rightHasIndex = !!rightIndexTip;

    const tr = rb.translation();

    const minCenterY =
      floorTopY != null && Number.isFinite(floorTopY) ? floorTopY + hy : null;

    const ensureAboveFloor = () => {
      if (minCenterY == null) return;
      const t = rb.translation();
      if (t.y < minCenterY) {
        rb.setTranslation({ x: t.x, y: minCenterY, z: restZ }, true);
        const v = rb.linvel();
        if (v.y < 0) rb.setLinvel({ x: v.x, y: 0, z: v.z }, true);
      }
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

      rb.setLinvel({ x: scaled.x, y: scaled.y, z: 0 }, true);
      // Clear angular velocity so the throw feels “pure”.
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    };

    // Release handling (per-hand).
    if (pinchEndedLeft && isGrabbedLeft) {
      applyThrowVelocity();
      setGrabbedIdLeft(null);
      prevTargetValidRef.current = false;
      throwVelRef.current.set(0, 0, 0);
    } else if (pinchEndedRight && isGrabbedRight) {
      applyThrowVelocity();
      setGrabbedIdRight(null);
      prevTargetValidRef.current = false;
      throwVelRef.current.set(0, 0, 0);
    }

    // If neither index tip exists, only update pinch history and exit.
    if (!leftHasIndex && !rightHasIndex) {
      prevPinchedLeftRef.current = leftPinched;
      prevPinchedRightRef.current = rightPinched;
      ensureAboveFloor();
      enforceRestZ();
      return;
    }

    const plane = planeRef.current;
    plane.normal.set(0, 0, 1);

    // Compute hover/touching for each hand separately.
    let touchingLeft = false;
    let touchingRight = false;

    if (leftHasIndex && grabHitMeshRef.current) {
      const finger = {
        x: (1 - leftIndexTip.x) * viewport.width,
        y: leftIndexTip.y * viewport.height,
      };

      const ndcHover = ndcRef.current;
      ndcHover.x = (finger.x / viewport.width) * 2 - 1;
      ndcHover.y = -(finger.y / viewport.height) * 2 + 1;

      const raycasterHover = raycasterRef.current;
      raycasterHover.setFromCamera(ndcHover, camera);
      touchingLeft =
        raycasterHover.intersectObject(grabHitMeshRef.current, false).length > 0;
    }

    if (rightHasIndex && grabHitMeshRef.current) {
      const finger = {
        x: (1 - rightIndexTip.x) * viewport.width,
        y: rightIndexTip.y * viewport.height,
      };

      const ndcHover = ndcRef.current;
      ndcHover.x = (finger.x / viewport.width) * 2 - 1;
      ndcHover.y = -(finger.y / viewport.height) * 2 + 1;

      const raycasterHover = raycasterRef.current;
      raycasterHover.setFromCamera(ndcHover, camera);
      touchingRight =
        raycasterHover.intersectObject(grabHitMeshRef.current, false).length > 0;
    }

    const touchingAny = touchingLeft || touchingRight;
    if (touchingAny !== hovered) {
      setHovered(touchingAny);
      setTouching(touchingAny);
    }

    const leftFree = grabbedIdLeft == null;
    const rightFree = grabbedIdRight == null;

    // Grab start (only if that hand is free and the cube isn't already held by the other hand).
    if (
      leftPinched &&
      touchingLeft &&
      leftFree &&
      grabbedIdRight !== id &&
      !fixed
    ) {
      prevTargetValidRef.current = false;
      throwVelRef.current.set(0, 0, 0);
      setGrabbedIdLeft(id);
    } else if (
      rightPinched &&
      touchingRight &&
      rightFree &&
      grabbedIdLeft !== id &&
      !fixed
    ) {
      prevTargetValidRef.current = false;
      throwVelRef.current.set(0, 0, 0);
      setGrabbedIdRight(id);
    }

    // Move while grabbed. Drive cube translation from ray-plane hit point.
    if (leftPinched && isGrabbedLeft && leftHasIndex && !fixed) {
      const planeZ = followPlaneZ ?? restZ;
      plane.constant = -planeZ;

      const fx = (1 - leftIndexTip.x) * viewport.width;
      const fy = leftIndexTip.y * viewport.height;

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
        if (minCenterY != null) cur.y = Math.max(cur.y, minCenterY);
        rb.setTranslation({ x: cur.x, y: cur.y, z: restZ }, true);

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

      prevPinchedLeftRef.current = leftPinched;
      prevPinchedRightRef.current = rightPinched;
      ensureAboveFloor();
      enforceRestZ();
      return;
    }

    if (rightPinched && isGrabbedRight && rightHasIndex && !fixed) {
      const planeZ = followPlaneZ ?? restZ;
      plane.constant = -planeZ;

      const fx = (1 - rightIndexTip.x) * viewport.width;
      const fy = rightIndexTip.y * viewport.height;

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
        if (minCenterY != null) cur.y = Math.max(cur.y, minCenterY);
        rb.setTranslation({ x: cur.x, y: cur.y, z: restZ }, true);

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

      prevPinchedLeftRef.current = leftPinched;
      prevPinchedRightRef.current = rightPinched;
      ensureAboveFloor();
      enforceRestZ();
      return;
    }

    prevPinchedLeftRef.current = leftPinched;
    prevPinchedRightRef.current = rightPinched;
    ensureAboveFloor();
    enforceRestZ();
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      type={fixed ? "fixed" : "dynamic"}
      position={initialPosition}
      ccd={!fixed}
    >
      <mesh ref={grabHitMeshRef}>
        <boxGeometry args={grabHitBox} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh castShadow>
        <boxGeometry args={box} />
        <meshStandardMaterial
          color={
            ((grabbedIdLeft === id && hand.pinched) ||
              (grabbedIdRight === id && hand.rightPinched)) &&
            !fixed
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
