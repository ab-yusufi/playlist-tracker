import { useEffect, useMemo, useRef, useState } from "react";

import { Link, useParams } from "react-router";

import { apiRequest } from "../api/http.js";
import AppHeader from "../components/AppHeader.jsx";
import YouTubePlayer from "../components/YouTubePlayer.jsx";

import {
  clampPercentage,
  formatContentDuration,
  formatVideoDuration,
} from "../utils/duration.js";

function PlaylistPageLoader() {
  return (
    <main className="playlist-page-status">
      <span className="spinner" aria-hidden="true" />

      <p>Loading playlist…</p>
    </main>
  );
}

function PlaylistError({ message, onRetry }) {
  return (
    <main className="playlist-page-status">
      <div className="form-error" role="alert">
        {message}
      </div>

      <div className="status-actions">
        <button className="secondary-button" type="button" onClick={onRetry}>
          Try again
        </button>

        <Link className="text-link" to="/">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}

function VideoThumbnail({ video }) {
  if (!video.thumbnailUrl) {
    return (
      <div
        className="video-thumbnail video-thumbnail-fallback"
        aria-hidden="true"
      >
        ▶
      </div>
    );
  }

  return (
    <div className="video-thumbnail-wrapper">
      <img
        className="video-thumbnail"
        src={video.thumbnailUrl}
        alt=""
        loading="lazy"
      />

      {video.durationSeconds > 0 && (
        <span className="video-duration-badge">
          {formatVideoDuration(video.durationSeconds)}
        </span>
      )}
    </div>
  );
}

function VideoStatus({ video }) {
  if (!video.isPlayable) {
    return <span className="video-status unavailable">Unavailable</span>;
  }

  if (video.isCompleted) {
    return <span className="video-status completed">Completed</span>;
  }

  return <span className="video-status pending">Not completed</span>;
}

function VideoRow({
  video,
  index,
  isCurrent,
  isUpdating,
  isAnyVideoUpdating,
  onSelect,
  onToggleCompletion,
}) {
  const youtubeUrl = video.youtubeVideoId
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(
        video.youtubeVideoId,
      )}`
    : null;

  return (
    <article
      className={[
        "video-row",

        !video.isPlayable ? "video-row-unavailable" : "",

        video.isCompleted ? "video-row-completed" : "",

        isCurrent ? "video-row-current" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-current={isCurrent ? "true" : undefined}
    >
      <div className="video-position">
        {video.isCompleted ? "✓" : index + 1}
      </div>

      <VideoThumbnail video={video} />

      <div className="video-row-content">
        <div className="video-title-row">
          <div className="video-title-content">
            {isCurrent && (
              <span className="now-playing-label">Now playing</span>
            )}

            <h3>{video.title}</h3>
          </div>

          <div className="video-title-actions">
            <VideoStatus video={video} />

            {video.isPlayable && (
              <>
                <button
                  className={[
                    "watch-video-button",

                    isCurrent ? "watch-video-button-current" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  onClick={() => onSelect(video)}
                  disabled={isAnyVideoUpdating}
                >
                  {isCurrent ? "Play" : "Watch"}
                </button>

                <button
                  className={[
                    "completion-button",

                    video.isCompleted ? "completion-button-completed" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  onClick={() => {
                    onToggleCompletion(video);
                  }}
                  disabled={isAnyVideoUpdating}
                  aria-pressed={video.isCompleted}
                >
                  {isUpdating
                    ? "Saving…"
                    : video.isCompleted
                      ? "Mark incomplete"
                      : "Mark completed"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="video-meta-row">
          <span>{formatVideoDuration(video.durationSeconds)}</span>

          {!video.isPlayable && video.unavailableReason && (
            <span className="video-unavailable-reason">
              {video.unavailableReason}
            </span>
          )}

          {!video.isPlayable && youtubeUrl && (
            <a
              className="text-link"
              href={youtubeUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open on YouTube
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function chooseInitialVideo(playlist) {
  const videos = playlist?.videos || [];

  /*
   * Resume the previous video only when
   * it is still playable and incomplete.
   */
  const lastIncompleteVideo = videos.find(
    (video) =>
      video.id === playlist.lastVideoPlaylistItemId &&
      video.isPlayable &&
      !video.isCompleted,
  );

  if (lastIncompleteVideo) {
    return lastIncompleteVideo;
  }

  const firstIncompleteVideo = videos.find(
    (video) => video.isPlayable && !video.isCompleted,
  );

  if (firstIncompleteVideo) {
    return firstIncompleteVideo;
  }

  /*
   * The entire playlist may already be
   * completed. In that case, select the
   * last watched video for review.
   */
  const lastPlayableVideo = videos.find(
    (video) =>
      video.id === playlist.lastVideoPlaylistItemId && video.isPlayable,
  );

  if (lastPlayableVideo) {
    return lastPlayableVideo;
  }

  return videos.find((video) => video.isPlayable) || null;
}

function findNextPlayableVideo(videos, currentVideoId) {
  const currentIndex = videos.findIndex((video) => video.id === currentVideoId);

  if (currentIndex === -1) {
    return videos.find((video) => video.isPlayable) || null;
  }

  return (
    videos.slice(currentIndex + 1).find((video) => video.isPlayable) || null
  );
}

function formatLastSyncedAt(value) {
  if (!value) {
    return "Not yet synced";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

function createRefreshMessage(summary) {
  if (!summary) {
    return "Playlist refreshed.";
  }

  const changes = [];

  if (summary.addedVideos > 0) {
    changes.push(`${summary.addedVideos} added`);
  }

  if (summary.removedVideos > 0) {
    changes.push(`${summary.removedVideos} removed`);
  }

  if (summary.reorderedVideos > 0) {
    changes.push(`${summary.reorderedVideos} reordered`);
  }

  if (summary.availabilityChanges > 0) {
    changes.push(`${summary.availabilityChanges} availability changes`);
  }

  if (summary.metadataChanges > 0) {
    changes.push(`${summary.metadataChanges} metadata updates`);
  }

  if (changes.length === 0) {
    return "Playlist is already up to date.";
  }

  return `Updated: ${changes.join(", ")}.`;
}

export default function PlaylistPage() {
  const { playlistId } = useParams();

  const playerSectionRef = useRef(null);

  const playlistRef = useRef(null);

  const progressQueuesRef = useRef(new Map());

  const lastQueuedPositionRef = useRef(new Map());
  const [playlist, setPlaylist] = useState(null);

  const [isLoading, setIsLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  const [updatingVideoId, setUpdatingVideoId] = useState(null);

  const [progressError, setProgressError] = useState("");

  const [currentVideoId, setCurrentVideoId] = useState(null);

  const [autoplayRequest, setAutoplayRequest] = useState(0);

  const [isAdvancing, setIsAdvancing] = useState(false);

  const [playerError, setPlayerError] = useState("");

  const [playbackNotice, setPlaybackNotice] = useState("");

  const [playbackSaveError, setPlaybackSaveError] = useState("");

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [refreshMessage, setRefreshMessage] = useState("");

  const [refreshError, setRefreshError] = useState("");

  async function handleRefreshPlaylist() {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setRefreshMessage("");
    setRefreshError("");

    try {
      const data = await apiRequest(`/playlists/${playlistId}/refresh`, {
        method: "POST",
      });

      setPlaylist(data.playlist);

      setRefreshMessage(createRefreshMessage(data.summary));

      setPlayerError("");
      setProgressError("");
      setPlaybackSaveError("");
      setPlaybackNotice("");
    } catch (error) {
      setRefreshError(error.message || "Unable to refresh the playlist.");
    } finally {
      setIsRefreshing(false);
    }
  }
  useEffect(() => {
    const abortController = new AbortController();

    async function loadPlaylist() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const data = await apiRequest(`/playlists/${playlistId}`, {
          signal: abortController.signal,
        });

        setPlaylist(data.playlist);
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        setErrorMessage(error.message || "Unable to load the playlist.");
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadPlaylist();

    return () => {
      abortController.abort();
    };
  }, [playlistId, reloadKey]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);
  const sortedVideos = useMemo(() => {
    if (!playlist?.videos) {
      return [];
    }

    return [...playlist.videos].sort(
      (firstVideo, secondVideo) => firstVideo.position - secondVideo.position,
    );
  }, [playlist]);

  const currentVideo = useMemo(
    () => sortedVideos.find((video) => video.id === currentVideoId) || null,

    [sortedVideos, currentVideoId],
  );

  useEffect(() => {
    if (!playlist) {
      return;
    }

    setCurrentVideoId((existingVideoId) => {
      const existingVideo = playlist.videos.find(
        (video) => video.id === existingVideoId && video.isPlayable,
      );

      if (existingVideo) {
        return existingVideoId;
      }

      return chooseInitialVideo(playlist)?.id || null;
    });
  }, [playlist]);

  async function persistCompletion(video, isCompleted) {
    const encodedVideoId = encodeURIComponent(video.id);

    const data = await apiRequest(
      `/playlists/${playlistId}/videos/${encodedVideoId}/completion`,
      {
        method: "PATCH",

        json: {
          isCompleted,
        },
      },
    );

    setPlaylist((currentPlaylist) => {
      if (!currentPlaylist) {
        return currentPlaylist;
      }

      return {
        ...currentPlaylist,

        stats: data.stats || currentPlaylist.stats,

        updatedAt: data.updatedAt || currentPlaylist.updatedAt,

        videos: currentPlaylist.videos.map((currentPlaylistVideo) =>
          currentPlaylistVideo.id === data.video.id
            ? data.video
            : currentPlaylistVideo,
        ),
      };
    });

    return data;
  }

  function applyProgressResponse(data) {
    setPlaylist((currentPlaylist) => {
      if (!currentPlaylist) {
        return currentPlaylist;
      }

      return {
        ...currentPlaylist,

        lastVideoPlaylistItemId:
          data.lastVideoPlaylistItemId ||
          currentPlaylist.lastVideoPlaylistItemId,

        updatedAt: data.updatedAt || currentPlaylist.updatedAt,

        videos: currentPlaylist.videos.map((currentVideo) =>
          currentVideo.id === data.video.id ? data.video : currentVideo,
        ),
      };
    });
  }

  async function savePlaybackProgress(video, { positionSeconds, keepalive }) {
    const encodedVideoId = encodeURIComponent(video.id);

    const data = await apiRequest(
      `/playlists/${playlistId}/videos/${encodedVideoId}/progress`,
      {
        method: "PATCH",
        keepalive: Boolean(keepalive),

        json: {
          positionSeconds,
        },
      },
    );

    /*
     * During page exit, avoid attempting
     * React state updates after navigation.
     */
    if (!keepalive) {
      applyProgressResponse(data);
      setPlaybackSaveError("");
    }
  }

  function handlePlaybackProgress(progress) {
    const currentPlaylist = playlistRef.current;

    const video = currentPlaylist?.videos.find(
      (playlistVideo) => playlistVideo.id === progress.videoKey,
    );

    if (!video?.isPlayable) {
      return;
    }

    const positionSeconds = Math.max(
      0,
      Math.floor(Number(progress.positionSeconds) || 0),
    );

    const lastQueuedPosition = lastQueuedPositionRef.current.get(video.id);

    /*
     * The player already calls us only every
     * 10 seconds, but this avoids duplicate
     * interval writes at effectively the same
     * timestamp.
     */
    if (
      progress.reason === "interval" &&
      Number.isFinite(lastQueuedPosition) &&
      Math.abs(positionSeconds - lastQueuedPosition) < 5
    ) {
      return;
    }

    lastQueuedPositionRef.current.set(video.id, positionSeconds);

    const requestPayload = {
      positionSeconds,
      keepalive: Boolean(progress.keepalive),
    };

    /*
     * Exit saves should begin immediately
     * rather than waiting behind the normal
     * per-video request queue.
     */
    if (progress.keepalive) {
      void savePlaybackProgress(video, requestPayload).catch(() => {
        /*
         * Page-exit saves are best effort.
         * There may no longer be a visible
         * interface in which to show an error.
         */
      });

      return;
    }

    const existingQueue =
      progressQueuesRef.current.get(video.id) || Promise.resolve();

    const nextRequest = existingQueue
      .catch(() => {
        /*
         * A previous failure should not block
         * later playback saves.
         */
      })
      .then(() => savePlaybackProgress(video, requestPayload))
      .catch((error) => {
        setPlaybackSaveError(
          error.message || "Unable to save your playback position.",
        );
      });

    progressQueuesRef.current.set(video.id, nextRequest);

    void nextRequest.finally(() => {
      if (progressQueuesRef.current.get(video.id) === nextRequest) {
        progressQueuesRef.current.delete(video.id);
      }
    });
  }

  async function handleToggleCompletion(video) {
    if (updatingVideoId || isAdvancing || !video.isPlayable) {
      return;
    }

    setProgressError("");
    setUpdatingVideoId(video.id);

    try {
      await persistCompletion(video, !video.isCompleted);
    } catch (error) {
      setProgressError(error.message || "Unable to update the video.");
    } finally {
      setUpdatingVideoId(null);
    }
  }

  function playVideo(video) {
    if (!video?.isPlayable || isAdvancing) {
      return;
    }

    setCurrentVideoId(video.id);

    setAutoplayRequest((currentRequest) => currentRequest + 1);

    setPlayerError("");
    setPlaybackNotice("");
  }

  function handleSelectVideo(video) {
    playVideo(video);

    window.requestAnimationFrame(() => {
      playerSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function handlePlayNext() {
    if (!currentVideo) {
      return;
    }

    const nextVideo = findNextPlayableVideo(sortedVideos, currentVideo.id);

    if (!nextVideo) {
      setPlaybackNotice("There are no more playable videos in this playlist.");

      return;
    }

    playVideo(nextVideo);
  }

  async function handleVideoEnded({ videoKey }) {
    if (isAdvancing || updatingVideoId) {
      return;
    }

    /*
     * Ignore an old player's ended event if
     * the user has already selected another
     * video.
     */
    if (videoKey !== currentVideoId) {
      return;
    }

    const endedVideo = sortedVideos.find((video) => video.id === videoKey);

    if (!endedVideo) {
      return;
    }

    const nextVideo = findNextPlayableVideo(sortedVideos, endedVideo.id);

    setIsAdvancing(true);
    setProgressError("");
    setPlaybackNotice("");

    try {
      if (!endedVideo.isCompleted) {
        setUpdatingVideoId(endedVideo.id);

        await persistCompletion(endedVideo, true);
      }

      if (nextVideo) {
        setCurrentVideoId(nextVideo.id);

        setAutoplayRequest((currentRequest) => currentRequest + 1);
      } else {
        setPlaybackNotice("You reached the end of the playlist.");
      }
    } catch (error) {
      setProgressError(
        error.message ||
          "The video ended, but its progress could not be saved.",
      );
    } finally {
      setUpdatingVideoId(null);
      setIsAdvancing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="app-shell">
        <AppHeader />
        <PlaylistPageLoader />
      </div>
    );
  }

  if (errorMessage || !playlist) {
    return (
      <div className="app-shell">
        <AppHeader />

        <PlaylistError
          message={errorMessage || "Playlist not found."}
          onRetry={() => {
            setReloadKey((currentKey) => currentKey + 1);
          }}
        />
      </div>
    );
  }

  const stats = playlist.stats || {};

  const progressPercentage = clampPercentage(stats.progressPercentage);

  const isAnyVideoUpdating = Boolean(updatingVideoId) || isAdvancing;

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="playlist-page">
        <Link className="back-link" to="/">
          ← Back to dashboard
        </Link>

        <section className="playlist-hero">
          {playlist.thumbnailUrl ? (
            <img
              className="playlist-hero-thumbnail"
              src={playlist.thumbnailUrl}
              alt=""
            />
          ) : (
            <div
              className="playlist-hero-thumbnail playlist-thumbnail-fallback"
              aria-hidden="true"
            >
              ▶
            </div>
          )}

          <div className="playlist-hero-content">
            <p className="eyebrow">YouTube playlist</p>

            <h1>{playlist.title}</h1>

            {playlist.channelTitle && (
              <p className="playlist-hero-channel">{playlist.channelTitle}</p>
            )}

            <div className="playlist-sync-row">
              <span>
                Last synced: {formatLastSyncedAt(playlist.lastSyncedAt)}
              </span>

              <button
                className="secondary-button"
                type="button"
                onClick={handleRefreshPlaylist}
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing…" : "Refresh playlist"}
              </button>
            </div>

            {refreshMessage && (
              <div className="refresh-message" role="status">
                {refreshMessage}
              </div>
            )}

            {refreshError && (
              <div className="form-error refresh-error" role="alert">
                {refreshError}
              </div>
            )}

            <div className="playlist-hero-progress">
              <div className="playlist-progress-heading">
                <span>
                  {stats.completedVideos || 0} of {stats.totalVideos || 0}{" "}
                  videos
                </span>

                <strong>{progressPercentage}%</strong>
              </div>

              <div
                className="progress-track"
                role="progressbar"
                aria-label="Playlist progress"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={progressPercentage}
              >
                <div
                  className="progress-value"
                  style={{
                    width: `${progressPercentage}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        <section ref={playerSectionRef} className="playlist-player-section">
          {currentVideo ? (
            <>
              <YouTubePlayer
                videoId={currentVideo.youtubeVideoId}
                videoKey={currentVideo.id}
                title={currentVideo.title}
                startSeconds={
                  currentVideo.isCompleted
                    ? 0
                    : currentVideo.lastPositionSeconds || 0
                }
                autoplayRequest={autoplayRequest}
                onProgress={handlePlaybackProgress}
                onEnded={handleVideoEnded}
                onError={({ message }) => {
                  setPlayerError(message);
                }}
              />

              <div className="player-video-details">
                <div>
                  <p className="eyebrow">Currently selected</p>

                  <h2>{currentVideo.title}</h2>

                  <p>
                    Video{" "}
                    {sortedVideos.findIndex(
                      (video) => video.id === currentVideo.id,
                    ) + 1}{" "}
                    of {sortedVideos.length} ·{" "}
                    {formatVideoDuration(currentVideo.durationSeconds)}
                    {!currentVideo.isCompleted &&
                      currentVideo.lastPositionSeconds > 5 && (
                        <>
                          {" "}
                          · Saved at{" "}
                          {formatVideoDuration(
                            currentVideo.lastPositionSeconds,
                          )}
                        </>
                      )}
                  </p>
                </div>

                <div className="player-video-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={handlePlayNext}
                    disabled={isAdvancing}
                  >
                    Next video
                  </button>

                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      handleToggleCompletion(currentVideo);
                    }}
                    disabled={isAnyVideoUpdating}
                  >
                    {updatingVideoId === currentVideo.id
                      ? "Saving…"
                      : currentVideo.isCompleted
                        ? "Mark incomplete"
                        : "Mark completed"}
                  </button>
                </div>
              </div>

              {playerError && (
                <div className="form-error player-message" role="alert">
                  {playerError}
                </div>
              )}

              {playbackSaveError && (
                <div className="form-error player-message" role="alert">
                  {playbackSaveError}
                </div>
              )}

              {playbackNotice && (
                <div className="playback-notice" role="status">
                  {playbackNotice}
                </div>
              )}
            </>
          ) : (
            <div className="no-playable-videos">
              <h2>No playable videos</h2>

              <p>
                This playlist does not currently contain any videos that can be
                embedded.
              </p>
            </div>
          )}
        </section>

        <section
          className="playlist-stat-grid"
          aria-label="Playlist statistics"
        >
          <article>
            <span>Total content</span>
            <strong>{formatContentDuration(stats.totalDurationSeconds)}</strong>
          </article>

          <article>
            <span>Completed</span>
            <strong>
              {formatContentDuration(stats.completedDurationSeconds)}
            </strong>
          </article>

          <article>
            <span>Remaining</span>
            <strong>
              {formatContentDuration(stats.remainingDurationSeconds)}
            </strong>
          </article>

          <article>
            <span>Unavailable</span>
            <strong>{stats.unavailableVideos || 0}</strong>
          </article>
        </section>

        <section className="video-list-section">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Playlist contents</p>

              <h2>Videos</h2>
            </div>

            <span>{sortedVideos.length} imported</span>
          </div>

          {progressError && (
            <div className="video-action-error form-error" role="alert">
              {progressError}
            </div>
          )}

          {sortedVideos.length === 0 ? (
            <div className="empty-state">
              <h2>No videos found</h2>

              <p>This playlist currently has no accessible videos.</p>
            </div>
          ) : (
            <div className="video-list">
              {sortedVideos.map((video, index) => (
                <VideoRow
                  key={video.id}
                  video={video}
                  index={index}
                  isCurrent={video.id === currentVideoId}
                  isUpdating={updatingVideoId === video.id}
                  isAnyVideoUpdating={isAnyVideoUpdating}
                  onSelect={handleSelectVideo}
                  onToggleCompletion={handleToggleCompletion}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
