import { useRef, useCallback } from "react";
import { vec } from "../utils/vec";

// Physics constants
const CONFIG = {
  maxSpeed: 8, // pixels per frame maximum
  attractRadius: 150, // pixels: mouse influence distance
  attractStrength: 0.15, // acceleration multiplier
  returnStrength: 0.03, // homing force when mouse away
  friction: 0.94, // velocity decay (simulates air resistance)
  scatterRadius: 200, // initial random displacement
};

export function useLetters(word, canvasSize) {
  // useRef stores mutable array without re-renders
  // TC: O(1) access, O(n) space where n = letters.length
  const letters = useRef([]);

  // Measure text width for centering calculations
  // TC: O(1) — creates 1px canvas, single measure call
  const measureText = (text) => {
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.font = "32px monospace";
    return ctx.measureText(text).width;
  };

  // useCallback memoizes function (same reference unless dependencies change)
  // Prevents unnecessary effect re-runs in consuming components
  const init = useCallback(() => {
    if (!canvasSize.width || !canvasSize.height) return;

    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;
    const totalWidth = measureText(word);
    let currentX = centerX - totalWidth / 2;

    // Array creation: O(n) where n = word.length
    letters.current = [...word].map((char) => {
      const charWidth = measureText(char);
      const home = {
        x: currentX + charWidth / 2, // Center of letter
        y: centerY,
      };
      currentX += charWidth;

      // Random scatter: O(1) per letter
      const scatter = {
        x: (Math.random() - 0.5) * CONFIG.scatterRadius * 2,
        y: (Math.random() - 0.5) * CONFIG.scatterRadius * 2,
      };

      return {
        char, // The letter character
        home, // Target position (where word forms)
        pos: {
          // Current position
          x: home.x + scatter.x,
          y: home.y + scatter.y,
        },
        vel: { x: 0, y: 0 }, // Velocity (pixels/frame)
        acc: { x: 0, y: 0 }, // Acceleration (pixels/frame²)
      };
    });
  }, [word, canvasSize]); // Re-initialize when word or canvas changes

  // Physics update: called 60 times/second
  // TC: O(n) where n = letters.length — must update every letter
  const update = useCallback((mouse) => {
    letters.current.forEach((letter) => {
      // Reset acceleration each frame (forces are recalculated)
      letter.acc = { x: 0, y: 0 };

      // MOUSE ATTRACTION FORCE
      if (mouse.isActive) {
        // Vector from letter to mouse: O(1)
        const toMouse = vec.sub(mouse, letter.pos);
        const d = vec.mag(toMouse); // Distance

        // Only attract if within radius (spatial optimization)
        if (d < CONFIG.attractRadius && d > 0) {
          // Force decreases linearly with distance (0 at edge, max at center)
          const force = (1 - d / CONFIG.attractRadius) * CONFIG.attractStrength;
          // Add force in direction of mouse: O(1)
          letter.acc = vec.add(letter.acc, vec.mult(vec.norm(toMouse), force));
        }
      } else {
        // RETURN HOME FORCE (word formation)
        // Spring-like force toward home position
        const toHome = vec.sub(letter.home, letter.pos);
        letter.acc = vec.add(
          letter.acc,
          vec.mult(toHome, CONFIG.returnStrength),
        );
      }

      // EULER INTEGRATION (physics simulation)
      // TC: O(1) per letter
      letter.vel = vec.add(letter.vel, letter.acc); // v = v + a
      letter.vel = vec.mult(letter.vel, CONFIG.friction); // Apply drag
      letter.vel = vec.limit(letter.vel, CONFIG.maxSpeed); // Clamp speed
      letter.pos = vec.add(letter.pos, letter.vel); // p = p + v
    });
  }, []); // No dependencies — same function reference always

  return { letters, init, update };
}
