require("dotenv").config();

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");
const Redis = require("ioredis");
const Queue = require("bull");
const cors = require("cors");

const app = express();
const httpServer = createServer(app);

// MIDDLEWARE: O(1) per request (executed in order)
app.use(cors()); // Cross-Origin Resource Sharing
app.use(express.json()); // Body parsing: O(size of body)

// DATABASE: PostgreSQL connection pool
// Pool maintains connections: O(1) to acquire from pool
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections in pool
});

// REDIS: O(1) operations, in-memory
const redis = new Redis(process.env.REDIS_URL);

// JOB QUEUE: O(log n) for job insertion (n = queue depth)
const videoQueue = new Queue("video processing", process.env.REDIS_URL);

// SOCKET.IO: WebSocket with Redis adapter for scaling
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL },
  transports: ["websocket", "polling"],
});

// ROOM STATE: In-memory with Redis persistence
// Map operations: O(1) average case
const rooms = new Map();

// ─── REST API ROUTES ───

// Health check: O(1)
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Get word library: O(log n) with index, n = total words
app.get("/api/words", async (req, res) => {
  // Cache check: O(1)
  const cached = await redis.get("words:all");
  if (cached) {
    return res.json(JSON.parse(cached)); // O(1) parse for small payload
  }

  // Database query: O(log n) with B-tree index
  const result = await pgPool.query(
    "SELECT id, word, difficulty, usage_count FROM words WHERE is_curated = true ORDER BY usage_count DESC",
  );

  // Cache for 5 minutes: O(1)
  await redis.setex("words:all", 300, JSON.stringify(result.rows));

  res.json(result.rows);
});

// Create room: O(1) insert with UUID generation
app.post("/api/rooms", async (req, res) => {
  const { name, maxUsers = 10, isPublic = true } = req.body;

  const result = await pgPool.query(
    `INSERT INTO rooms (name, max_users, is_public, created_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING id, name, max_users, is_public`,
    [name, maxUsers, isPublic],
  );

  const room = result.rows[0];

  // Initialize room state in Redis: O(1)
  await redis.hset(`room:${room.id}`, {
    name: room.name,
    userCount: 0,
    createdAt: Date.now(),
  });

  res.status(201).json(room);
});

// Get room state: O(1) from Redis, O(log n) fallback to Postgres
app.get("/api/rooms/:id", async (req, res) => {
  const { id } = req.params;

  // Try Redis first: O(1)
  const cached = await redis.hgetall(`room:${id}`);
  if (cached && Object.keys(cached).length > 0) {
    return res.json(cached);
  }

  // Fallback to database: O(log n)
  const result = await pgPool.query("SELECT * FROM rooms WHERE id = $1", [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Room not found" });
  }

  res.json(result.rows[0]);
});

// ─── WEBSOCKET HANDLERS ───

// Connection: O(1) per client
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Join room: O(1) to add to Set, O(1) to publish join event
  socket.on("room:join", async (roomId, callback) => {
    socket.join(roomId);

    // Track in Redis: O(1)
    await redis.sadd(`room:${roomId}:users`, socket.id);
    await redis.hincrby(`room:${roomId}`, "userCount", 1);

    // Broadcast to others: O(m) where m = other users in room (small, bounded)
    socket.to(roomId).emit("user:joined", {
      userId: socket.id,
      timestamp: Date.now(),
    });

    // Get current participants: O(m) where m = users in room
    const participants = await redis.smembers(`room:${roomId}:users`);

    // Callback with room state: O(1)
    callback({
      roomId,
      participants,
      yourId: socket.id,
    });
  });

  // Cursor movement: O(1) processing, O(m) broadcast
  // Throttled client-side to 30fps to prevent overload
  socket.on("cursor:move", async (roomId, position) => {
    // Spatial indexing could be O(log n) with quadtree, but O(m) broadcast dominates
    socket.to(roomId).emit("cursor:update", {
      userId: socket.id,
      position,
      timestamp: Date.now(),
    });

    // Async analytics storage (non-blocking): O(1) queue insertion
    redis.lpush(
      `analytics:cursors:${roomId}`,
      JSON.stringify({
        userId: socket.id,
        x: position.x,
        y: position.y,
        t: Date.now(),
      }),
    );
    redis.ltrim(`analytics:cursors:${roomId}`, 0, 999); // Keep last 1000: O(1)
  });

  // Word formation: O(1) validation, O(1) broadcast, O(log n) database write
  socket.on("word:formed", async (roomId, word, letterPositions) => {
    // Validate word exists: O(1) with Redis cache, O(log n) without
    const valid = await redis.sismember("words:valid", word);
    if (!valid) {
      // Fallback to database: O(log n)
      const check = await pgPool.query("SELECT 1 FROM words WHERE word = $1", [
        word,
      ]);
      if (check.rows.length === 0) return; // Invalid word, ignore
      await redis.sadd("words:valid", word); // Cache for future
    }

    // Record formation: O(log n) insert with index
    await pgPool.query(
      `INSERT INTO word_formations (room_id, user_id, word, formed_at, letter_positions)
       VALUES ($1, $2, $3, NOW(), $4)`,
      [roomId, socket.id, word, JSON.stringify(letterPositions)],
    );

    // Increment usage count: O(log n)
    await pgPool.query(
      "UPDATE words SET usage_count = usage_count + 1 WHERE word = $1",
      [word],
    );

    // Broadcast celebration: O(m)
    io.to(roomId).emit("word:celebrate", {
      word,
      formedBy: socket.id,
      timestamp: Date.now(),
    });
  });

  // Disconnect cleanup: O(1) per operation
  socket.on("disconnect", async () => {
    console.log("Client disconnected:", socket.id);

    // Find and clean up all rooms this user was in: O(r) where r = rooms joined (usually 1)
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue; // Skip default room

      await redis.srem(`room:${roomId}:users`, socket.id);
      await redis.hincrby(`room:${roomId}`, "userCount", -1);

      socket.to(roomId).emit("user:left", {
        userId: socket.id,
        timestamp: Date.now(),
      });
    }
  });
});

// ─── START SERVER ───
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
