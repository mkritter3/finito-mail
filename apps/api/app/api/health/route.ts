import { NextResponse } from "next/server";
import { dbPool as db } from "@/lib/db-pool";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const HEALTH_CHECK_WINDOW_MINUTES = 5;

export async function GET(request: Request) {
  // Check for health check API key
  const healthApiKey = request.headers.get("x-health-api-key");
  const expectedKey = process.env.HEALTH_API_KEY;

  if (!expectedKey || healthApiKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks: Array<{
    service: string;
    status: "healthy" | "degraded" | "unhealthy";
    latency?: number;
    error?: string;
  }> = [];

  // Check database connectivity (isolated check)
  try {
    const dbStart = Date.now();
    await db.query("SELECT 1 as health");
    const dbLatency = Date.now() - dbStart;
    
    checks.push({
      service: "database",
      status: "healthy", // Successful query execution is healthy
      latency: dbLatency,
    });
  } catch (error) {
    checks.push({
      service: "database",
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Database connection failed",
    });
  }

  // Check recent email sync activity (isolated check)
  try {
    const cutoffTime = new Date(Date.now() - HEALTH_CHECK_WINDOW_MINUTES * 60 * 1000);
    const recentActivity = await db.query(
      "SELECT created_at FROM emails WHERE created_at >= $1 LIMIT 1",
      [cutoffTime.toISOString()]
    );

    checks.push({
      service: "email_sync",
      status: (recentActivity.rowCount ?? 0) > 0 ? "healthy" : "degraded",
    });
  } catch (error) {
    checks.push({
      service: "email_sync",
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Email sync check failed",
    });
  }

  // Check Redis connectivity
  try {
    const redisStart = Date.now();
    await redis.ping();
    const redisLatency = Date.now() - redisStart;
    
    checks.push({
      service: "redis",
      status: "healthy",
      latency: redisLatency,
    });
  } catch (error) {
    checks.push({
      service: "redis",
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Redis connection failed",
    });
  }

  // Determine overall health status
  const hasUnhealthy = checks.some(check => check.status === "unhealthy");
  const hasDegraded = checks.some(check => check.status === "degraded");
  
  let overallStatus: "healthy" | "degraded" | "unhealthy";
  let statusCode: number;

  if (hasUnhealthy) {
    overallStatus = "unhealthy";
    statusCode = 503;
  } else if (hasDegraded) {
    overallStatus = "degraded";  
    statusCode = 200; // Still functional but monitoring should be aware
  } else {
    overallStatus = "healthy";
    statusCode = 200;
  }

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      uptime: process.uptime(),
      version: process.env.npm_package_version || "unknown",
    },
    { status: statusCode }
  );
}