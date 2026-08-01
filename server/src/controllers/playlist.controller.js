import mongoose from "mongoose";
import { z } from "zod";

import Playlist from "../models/playlist.model.js";
import Group from "../models/group.model.js";
import {
  extractYoutubePlaylistId,
  fetchYoutubePlaylist,
} from "../services/youtube.service.js";
import AppError from "../utils/app-error.js";

const addPlaylistSchema = z.object({
  playlistUrl: z
    .string()
    .trim()
    .min(1, "Enter a YouTube playlist URL")
    .max(2048, "The playlist URL is too long"),
});
const updateVideoCompletionSchema = z
  .object({
    isCompleted: z.boolean(),
  })
  .strict();

const updatePlaybackProgressSchema = z
  .object({
    positionSeconds: z
      .number()
      .finite("Playback position must be a number")
      .min(0, "Playback position cannot be negative")
      .max(604_800, "Playback position is too large"),
  })
  .strict();
const updatePlaylistGroupSchema = z
  .object({
    groupId: z.union([z.string().trim().min(1, "Invalid group ID"), z.null()]),
  })
  .strict();

function isPlayableVideo(video) {
  return video.isAvailable && video.isEmbeddable;
}

function calculatePlaylistStats(videos) {
  const playableVideos = videos.filter(isPlayableVideo);

  const completedVideos = playableVideos.filter((video) => video.isCompleted);

  const totalDurationSeconds = playableVideos.reduce(
    (total, video) => total + (video.durationSeconds || 0),
    0,
  );

  const completedDurationSeconds = completedVideos.reduce(
    (total, video) => total + (video.durationSeconds || 0),
    0,
  );

  const totalVideos = playableVideos.length;
  const completedVideoCount = completedVideos.length;

  const progressPercentage =
    totalVideos === 0
      ? 0
      : Math.round((completedVideoCount / totalVideos) * 100);

  return {
    totalVideos,
    completedVideos: completedVideoCount,
    unavailableVideos: videos.length - playableVideos.length,

    progressPercentage,

    totalDurationSeconds,
    completedDurationSeconds,

    remainingDurationSeconds: Math.max(
      totalDurationSeconds - completedDurationSeconds,
      0,
    ),
  };
}

function serializeVideo(video) {
  const plainVideo =
    typeof video.toObject === "function" ? video.toObject() : video;

  return {
    id: plainVideo.playlistItemId,

    youtubeVideoId: plainVideo.youtubeVideoId,

    title: plainVideo.title,
    thumbnailUrl: plainVideo.thumbnailUrl,

    position: plainVideo.position,
    durationSeconds: plainVideo.durationSeconds,

    isAvailable: plainVideo.isAvailable,

    isEmbeddable: plainVideo.isEmbeddable,

    isPlayable: plainVideo.isAvailable && plainVideo.isEmbeddable,

    unavailableReason: plainVideo.unavailableReason,

    isCompleted: plainVideo.isCompleted,

    completedAt: plainVideo.completedAt,

    lastPositionSeconds: plainVideo.lastPositionSeconds,

    lastWatchedAt: plainVideo.lastWatchedAt,
  };
}

function serializePlaylistGroup(group) {
  if (!group) {
    return null;
  }

  /*
   * A populated group has `_id` and `name`.
   * An unpopulated group is only an ObjectId.
   */
  if (group._id && group.name) {
    return {
      id: group._id.toString(),
      name: group.name,
    };
  }

  return {
    id: group.toString(),
    name: null,
  };
}

function serializePlaylist(playlist, { includeVideos = false } = {}) {
  const plainPlaylist =
    typeof playlist.toObject === "function" ? playlist.toObject() : playlist;

  const videos = plainPlaylist.videos || [];

  const serializedPlaylist = {
    id: plainPlaylist._id.toString(),
    group: serializePlaylistGroup(plainPlaylist.group),

    youtubePlaylistId: plainPlaylist.youtubePlaylistId,

    title: plainPlaylist.title,
    thumbnailUrl: plainPlaylist.thumbnailUrl,
    channelTitle: plainPlaylist.channelTitle,

    youtubeItemCount: plainPlaylist.youtubeItemCount,

    lastVideoPlaylistItemId: plainPlaylist.lastVideoPlaylistItemId,

    lastSyncedAt: plainPlaylist.lastSyncedAt,
    createdAt: plainPlaylist.createdAt,
    updatedAt: plainPlaylist.updatedAt,

    stats: calculatePlaylistStats(videos),
  };

  if (includeVideos) {
    serializedPlaylist.videos = videos.map(serializeVideo);
  }

  return serializedPlaylist;
}

function validatePlaylistDocumentId(playlistId) {
  if (!mongoose.isValidObjectId(playlistId)) {
    throw new AppError(
      "Invalid playlist ID.",
      400,
      "INVALID_PLAYLIST_DOCUMENT_ID",
    );
  }
}

function validatePlaylistItemId(playlistItemId) {
  if (
    typeof playlistItemId !== "string" ||
    !playlistItemId.trim() ||
    playlistItemId.length > 200
  ) {
    throw new AppError("Invalid video ID.", 400, "INVALID_PLAYLIST_ITEM_ID");
  }

  return playlistItemId.trim();
}

function mergeRefreshedVideos(existingVideos, freshVideos) {
  const existingById = new Map(
    existingVideos.map((video) => [video.playlistItemId, video]),
  );

  const freshIds = new Set(freshVideos.map((video) => video.playlistItemId));

  const summary = {
    addedVideos: 0,
    removedVideos: 0,
    reorderedVideos: 0,
    availabilityChanges: 0,
    metadataChanges: 0,
  };

  const mergedVideos = freshVideos.map((freshVideo) => {
    const existingVideo = existingById.get(freshVideo.playlistItemId);

    if (!existingVideo) {
      summary.addedVideos += 1;

      return freshVideo;
    }

    if (existingVideo.position !== freshVideo.position) {
      summary.reorderedVideos += 1;
    }

    if (
      existingVideo.isAvailable !== freshVideo.isAvailable ||
      existingVideo.isEmbeddable !== freshVideo.isEmbeddable
    ) {
      summary.availabilityChanges += 1;
    }

    if (
      existingVideo.title !== freshVideo.title ||
      existingVideo.thumbnailUrl !== freshVideo.thumbnailUrl ||
      existingVideo.durationSeconds !== freshVideo.durationSeconds ||
      existingVideo.youtubeVideoId !== freshVideo.youtubeVideoId
    ) {
      summary.metadataChanges += 1;
    }

    const durationSeconds = Math.max(
      0,
      Number(freshVideo.durationSeconds) || 0,
    );

    const savedPosition = Math.max(
      0,
      Number(existingVideo.lastPositionSeconds) || 0,
    );

    const maximumPosition =
      durationSeconds > 0 ? Math.max(durationSeconds - 1, 0) : savedPosition;

    return {
      ...freshVideo,

      isCompleted: Boolean(existingVideo.isCompleted),

      completedAt: existingVideo.completedAt || null,

      lastPositionSeconds: Math.min(savedPosition, maximumPosition),

      lastWatchedAt: existingVideo.lastWatchedAt || null,
    };
  });

  summary.removedVideos = existingVideos.filter(
    (video) => !freshIds.has(video.playlistItemId),
  ).length;

  return {
    videos: mergedVideos,
    summary,
  };
}

function getValidLastVideoId(lastVideoPlaylistItemId, videos) {
  if (!lastVideoPlaylistItemId) {
    return null;
  }

  const lastVideo = videos.find(
    (video) => video.playlistItemId === lastVideoPlaylistItemId,
  );

  if (!lastVideo || !lastVideo.isAvailable || !lastVideo.isEmbeddable) {
    return null;
  }

  return lastVideoPlaylistItemId;
}

export async function addPlaylist(request, response, next) {
  try {
    const validationResult = addPlaylistSchema.safeParse(request.body);

    if (!validationResult.success) {
      return response.status(400).json({
        success: false,

        message:
          validationResult.error.issues[0]?.message || "Invalid playlist URL",

        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    const youtubePlaylistId = extractYoutubePlaylistId(
      validationResult.data.playlistUrl,
    );

    const existingPlaylist = await Playlist.findOne({
      user: request.user._id,
      youtubePlaylistId,
    }).select("_id");

    if (existingPlaylist) {
      return response.status(409).json({
        success: false,
        message: "You have already added this playlist.",
        code: "PLAYLIST_ALREADY_EXISTS",
        playlistId: existingPlaylist._id.toString(),
      });
    }

    const youtubePlaylist = await fetchYoutubePlaylist(youtubePlaylistId);

    const playlist = await Playlist.create({
      user: request.user._id,
      ...youtubePlaylist,
    });

    return response.status(201).json({
      success: true,
      message: "Playlist added successfully",
      playlist: serializePlaylist(playlist, {
        includeVideos: true,
      }),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({
        success: false,
        message: "You have already added this playlist.",
        code: "PLAYLIST_ALREADY_EXISTS",
      });
    }

    return next(error);
  }
}

export async function listPlaylists(request, response, next) {
  try {
    const playlists = await Playlist.find({
      user: request.user._id,
    })
      .populate({
        path: "group",
        select: "name",
      })
      .sort({
        updatedAt: -1,
      })
      .lean();

    return response.status(200).json({
      success: true,

      playlists: playlists.map((playlist) => serializePlaylist(playlist)),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getPlaylist(request, response, next) {
  try {
    validatePlaylistDocumentId(request.params.playlistId);

    const playlist = await Playlist.findOne({
      _id: request.params.playlistId,
      user: request.user._id,
    }).populate({
      path: "group",
      select: "name",
    });

    if (!playlist) {
      throw new AppError("Playlist not found.", 404, "PLAYLIST_NOT_FOUND");
    }

    return response.status(200).json({
      success: true,

      playlist: serializePlaylist(playlist, {
        includeVideos: true,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function deletePlaylist(request, response, next) {
  try {
    validatePlaylistDocumentId(request.params.playlistId);

    const playlist = await Playlist.findOneAndDelete({
      _id: request.params.playlistId,
      user: request.user._id,
    });

    if (!playlist) {
      throw new AppError("Playlist not found.", 404, "PLAYLIST_NOT_FOUND");
    }

    return response.status(200).json({
      success: true,
      message: "Playlist removed successfully",
      playlistId: playlist._id.toString(),
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateVideoCompletion(request, response, next) {
  try {
    validatePlaylistDocumentId(request.params.playlistId);

    const validationResult = updateVideoCompletionSchema.safeParse(
      request.body,
    );

    if (!validationResult.success) {
      return response.status(400).json({
        success: false,

        message:
          validationResult.error.issues[0]?.message ||
          "Invalid completion status",

        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    const playlistItemId = validatePlaylistItemId(
      request.params.playlistItemId,
    );

    const { isCompleted } = validationResult.data;

    const completedAt = isCompleted ? new Date() : null;

    /*
     * This query only updates videos that are
     * available and embeddable.
     *
     * The positional `$` operator identifies
     * the matching video inside the array.
     */
    const playlist = await Playlist.findOneAndUpdate(
      {
        _id: request.params.playlistId,
        user: request.user._id,

        videos: {
          $elemMatch: {
            playlistItemId,
            isAvailable: true,
            isEmbeddable: true,
          },
        },
      },

      {
        $set: {
          "videos.$.isCompleted": isCompleted,

          "videos.$.completedAt": completedAt,
        },
      },

      {
        new: true,
        runValidators: true,
      },
    );

    /*
     * A null result can mean:
     * - The playlist does not exist
     * - The video does not exist
     * - The video is unavailable
     *
     * Perform a small lookup so the client gets
     * an accurate error message.
     */
    if (!playlist) {
      const existingPlaylist = await Playlist.findOne({
        _id: request.params.playlistId,
        user: request.user._id,
      })
        .select(
          [
            "videos.playlistItemId",
            "videos.isAvailable",
            "videos.isEmbeddable",
          ].join(" "),
        )
        .lean();

      if (!existingPlaylist) {
        throw new AppError("Playlist not found.", 404, "PLAYLIST_NOT_FOUND");
      }

      const existingVideo = existingPlaylist.videos.find(
        (video) => video.playlistItemId === playlistItemId,
      );

      if (!existingVideo) {
        throw new AppError(
          "Video not found in this playlist.",
          404,
          "PLAYLIST_VIDEO_NOT_FOUND",
        );
      }

      throw new AppError(
        "Unavailable videos cannot be marked as completed.",
        409,
        "VIDEO_NOT_PLAYABLE",
      );
    }

    const updatedVideo = playlist.videos.find(
      (video) => video.playlistItemId === playlistItemId,
    );

    return response.status(200).json({
      success: true,

      message: isCompleted
        ? "Video marked as completed"
        : "Video marked as incomplete",

      video: serializeVideo(updatedVideo),

      stats: calculatePlaylistStats(playlist.videos),

      updatedAt: playlist.updatedAt,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateVideoProgress(request, response, next) {
  try {
    validatePlaylistDocumentId(request.params.playlistId);

    const playlistItemId = validatePlaylistItemId(
      request.params.playlistItemId,
    );

    const validationResult = updatePlaybackProgressSchema.safeParse(
      request.body,
    );

    if (!validationResult.success) {
      return response.status(400).json({
        success: false,

        message:
          validationResult.error.issues[0]?.message ||
          "Invalid playback position",

        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    const playlist = await Playlist.findOne({
      _id: request.params.playlistId,
      user: request.user._id,
    });

    if (!playlist) {
      throw new AppError("Playlist not found.", 404, "PLAYLIST_NOT_FOUND");
    }

    const video = playlist.videos.find(
      (playlistVideo) => playlistVideo.playlistItemId === playlistItemId,
    );

    if (!video) {
      throw new AppError(
        "Video not found in this playlist.",
        404,
        "PLAYLIST_VIDEO_NOT_FOUND",
      );
    }

    if (!video.isAvailable || !video.isEmbeddable) {
      throw new AppError(
        "Playback progress cannot be saved for an unavailable video.",
        409,
        "VIDEO_NOT_PLAYABLE",
      );
    }

    const requestedPosition = Math.floor(validationResult.data.positionSeconds);

    const durationSeconds = Math.max(0, Number(video.durationSeconds) || 0);

    /*
     * Keep the saved position slightly before
     * the actual end. Completed videos are handled
     * separately by the completion endpoint.
     *
     * Videos whose duration is unknown are allowed
     * to use the submitted position.
     */
    const maximumPosition =
      durationSeconds > 0
        ? Math.max(durationSeconds - 1, 0)
        : requestedPosition;

    const positionSeconds = Math.min(requestedPosition, maximumPosition);

    const watchedAt = new Date();

    video.lastPositionSeconds = positionSeconds;

    video.lastWatchedAt = watchedAt;

    playlist.lastVideoPlaylistItemId = video.playlistItemId;

    await playlist.save();

    return response.status(200).json({
      success: true,

      message: "Playback position saved",

      video: serializeVideo(video),

      lastVideoPlaylistItemId: playlist.lastVideoPlaylistItemId,

      updatedAt: playlist.updatedAt,
    });
  } catch (error) {
    return next(error);
  }
}

export async function refreshPlaylist(request, response, next) {
  try {
    validatePlaylistDocumentId(request.params.playlistId);

    /*
     * First retrieve only the YouTube playlist ID.
     * The API request may take several seconds for
     * a large playlist.
     */
    const playlistReference = await Playlist.findOne({
      _id: request.params.playlistId,
      user: request.user._id,
    })
      .select("youtubePlaylistId")
      .lean();

    if (!playlistReference) {
      throw new AppError("Playlist not found.", 404, "PLAYLIST_NOT_FOUND");
    }

    const refreshedYoutubePlaylist = await fetchYoutubePlaylist(
      playlistReference.youtubePlaylistId,
    );

    let updatedPlaylist = null;
    let refreshSummary = null;

    /*
     * Use an optimistic retry so a progress update
     * occurring while YouTube data is being fetched
     * is not silently overwritten.
     */
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const currentPlaylist = await Playlist.findOne({
        _id: request.params.playlistId,
        user: request.user._id,
      }).lean();

      if (!currentPlaylist) {
        throw new AppError("Playlist not found.", 404, "PLAYLIST_NOT_FOUND");
      }

      const mergedResult = mergeRefreshedVideos(
        currentPlaylist.videos || [],
        refreshedYoutubePlaylist.videos,
      );

      const lastVideoPlaylistItemId = getValidLastVideoId(
        currentPlaylist.lastVideoPlaylistItemId,

        mergedResult.videos,
      );

      updatedPlaylist = await Playlist.findOneAndUpdate(
        {
          _id: currentPlaylist._id,
          user: request.user._id,

          // Update only if no other request
          // changed the document meanwhile.
          updatedAt: currentPlaylist.updatedAt,
        },

        {
          $set: {
            title: refreshedYoutubePlaylist.title,

            thumbnailUrl: refreshedYoutubePlaylist.thumbnailUrl,

            channelTitle: refreshedYoutubePlaylist.channelTitle,

            youtubeItemCount: refreshedYoutubePlaylist.youtubeItemCount,

            videos: mergedResult.videos,

            lastVideoPlaylistItemId,

            lastSyncedAt: refreshedYoutubePlaylist.lastSyncedAt,
          },
        },

        {
          new: true,
          runValidators: true,
        },
      );

      if (updatedPlaylist) {
        refreshSummary = mergedResult.summary;

        break;
      }
    }

    if (!updatedPlaylist) {
      throw new AppError(
        "The playlist changed while it was refreshing. Try again.",
        409,
        "PLAYLIST_REFRESH_CONFLICT",
      );
    }

    return response.status(200).json({
      success: true,
      message: "Playlist refreshed successfully",

      summary: refreshSummary,

      playlist: serializePlaylist(updatedPlaylist, {
        includeVideos: true,
      }),
    });
  } catch (error) {
    return next(error);
  }
}
export async function updatePlaylistGroup(request, response, next) {
  try {
    validatePlaylistDocumentId(request.params.playlistId);

    const validationResult = updatePlaylistGroupSchema.safeParse(request.body);

    if (!validationResult.success) {
      return response.status(400).json({
        success: false,

        message:
          validationResult.error.issues[0]?.message ||
          "Invalid group selection",

        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    const { groupId } = validationResult.data;

    let selectedGroupId = null;

    if (groupId !== null) {
      if (!mongoose.isValidObjectId(groupId)) {
        throw new AppError("Invalid group ID.", 400, "INVALID_GROUP_ID");
      }

      const group = await Group.findOne({
        _id: groupId,
        user: request.user._id,
      })
        .select("_id")
        .lean();

      if (!group) {
        throw new AppError("Group not found.", 404, "GROUP_NOT_FOUND");
      }

      selectedGroupId = group._id;
    }

    const playlist = await Playlist.findOneAndUpdate(
      {
        _id: request.params.playlistId,
        user: request.user._id,
      },

      {
        $set: {
          group: selectedGroupId,
        },
      },

      {
        new: true,
        runValidators: true,
      },
    ).populate({
      path: "group",
      select: "name",
    });

    if (!playlist) {
      throw new AppError("Playlist not found.", 404, "PLAYLIST_NOT_FOUND");
    }

    return response.status(200).json({
      success: true,

      message: selectedGroupId
        ? "Playlist moved successfully"
        : "Playlist moved to Ungrouped",

      playlist: serializePlaylist(playlist),
    });
  } catch (error) {
    return next(error);
  }
}
