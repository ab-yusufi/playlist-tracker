import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import authRouter from "./routes/auth.routes.js";
import playlistRouter from "./routes/playlist.routes.js";
import groupRouter from "./routes/group.routes.js";

const currentFilePath = fileURLToPath(import.meta.url);

const currentDirectory = path.dirname(currentFilePath);

const clientDistPath = path.resolve(currentDirectory, "../../client/dist");

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: ["'self'", "https://www.youtube.com", "https://s.ytimg.com"],

        frameSrc: [
          "'self'",
          "https://www.youtube.com",
          "https://www.youtube-nocookie.com",
        ],

        imgSrc: [
          "'self'",
          "data:",
          "https://i.ytimg.com",
          "https://yt3.ggpht.com",
        ],

        connectSrc: ["'self'", "https://www.youtube.com"],

        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);

const clientOrigin =
  process.env.CLIENT_ORIGIN ||
  process.env.RENDER_EXTERNAL_URL ||
  "http://localhost:5173";

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  }),
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(cookieParser());

app.get("/api/health", (_request, response) => {
  response.status(200).json({
    success: true,
    message: "Playlist Tracker API is running",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRouter);
app.use("/api/groups", groupRouter);
app.use("/api/playlists", playlistRouter);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(clientDistPath));

  app.get("*", (request, response, next) => {
    if (request.path.startsWith("/api/")) {
      return next();
    }

    return response.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
