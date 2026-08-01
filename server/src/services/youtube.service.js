import AppError from "../utils/app-error.js";

const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";

const YOUTUBE_REQUEST_TIMEOUT_MS = 15_000;

function getApiKey() {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new AppError(
      "YOUTUBE_API_KEY is not configured",
      500,
      "YOUTUBE_API_KEY_MISSING",
    );
  }

  return apiKey;
}

function getYoutubeErrorReason(data) {
  return data?.error?.errors?.[0]?.reason || null;
}

function createYoutubeApiError(response, data) {
  const reason = getYoutubeErrorReason(data);

  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
    return new AppError(
      "The YouTube API quota has been exhausted. Try again later.",
      503,
      "YOUTUBE_QUOTA_EXCEEDED",
    );
  }

  if (reason === "keyInvalid" || reason === "accessNotConfigured") {
    return new AppError(
      "The YouTube API key is invalid or the API is not enabled.",
      502,
      "YOUTUBE_API_CONFIGURATION_ERROR",
    );
  }

  if (response.status === 404) {
    return new AppError(
      "The requested YouTube resource was not found.",
      404,
      "YOUTUBE_RESOURCE_NOT_FOUND",
    );
  }

  return new AppError(
    data?.error?.message || "YouTube could not process the request.",
    502,
    "YOUTUBE_API_ERROR",
  );
}

async function youtubeRequest(resource, parameters) {
  const url = new URL(`${YOUTUBE_API_BASE_URL}/${resource}`);

  const query = {
    ...parameters,
    key: getApiKey(),
  };

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const abortController = new AbortController();

  const timeout = setTimeout(() => {
    abortController.abort();
  }, YOUTUBE_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: abortController.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw createYoutubeApiError(response, data);
    }

    return data;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error.name === "AbortError") {
      throw new AppError(
        "The YouTube API request timed out.",
        504,
        "YOUTUBE_API_TIMEOUT",
      );
    }

    throw new AppError(
      "Unable to connect to the YouTube API.",
      502,
      "YOUTUBE_API_UNAVAILABLE",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function extractYoutubePlaylistId(playlistUrl) {
  if (typeof playlistUrl !== "string" || !playlistUrl.trim()) {
    throw new AppError(
      "Enter a YouTube playlist URL.",
      400,
      "PLAYLIST_URL_REQUIRED",
    );
  }

  const normalizedUrl = playlistUrl.trim();

  if (normalizedUrl.length > 2048) {
    throw new AppError(
      "The playlist URL is too long.",
      400,
      "INVALID_PLAYLIST_URL",
    );
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new AppError(
      "Enter a valid YouTube playlist URL.",
      400,
      "INVALID_PLAYLIST_URL",
    );
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  const allowedHosts = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
  ]);

  if (!allowedHosts.has(hostname)) {
    throw new AppError(
      "The URL must be a YouTube playlist URL.",
      400,
      "INVALID_PLAYLIST_URL",
    );
  }

  const playlistId = parsedUrl.searchParams.get("list");

  if (!playlistId) {
    throw new AppError(
      "The URL does not contain a YouTube playlist ID.",
      400,
      "PLAYLIST_ID_MISSING",
    );
  }

  if (!/^[A-Za-z0-9_-]{10,100}$/.test(playlistId)) {
    throw new AppError(
      "The YouTube playlist ID is invalid.",
      400,
      "INVALID_PLAYLIST_ID",
    );
  }

  return playlistId;
}

function getBestThumbnail(thumbnails) {
  if (!thumbnails) {
    return null;
  }

  const preferredSizes = ["maxres", "standard", "high", "medium", "default"];

  for (const size of preferredSizes) {
    const thumbnailUrl = thumbnails[size]?.url;

    if (thumbnailUrl) {
      return thumbnailUrl;
    }
  }

  return null;
}

function parseYoutubeDuration(duration) {
  if (typeof duration !== "string" || !duration.startsWith("P")) {
    return 0;
  }

  const match = duration.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/,
  );

  if (!match) {
    return 0;
  }

  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);

  return Math.round(days * 86_400 + hours * 3_600 + minutes * 60 + seconds);
}

async function fetchPlaylistMetadata(youtubePlaylistId) {
  const data = await youtubeRequest("playlists", {
    part: "snippet,contentDetails",
    id: youtubePlaylistId,
    maxResults: 1,
  });

  const playlist = data.items?.[0];

  if (!playlist) {
    throw new AppError(
      "Playlist not found. It may be private or inaccessible.",
      404,
      "PLAYLIST_NOT_ACCESSIBLE",
    );
  }

  return playlist;
}

async function fetchVideoDetails(videoIds) {
  if (videoIds.length === 0) {
    return new Map();
  }

  const uniqueVideoIds = [...new Set(videoIds)];

  const data = await youtubeRequest("videos", {
    part: "snippet,contentDetails,status",
    id: uniqueVideoIds.join(","),
  });

  return new Map((data.items || []).map((video) => [video.id, video]));
}

async function fetchAllPlaylistVideos(youtubePlaylistId) {
  const videos = [];

  let nextPageToken = null;

  do {
    const page = await youtubeRequest("playlistItems", {
      part: "snippet,contentDetails",
      playlistId: youtubePlaylistId,
      maxResults: 50,
      pageToken: nextPageToken,
    });

    const playlistItems = page.items || [];

    const videoIds = playlistItems
      .map(
        (item) =>
          item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
      )
      .filter(Boolean);

    const detailsById = await fetchVideoDetails(videoIds);

    for (const playlistItem of playlistItems) {
      const youtubeVideoId =
        playlistItem.contentDetails?.videoId ||
        playlistItem.snippet?.resourceId?.videoId ||
        null;

      const videoDetails = youtubeVideoId
        ? detailsById.get(youtubeVideoId)
        : null;

      const isAvailable = Boolean(videoDetails);

      const isEmbeddable =
        isAvailable && videoDetails.status?.embeddable !== false;

      let unavailableReason = null;

      if (!isAvailable) {
        unavailableReason = "Video is private, deleted, or unavailable.";
      } else if (!isEmbeddable) {
        unavailableReason = "The video owner has disabled embedded playback.";
      }

      videos.push({
        playlistItemId: playlistItem.id,

        youtubeVideoId,

        title:
          videoDetails?.snippet?.title ||
          playlistItem.snippet?.title ||
          "Unavailable video",

        thumbnailUrl:
          getBestThumbnail(videoDetails?.snippet?.thumbnails) ||
          getBestThumbnail(playlistItem.snippet?.thumbnails),

        position: playlistItem.snippet?.position ?? videos.length,

        durationSeconds: parseYoutubeDuration(
          videoDetails?.contentDetails?.duration,
        ),

        isAvailable,
        isEmbeddable,
        unavailableReason,

        isCompleted: false,
        completedAt: null,
        lastPositionSeconds: 0,
        lastWatchedAt: null,
      });
    }

    nextPageToken = page.nextPageToken || null;
  } while (nextPageToken);

  videos.sort(
    (firstVideo, secondVideo) => firstVideo.position - secondVideo.position,
  );

  return videos;
}

export async function fetchYoutubePlaylist(youtubePlaylistId) {
  const [playlistMetadata, videos] = await Promise.all([
    fetchPlaylistMetadata(youtubePlaylistId),
    fetchAllPlaylistVideos(youtubePlaylistId),
  ]);

  return {
    youtubePlaylistId,

    title: playlistMetadata.snippet?.title || "Untitled playlist",

    thumbnailUrl:
      getBestThumbnail(playlistMetadata.snippet?.thumbnails) ||
      videos.find((video) => video.thumbnailUrl)?.thumbnailUrl ||
      null,

    channelTitle: playlistMetadata.snippet?.channelTitle || null,

    youtubeItemCount:
      playlistMetadata.contentDetails?.itemCount ?? videos.length,

    videos,

    lastSyncedAt: new Date(),
  };
}
