import { Redis } from "@upstash/redis";

// Centralized Redis client for rate limiting and other operations
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

export default redis;