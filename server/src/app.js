import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import authRouter from "./routes/auth.routes.js";
import playlistRouter from "./routes/playlist.routes.js";
import groupRouter from "./routes/group.routes.js";

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
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

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
