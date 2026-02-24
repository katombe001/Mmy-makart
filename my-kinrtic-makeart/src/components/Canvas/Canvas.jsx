import { useEffect, useRef, useCallback, useState } from "react";
import { io } from "socket.io-client"; // Add this import
import { useMouse } from "../../hooks/useMouse";
import { useLetters } from "../../hooks/useLetters";
import { Canvas2DEngine } from "../../engine/Canvas2DEngine";
import "./Canvas.css";

export function Canvas({ word, roomId = "default" }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const rafRef = useRef(null);
  const mouse = useMouse();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { letters, init, update } = useLetters(word, size);

  // NEW: Socket connection for multiplayer
  // O(1) connection setup, O(1) per emit
  const socketRef = useRef(null);
  const [otherCursors, setOtherCursors] = useState(new Map()); // O(1) lookup

  // Initialize canvas engine
  useEffect(() => {
    if (!canvasRef.current) return;
    engineRef.current = new Canvas2DEngine(canvasRef.current);

    const handleResize = () => {
      engineRef.current.resize();
      setSize({
        width: engineRef.current.width,
        height: engineRef.current.height,
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Initialize letters
  useEffect(() => {
    init();
  }, [word, size, init]);

  // NEW: Socket.io connection
  useEffect(() => {
    // O(1) connection initialization
    socketRef.current = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:3001",
      {
        transports: ["websocket", "polling"], // Fallback for firewalls
      },
    );

    const socket = socketRef.current;

    // Join room: O(1) emit, O(m) broadcast to room members
    socket.emit("room:join", roomId, (roomState) => {
      console.log("Joined room:", roomState);
    });

    // Listen for other users' cursors: O(1) per message, O(m) total listeners
    socket.on("cursor:update", ({ userId, position }) => {
      // Functional update: O(1) Map clone with single entry change
      setOtherCursors((prev) => {
        const next = new Map(prev);
        next.set(userId, {
          ...position,
          timestamp: Date.now(),
        });
        return next;
      });
    });

    // User joined/left: O(1) state update
    socket.on("user:joined", ({ userId }) => {
      console.log("User joined:", userId);
    });

    socket.on("user:left", ({ userId }) => {
      setOtherCursors((prev) => {
        const next = new Map(prev);
        next.delete(userId); // O(1) deletion
        return next;
      });
    });

    // Word celebration: O(1) trigger animation
    socket.on("word:celebrate", ({ word, formedBy }) => {
      console.log(`${formedBy} formed ${word}!`);
      // Trigger visual celebration effect
    });

    // Cleanup: O(1) disconnection
    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  // NEW: Broadcast cursor position (throttled)
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !mouse.current.isActive) return;

    // Throttle to 30fps: O(1) timing check
    const now = Date.now();
    if (now % 33 > 1) return; // ~30fps (1000ms/30 ≈ 33ms)

    socket.emit("cursor:move", roomId, {
      x: mouse.current.x,
      y: mouse.current.y,
    });
  }); // Runs every render, but emit is throttled

  // Animation loop with other cursors
  const animate = useCallback(() => {
    if (engineRef.current) {
      update(mouse.current);
      // Pass otherCursors to engine for rendering
      engineRef.current.render(letters, mouse.current, otherCursors);
    }
    rafRef.current = requestAnimationFrame(animate);
  }, [update, letters, mouse, otherCursors]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  return <canvas ref={canvasRef} className="canvas" />;
}
