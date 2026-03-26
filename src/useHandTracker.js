import { useEffect, useRef, useState } from "react";
// Legacy @mediapipe/* bundles register classes on globalThis (no ESM exports).
import "@mediapipe/hands";
import "@mediapipe/camera_utils";

const { Hands, Camera } = globalThis;

/**
 * Pinch-on: 3D thumb-tip ↔ index-tip distance divided by hand scale
 * (wrist ↔ middle MCP) falls below this ratio.
 */
export const PINCH_ON_RATIO = 0.28;
/**
 * Pinch-off: same ratio must rise above this before releasing (hysteresis).
 */
export const PINCH_OFF_RATIO = 0.42;

const HAND_SCALE_MIN = 1e-5;

function smooth2D(current, target, alpha = 0.22) {
  if (!current) return target;
  return {
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
  };
}

/** MediaPipe Hand landmarks: xyz in relative hand space (z depth comparable to x/y at same wrist origin). */
function distance3D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function emptyHandState() {
  return {
    ready: true,
    visible: false,
    landmarks: null,
    indexTip: null,
    thumbTip: null,
    fingerDistance: null,
    pinched: false,
    // Right hand (for simultaneous cube dragging).
    rightVisible: false,
    rightLandmarks: null,
    rightIndexTip: null,
    rightThumbTip: null,
    rightFingerDistance: null,
    rightPinched: false,
    overlayHands: [],
  };
}

export default function useHandTracker() {
  const videoRef = useRef(null);
  const [hand, setHand] = useState({
    ready: false,
    visible: false,
    landmarks: null,
    indexTip: null,
    thumbTip: null,
    fingerDistance: null,
    pinched: false,
    // Right hand (for simultaneous cube dragging).
    rightVisible: false,
    rightLandmarks: null,
    rightIndexTip: null,
    rightThumbTip: null,
    rightFingerDistance: null,
    rightPinched: false,
    overlayHands: [],
  });

  useEffect(() => {
    let mounted = true;
    let camera = null;
    let smoothedLeftIndex = null;
    let smoothedRightIndex = null;
    /** Stable pinch: stays closed until fingers clearly open (screen distance irrelevant). */
    let pinchClosedLeft = false;
    let pinchClosedRight = false;

    async function init() {
      if (!videoRef.current) return;

      const hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });

      hands.onResults((results) => {
        if (!mounted) return;

        const handsLm = results.multiHandLandmarks || [];
        const handedness = results.multiHandedness || [];

        const overlayHands = handsLm.map((lm, i) => ({
          landmarks: lm.map((p) => ({ x: p.x, y: p.y, z: p.z })),
          label: handedness[i]?.label ?? "?",
        }));

        let leftLm = null;
        let rightLm = null;
        for (let i = 0; i < handsLm.length; i++) {
          if (handedness[i]?.label === "Left") leftLm = handsLm[i];
          if (handedness[i]?.label === "Right") rightLm = handsLm[i];
        }

        if (handsLm.length === 0 || (!leftLm && !rightLm)) {
          smoothedLeftIndex = null;
          smoothedRightIndex = null;
          pinchClosedLeft = false;
          pinchClosedRight = false;
          setHand({
            ...emptyHandState(),
            overlayHands: [],
          });
          return;
        }

        let leftIndexTip = null;
        let leftThumbTip = null;
        let leftFingerDistance = null;
        let leftPinched = false;
        let leftLandmarks = null;

        if (leftLm) {
          const lm = leftLm;
          const indexTipRaw = { x: lm[8].x, y: lm[8].y };
          leftThumbTip = { x: lm[4].x, y: lm[4].y };

          smoothedLeftIndex = smooth2D(smoothedLeftIndex, indexTipRaw, 0.2);

          const pinchDist3d = distance3D(lm[4], lm[8]);
          const handScale = distance3D(lm[0], lm[9]);
          const pinchRatio =
            handScale > HAND_SCALE_MIN ? pinchDist3d / handScale : 1;

          if (pinchRatio < PINCH_ON_RATIO) pinchClosedLeft = true;
          else if (pinchRatio > PINCH_OFF_RATIO) pinchClosedLeft = false;

          leftIndexTip = smoothedLeftIndex;
          leftFingerDistance = pinchRatio;
          leftPinched = pinchClosedLeft;
          leftLandmarks = lm.map((p) => ({ x: p.x, y: p.y, z: p.z }));
        } else {
          smoothedLeftIndex = null;
          pinchClosedLeft = false;
        }

        let rightIndexTip = null;
        let rightThumbTip = null;
        let rightFingerDistance = null;
        let rightPinched = false;
        let rightLandmarks = null;

        if (rightLm) {
          const lm = rightLm;
          const indexTipRaw = { x: lm[8].x, y: lm[8].y };
          rightThumbTip = { x: lm[4].x, y: lm[4].y };

          smoothedRightIndex = smooth2D(
            smoothedRightIndex,
            indexTipRaw,
            0.2
          );

          const pinchDist3d = distance3D(lm[4], lm[8]);
          const handScale = distance3D(lm[0], lm[9]);
          const pinchRatio =
            handScale > HAND_SCALE_MIN ? pinchDist3d / handScale : 1;

          if (pinchRatio < PINCH_ON_RATIO) pinchClosedRight = true;
          else if (pinchRatio > PINCH_OFF_RATIO) pinchClosedRight = false;

          rightIndexTip = smoothedRightIndex;
          rightFingerDistance = pinchRatio;
          rightPinched = pinchClosedRight;
          rightLandmarks = lm.map((p) => ({ x: p.x, y: p.y, z: p.z }));
        } else {
          smoothedRightIndex = null;
          pinchClosedRight = false;
        }

        setHand({
          ready: true,
          visible: !!leftLm,
          landmarks: leftLandmarks,
          indexTip: leftIndexTip,
          thumbTip: leftThumbTip,
          fingerDistance: leftFingerDistance,
          pinched: leftPinched,
          rightVisible: !!rightLm,
          rightLandmarks,
          rightIndexTip,
          rightThumbTip,
          rightFingerDistance,
          rightPinched,
          overlayHands,
        });
      });

      camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await hands.send({ image: videoRef.current });
        },
        width: 1280,
        height: 720,
      });

      await camera.start();
    }

    init().catch(console.error);

    return () => {
      mounted = false;
      if (camera && camera.stop) camera.stop();
    };
  }, []);

  return { hand, videoRef };
}
