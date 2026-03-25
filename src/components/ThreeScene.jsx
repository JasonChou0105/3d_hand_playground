import { useState } from "react";
import { OrbitControls } from "@react-three/drei";
import Cube from "./Cube.jsx";

export default function ThreeScene({ hand, setTouching }) {
  const [grabbedId, setGrabbedId] = useState(null);

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[3, 4, 5]} intensity={1.8} />
      <Cube
        id="cube1"
        hand={hand}
        setTouching={setTouching}
        grabbedId={grabbedId}
        setGrabbedId={setGrabbedId}
        position={[1, 1, 0]}
        size={[0.3, 0.3, 0.3]}
      />
      <Cube
        id="cube2"
        hand={hand}
        setTouching={setTouching}
        grabbedId={grabbedId}
        setGrabbedId={setGrabbedId}
        position={[-1, 1, 0]}
        size={[0.3, 0.3, 0.3]}
        color="coral"
      />
      <Cube
        id="cube3"
        hand={hand}
        setTouching={setTouching}
        grabbedId={grabbedId}
        setGrabbedId={setGrabbedId}
        position={[0, 1, 0]}
        size={[0.3, 0.3, 0.3]}
        color="coral"
      />
      <Cube
        id="cube4"
        hand={hand}
        setTouching={setTouching}
        grabbedId={grabbedId}
        setGrabbedId={setGrabbedId}
        position={[1, 1, 0]}
        size={[0.3, 0.3, 0.3]}
        color="coral"
      />
      
      <Cube
        id="floor"
        hand={hand}
        setTouching={setTouching}
        grabbedId={grabbedId}
        setGrabbedId={setGrabbedId}
        position={[0, -2, 0]}
        size={[15, 0.2, 15]}
        fixed={true}
        color="#3d4454"
      />
      <OrbitControls enablePan={false} />
    </>
  );
}
