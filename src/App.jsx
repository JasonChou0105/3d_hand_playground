import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
// Legacy @mediapipe/* bundles attach APIs to globalThis (no ESM exports).
import "@mediapipe/hands";
import "@mediapipe/drawing_utils";
import useHandTracker from "./useHandTracker";
import ThreeScene from "./components/ThreeScene.jsx";
import "./App.css";
import { Physics } from "@react-three/rapier";

function paintHandSkeleton(canvas, handState) {
  if (!canvas) return;

  const drawConnectors = globalThis.drawConnectors;
  const drawLandmarks = globalThis.drawLandmarks;
  const HAND_CONNECTIONS =
    globalThis.HAND_CONNECTIONS || globalThis.Hands?.HAND_CONNECTIONS;

  if (
    typeof drawConnectors !== "function" ||
    typeof drawLandmarks !== "function" ||
    !HAND_CONNECTIONS
  ) {
    console.log("drawing utils missing", {
      drawConnectors,
      drawLandmarks,
      HAND_CONNECTIONS,
      globalKeys: Object.keys(globalThis).filter(
        (k) =>
          k.toLowerCase().includes("hand") || k.toLowerCase().includes("draw"),
      ),
    });
    return;
  }

  const w = window.innerWidth;
  const h = window.innerHeight;

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  const list =
    handState.overlayHands?.length > 0
      ? handState.overlayHands
      : handState.visible && handState.landmarks
        ? [{ landmarks: handState.landmarks, label: "?" }]
        : [];

  if (list.length === 0) return;

  for (const { landmarks } of list) {
    const mirroredLandmarks = landmarks.map((p) => ({
      x: 1 - p.x,
      y: p.y,
      z: p.z,
    }));

    drawConnectors(ctx, mirroredLandmarks, HAND_CONNECTIONS, {
      color: "#00FFAA",
      lineWidth: 5,
    });

    drawLandmarks(ctx, mirroredLandmarks, {
      color: "#FFFFFF",
      lineWidth: 2,
      radius: 5,
    });

    const tip = mirroredLandmarks[8];
    if (tip) {
      ctx.beginPath();
      ctx.arc(tip.x * w, tip.y * h, 12, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 80, 80, 0.95)";
      ctx.fill();
    }
  }
}

function HandSkeletonOverlay({ hand }) {
  const canvasRef = useRef(null);
  const handRef = useRef(hand);
  handRef.current = hand;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function onResize() {
      paintHandSkeleton(canvasRef.current, handRef.current);
    }

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    paintHandSkeleton(canvasRef.current, hand);
  }, [hand]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-20 h-full w-full pointer-events-none block"
    />
  );
}

export default function App() {
  const { hand, videoRef } = useHandTracker();
  const [touching, setTouching] = useState(false);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover scale-x-[-1]"
        autoPlay
        playsInline
        muted
      />

      <Canvas
        className="absolute inset-0 z-10"
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ alpha: true }}
        onCreated={({ gl }) => gl.setClearColor(0, 0)}
      >
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]} debug>
            <ThreeScene hand={hand} setTouching={setTouching} />
          </Physics>
        </Suspense>
      </Canvas>

      <HandSkeletonOverlay hand={hand} />

      <div className="absolute top-3 left-3 z-30 rounded bg-black/60 px-3 py-2 text-white">
        <div>hand: {hand.visible ? "yes" : "no"}</div>
        <div>touching: {touching ? "yes" : "no"}</div>
        <div>distance: {hand.fingerDistance?.toFixed(4) ?? "—"}</div>
        <div>pinched: {hand.pinched ? "yes" : "no"}</div>
      </div>
    </div>
  );
}
