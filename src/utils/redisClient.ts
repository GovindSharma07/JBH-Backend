// src/utils/redisClient.ts
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL!
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