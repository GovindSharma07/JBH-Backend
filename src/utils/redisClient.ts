// src/utils/redisClient.ts
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL!,
  // Fix for ECONNRESET: Keep connection alive
  pingInterval: 10000, // Ping every 10 seconds
  socket: {
    keepAlive: true,
    keepAliveInitialDelay:30000, // TCP KeepAlive every 30 seconds
    connectTimeout: 50000, // Give it more time to connect
  }
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

// Connect immediately when the app starts
(async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("Connected to Redis");
  }
})();

export default redisClient;