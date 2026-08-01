import "dotenv/config";

import app from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";

const port = Number.parseInt(process.env.PORT || "5000", 10);

let httpServer;
let isShuttingDown = false;

async function startServer() {
  try {
    await connectDatabase();

    httpServer = app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`\n${signal} received. Shutting down...`);

  const forceShutdownTimer = setTimeout(() => {
    console.error("Forced shutdown");
    process.exit(1);
  }, 10_000);

  forceShutdownTimer.unref();

  try {
    if (httpServer) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error("Shutdown error:", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  shutdown("uncaughtException");
});

startServer();
