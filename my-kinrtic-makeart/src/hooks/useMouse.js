import { useEffect, useRef } from "react";

// Custom Hook: encapsulates mouse tracking logic
// TC for initialization: O(1)
// TC for updates: O(1) per mousemove event
export function useMouse() {
  // useRef creates { current: initialValue }
  // Changing .current doesn't trigger React re-render
  // Critical for performance: 60 mousemove events/second would freeze UI if using useState
  const mouse = useRef({
    x: null, // null = mouse not on screen
    y: null,
    isActive: false,
  });

  useEffect(() => {
    // Event handler: O(1) per invocation
    const handleMove = (e) => {
      mouse.current = {
        x: e.clientX, // viewport X coordinate
        y: e.clientY, // viewport Y coordinate
        isActive: true,
      };
    };

    const handleLeave = () => {
      mouse.current = { x: null, y: null, isActive: false };
    };

    // Register listeners: O(1) amortized (browser uses hash map for event types)
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseleave", handleLeave);

    // Cleanup function: React runs this when component unmounts
    // Prevents memory leaks and ghost event handlers
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseleave", handleLeave);
    };
  }, []); // Empty dependency array = run once on mount, never again

  return mouse; // Return ref object (same reference every time)
}
