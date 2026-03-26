import { useState } from "react";
import { OrbitControls } from "@react-three/drei";
import Cube from "./Cube.jsx";

/** Extra world units on each axis for raycast hover/grab (see Cube `grabHoverPadding`). */
const GRAB_PAD = 0.04;

const FLOOR_CENTER_Y = -2;
const FLOOR_HALF_Y = 0.1;
/** Top surface of floor cube (center + half height), Y-up. */
const FLOOR_TOP_Y = FLOOR_CENTER_Y + FLOOR_HALF_Y;

export default function ThreeScene({ hand, setTouching }) {
  const [grabbedIdLeft, setGrabbedIdLeft] = useState(null);
  const [grabbedIdRight, setGrabbedIdRight] = useState(null);

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[3, 4, 5]} intensity={1.8} />
      <Cube
        id="cube1"
        hand={hand}
        setTouching={setTouching}
        grabbedIdLeft={grabbedIdLeft}
        setGrabbedIdLeft={setGrabbedIdLeft}
        grabbedIdRight={grabbedIdRight}
        setGrabbedIdRight={setGrabbedIdRight}
        position={[2, 1, 0]}
        size={[0.3, 0.3, 0.3]}
        color="coral"
        grabHoverPadding={GRAB_PAD}
        floorTopY={FLOOR_TOP_Y}
      />
      <Cube
        id="cube2"
        hand={hand}
        setTouching={setTouching}
        grabbedIdLeft={grabbedIdLeft}
        setGrabbedIdLeft={setGrabbedIdLeft}
        grabbedIdRight={grabbedIdRight}
        setGrabbedIdRight={setGrabbedIdRight}
        position={[-2, 1, 0]}
        size={[0.3, 0.3, 0.3]}
        color="coral"
        grabHoverPadding={GRAB_PAD}
        floorTopY={FLOOR_TOP_Y}
      />
      <Cube
        id="cube3"
        hand={hand}
        setTouching={setTouching}
        grabbedIdLeft={grabbedIdLeft}
        setGrabbedIdLeft={setGrabbedIdLeft}
        grabbedIdRight={grabbedIdRight}
        setGrabbedIdRight={setGrabbedIdRight}
        position={[3, 1, 0]}
        size={[0.3, 0.3, 0.3]}
        color="coral"
        grabHoverPadding={GRAB_PAD}
        floorTopY={FLOOR_TOP_Y}
      />
      <Cube
        id="cube4"
        hand={hand}
        setTouching={setTouching}
        grabbedIdLeft={grabbedIdLeft}
        setGrabbedIdLeft={setGrabbedIdLeft}
        grabbedIdRight={grabbedIdRight}
        setGrabbedIdRight={setGrabbedIdRight}
        position={[-3, 1, 0]}
        size={[0.3, 0.3, 0.3]}
        color="coral"
        grabHoverPadding={GRAB_PAD}
        floorTopY={FLOOR_TOP_Y}
      />
      <Cube
        id="cube5"
        hand={hand}
        setTouching={setTouching}
        grabbedIdLeft={grabbedIdLeft}
        setGrabbedIdLeft={setGrabbedIdLeft}
        grabbedIdRight={grabbedIdRight}
        setGrabbedIdRight={setGrabbedIdRight}
        position={[0, 1, 0]}
        size={[2, 0.3, 0.3]}
        grabHoverPadding={GRAB_PAD}
        floorTopY={FLOOR_TOP_Y}
      />
      <Cube
        id="cube6"
        hand={hand}
        setTouching={setTouching}
        grabbedIdLeft={grabbedIdLeft}
        setGrabbedIdLeft={setGrabbedIdLeft}
        grabbedIdRight={grabbedIdRight}
        setGrabbedIdRight={setGrabbedIdRight}
        position={[0, 2, 0]}
        size={[2, 0.3, 0.3]}
        grabHoverPadding={GRAB_PAD}
        floorTopY={FLOOR_TOP_Y}
      />
      <Cube
        id="cube8"
        hand={hand}
        setTouching={setTouching}
        grabbedIdLeft={grabbedIdLeft}
        setGrabbedIdLeft={setGrabbedIdLeft}
        grabbedIdRight={grabbedIdRight}
        setGrabbedIdRight={setGrabbedIdRight}
        position={[3.5, 1, 0]}
        size={[0.3, 0.3, 0.3]}
        color="coral"
        grabHoverPadding={GRAB_PAD}
        floorTopY={FLOOR_TOP_Y}
      />
      <Cube
        id="cube7"
        hand={hand}
        setTouching={setTouching}
        grabbedIdLeft={grabbedIdLeft}
        setGrabbedIdLeft={setGrabbedIdLeft}
        grabbedIdRight={grabbedIdRight}
        setGrabbedIdRight={setGrabbedIdRight}
        position={[-3.5, 1, 0]}
        size={[0.3, 0.3, 0.3]}
        color="coral"
        grabHoverPadding={GRAB_PAD}
        floorTopY={FLOOR_TOP_Y}
      />
      <Cube
        id="floor"
        hand={hand}
        setTouching={setTouching}
        grabbedIdLeft={grabbedIdLeft}
        setGrabbedIdLeft={setGrabbedIdLeft}
        grabbedIdRight={grabbedIdRight}
        setGrabbedIdRight={setGrabbedIdRight}
        position={[0, -2, 0]}
        size={[15, 0.2, 15]}
        fixed={true}
        color="#3d4454"
      />
      <OrbitControls enablePan={false} />
    </>
  );
}
