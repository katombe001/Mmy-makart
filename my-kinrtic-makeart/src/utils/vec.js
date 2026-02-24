// Vector mathematics utility
// All operations are pure functions (no side effects)

export const vec = {
  // Add two vectors: result = a + b
  // TC: O(1) - constant time, single operation per component
  add: (a, b) => ({
    x: a.x + b.x,
    y: a.y + b.y,
  }),

  // Subtract: result = a - b (direction from b to a)
  // TC: O(1)
  sub: (a, b) => ({
    x: a.x - b.x,
    y: a.y - b.y,
  }),

  // Multiply vector by scalar (scale magnitude)
  // TC: O(1)
  mult: (v, s) => ({
    x: v.x * s,
    y: v.y * s,
  }),

  // Magnitude (length) using Pythagorean theorem: √(x² + y²)
  // TC: O(1) - Math.hypot is native optimized
  mag: (v) => Math.hypot(v.x, v.y),

  // Normalize (unit vector, length = 1, direction preserved)
  // TC: O(1)
  norm: (v) => {
    const m = Math.hypot(v.x, v.y) || 1; // ||1 prevents division by zero
    return {
      x: v.x / m,
      y: v.y / m,
    };
  },

  // Limit maximum magnitude (speed clamping)
  // TC: O(1)
  limit: (v, max) => {
    const m = Math.hypot(v.x, v.y);
    if (m > max) {
      return {
        x: (v.x / m) * max,
        y: (v.y / m) * max,
      };
    }
    return v; // No allocation if under limit (optimization)
  },

  // Distance between two points
  // TC: O(1)
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
};
