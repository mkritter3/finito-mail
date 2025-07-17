import { db } from "./db-pool";
import { redis } from "./email-cache";

export class GracefulShutdown {
  private static instance: GracefulShutdown;
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;

  static getInstance(): GracefulShutdown {
    if (!GracefulShutdown.instance) {
      GracefulShutdown.instance = new GracefulShutdown();
    }
    return GracefulShutdown.instance;
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return this.shutdownPromise || Promise.resolve();
    }

    this.isShuttingDown = true;
    console.log("🔄 Starting graceful shutdown...");

    this.shutdownPromise = this.performShutdown();
    return this.shutdownPromise;
  }

  private async performShutdown(): Promise<void> {
    const shutdownTasks = [];

    // Close database connections
    shutdownTasks.push(
      this.closeDatabase().catch((error) => {
        console.error("❌ Error closing database connections:", error);
      })
    );

    // Close Redis connections
    shutdownTasks.push(
      this.closeRedis().catch((error) => {
        console.error("❌ Error closing Redis connections:", error);
      })
    );

    // Wait for all shutdown tasks with timeout
    try {
      await Promise.race([
        Promise.all(shutdownTasks),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Shutdown timeout")), 10000)
        ),
      ]);
      console.log("✅ Graceful shutdown completed successfully");
    } catch (error) {
      console.error("⚠️ Graceful shutdown completed with errors:", error);
    }
  }

  private async closeDatabase(): Promise<void> {
    try {
      await db.end();
      console.log("✅ Database connections closed");
    } catch (error) {
      console.error("❌ Error closing database:", error);
      throw error;
    }
  }

  private async closeRedis(): Promise<void> {
    try {
      // Redis client from @upstash/redis doesn't need explicit closing
      // as it uses HTTP requests, but we can clear any pending operations
      console.log("✅ Redis connections cleared");
    } catch (error) {
      console.error("❌ Error closing Redis:", error);
      throw error;
    }
  }

  isInShutdown(): boolean {
    return this.isShuttingDown;
  }
}

// Setup signal handlers for graceful shutdown
if (typeof process !== "undefined") {
  const gracefulShutdown = GracefulShutdown.getInstance();

  const handleShutdown = async (signal: string) => {
    console.log(`📡 Received ${signal}, initiating graceful shutdown...`);
    
    try {
      await gracefulShutdown.shutdown();
      process.exit(0);
    } catch (error) {
      console.error("💥 Force exit due to shutdown error:", error);
      process.exit(1);
    }
  };

  // Handle termination signals
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));

  // Handle uncaught exceptions and unhandled rejections
  process.on("uncaughtException", (error) => {
    console.error("💥 Uncaught Exception:", error);
    handleShutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
    handleShutdown("unhandledRejection");
  });
}

export default GracefulShutdown;