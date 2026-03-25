import { useEffect, useRef, useState } from "react";
// Legacy @mediapipe/* bundles register classes on globalThis (no ESM exports).
import "@mediapipe/hands";
import "@mediapipe/camera_utils";

const { Hands, Camera } = globalThis;

/** Normalized 2D distance (thumb tip vs index tip); pinch when below this. */
export const PINCH_DISTANCE_THRESHOLD = 0.06;

function smooth2D(current, target, alpha = 0.22) {
  if (!current) return target;
  return {
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
  };
}

function distance2D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
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
  });

  useEffect(() => {
    let mounted = true;
    let camera = null;
    let smoothedIndex = null;

    async function init() {
      if (!videoRef.current) return;

      const hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });

      hands.onResults((results) => {
        if (!mounted) return;

        if (
          results.multiHandLandmarks &&
          results.multiHandLandmarks.length > 0
        ) {
          const lm = results.multiHandLandmarks[0];

          const indexTipRaw = { x: lm[8].x, y: lm[8].y };
          const thumbTip = { x: lm[4].x, y: lm[4].y };

          smoothedIndex = smooth2D(smoothedIndex, indexTipRaw, 0.2);

          const fingerDistance = distance2D(indexTipRaw, thumbTip);

          setHand({
            ready: true,
            visible: true,
            landmarks: lm.map((p) => ({ x: p.x, y: p.y, z: p.z })),
            indexTip: smoothedIndex,
            thumbTip,
            fingerDistance,
            pinched: fingerDistance < PINCH_DISTANCE_THRESHOLD,
          });
        } else {
          setHand((prev) => ({
            ...prev,
            ready: true,
            visible: false,
            landmarks: null,
            indexTip: null,
            thumbTip: null,
            fingerDistance: null,
            pinched: false,
          }));
        }
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
