export class Canvas2DEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    this.dpr = window.devicePixelRatio || 1;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  // UPDATED: Accept otherCursors parameter
  // TC: O(n + m + w×h) where n=letters, m=other cursors, w×h=clear
  render(letters, mouse, otherCursors = new Map()) {
    const ctx = this.ctx;

    // Trail effect: O(w×h)
    ctx.fillStyle = "rgba(10, 10, 10, 0.3)";
    ctx.fillRect(0, 0, this.width, this.height);

    // Batch letter rendering: O(n)
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    letters.current.forEach((letter) => {
      if (
        letter.pos.x < -50 ||
        letter.pos.x > this.width + 50 ||
        letter.pos.y < -50 ||
        letter.pos.y > this.height + 50
      ) {
        return;
      }

      ctx.save();

      const speed = Math.hypot(letter.vel.x, letter.vel.y);
      const hue = 180 + Math.min(speed * 10, 60);
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.shadowBlur = 10 + speed * 2;
      ctx.shadowColor = ctx.fillStyle;

      ctx.translate(letter.pos.x, letter.pos.y);
      ctx.rotate(letter.vel.x * 0.05);
      ctx.fillText(letter.char, 0, 0);

      ctx.restore();
    });

    // NEW: Render other users' cursors: O(m)
    otherCursors.forEach((cursor, userId) => {
      // Skip if stale (no update for 5 seconds)
      if (Date.now() - cursor.timestamp > 5000) return;

      ctx.save();

      // Different color per user (hash userId to hue)
      const hue = this.hashStringToHue(userId);
      ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.lineWidth = 2;

      // Draw cursor ring
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 15, 0, Math.PI * 2);
      ctx.stroke();

      // Draw center dot
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw user ID (first 6 chars)
      ctx.font = "10px monospace";
      ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
      ctx.fillText(userId.slice(0, 6), cursor.x + 20, cursor.y);

      ctx.restore();
    });

    // Own cursor: O(1)
    if (mouse.x !== null) {
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 20, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 255, 255, 0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // O(1) string hash to color
  hashStringToHue(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 360);
  }
}
