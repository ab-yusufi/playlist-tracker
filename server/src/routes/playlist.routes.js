import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  addPlaylist,
  deletePlaylist,
  getPlaylist,
  listPlaylists,
  updatePlaylistGroup,
  refreshPlaylist,
  updateVideoCompletion,
  updateVideoProgress,
} from "../controllers/playlist.controller.js";
import { requireAuthentication } from "../middleware/auth.middleware.js";

const playlistRouter = Router();

const youtubeSyncLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many YouTube synchronization requests. Try again later.",
  },
});

playlistRouter.use(requireAuthentication);

playlistRouter.get("/", listPlaylists);

playlistRouter.post("/", youtubeSyncLimiter, addPlaylist);
playlistRouter.post(
  "/:playlistId/refresh",
  youtubeSyncLimiter,
  refreshPlaylist,
);

playlistRouter.get("/:playlistId", getPlaylist);
playlistRouter.patch("/:playlistId/group", updatePlaylistGroup);
playlistRouter.patch(
  "/:playlistId/videos/:playlistItemId/completion",
  updateVideoCompletion,
);
playlistRouter.patch(
  "/:playlistId/videos/:playlistItemId/progress",
  updateVideoProgress,
);

playlistRouter.delete("/:playlistId", deletePlaylist);

export default playlistRouter;
