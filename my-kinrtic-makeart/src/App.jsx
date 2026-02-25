import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <h1 className="center">MAKEART</h1>
      <div className="center">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p className="center">Welcome to my ARTWORLD</p>
      </div>
      <p className="read-the-docs center">Click on The menu to learn more</p>
    </>
  );
}

export default App;
