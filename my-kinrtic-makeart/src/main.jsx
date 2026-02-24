import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// React 18 createRoot API
// Renders App component into DOM element with id="root"
// TC: O(tree size) for initial render, then O(1) for updates via reconciliation
ReactDOM.createRoot(document.getElementById("root")).render(
  // StrictMode: double-renders in development to catch side effects
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
