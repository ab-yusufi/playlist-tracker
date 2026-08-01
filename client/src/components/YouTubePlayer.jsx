import { useEffect, useRef, useState } from "react";

let youtubeApiPromise = null;

const PROGRESS_INTERVAL_MS = 10_000;

function loadYouTubeIframeApi() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise((resolve, reject) => {
    let isSettled = false;

    const timeoutId = window.setTimeout(() => {
      if (isSettled) {
        return;
      }

      isSettled = true;

      reject(new Error("Unable to load the YouTube player API."));
    }, 15_000);

    function resolveApi() {
      if (isSettled) {
        return;
      }

      isSettled = true;
      window.clearTimeout(timeoutId);

      if (window.YT?.Player) {
        resolve(window.YT);
        return;
      }

      reject(new Error("The YouTube player API loaded incorrectly."));
    }

    const previousReadyHandler = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      try {
        previousReadyHandler?.();
      } finally {
        resolveApi();
      }
    };

    let script = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    if (!script) {
      script = document.createElement("script");

      script.src = "https://www.youtube.com/iframe_api";

      script.async = true;

      document.head.appendChild(script);
    }

    script.addEventListener(
      "error",
      () => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        window.clearTimeout(timeoutId);
        youtubeApiPromise = null;

        reject(new Error("Unable to load the YouTube player API."));
      },
      {
        once: true,
      },
    );
  }).catch((error) => {
    youtubeApiPromise = null;
    throw error;
  });

  return youtubeApiPromise;
}

function getPlayerErrorMessage(errorCode) {
  switch (errorCode) {
    case 2:
      return "The video ID is invalid.";

    case 5:
      return "This video cannot be played in the HTML5 player.";

    case 100:
      return "This video was removed or made private.";

    case 101:
    case 150:
      return "The video owner does not allow embedded playback.";

    default:
      return "The video could not be played.";
  }
}

function normalizeStartSeconds(value) {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds < 0) {
    return 0;
  }

  return Math.floor(seconds);
}

export default function YouTubePlayer({
  videoId,
  videoKey,
  title,
  startSeconds = 0,
  autoplayRequest = 0,
  onEnded,
  onError,
  onProgress,
}) {
  const mountElementRef = useRef(null);
  const playerRef = useRef(null);

  const isPlayerReadyRef = useRef(false);

  const progressIntervalRef = useRef(null);

  const videoIdRef = useRef(videoId);
  const videoKeyRef = useRef(videoKey);

  const startSecondsRef = useRef(normalizeStartSeconds(startSeconds));

  const autoplayRequestRef = useRef(autoplayRequest);

  const loadedVideoRef = useRef({
    videoId: null,
    videoKey: null,
  });

  const lastAutoplayRequestRef = useRef(-1);

  const lastEndedVideoKeyRef = useRef(null);

  const callbacksRef = useRef({
    onEnded,
    onError,
    onProgress,
  });

  const [isLoading, setIsLoading] = useState(true);

  const [loadError, setLoadError] = useState("");

  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);

  useEffect(() => {
    callbacksRef.current = {
      onEnded,
      onError,
      onProgress,
    };
  }, [onEnded, onError, onProgress]);

  function clearProgressInterval() {
    if (progressIntervalRef.current === null) {
      return;
    }

    window.clearInterval(progressIntervalRef.current);

    progressIntervalRef.current = null;
  }

  function emitProgress(reason, keepalive = false) {
    const player = playerRef.current;

    const { videoId: loadedVideoId, videoKey: loadedVideoKey } =
      loadedVideoRef.current;

    if (!player || !loadedVideoKey || !loadedVideoId) {
      return;
    }

    let currentTime;

    try {
      currentTime = player.getCurrentTime();
    } catch {
      return;
    }

    if (!Number.isFinite(currentTime)) {
      return;
    }

    callbacksRef.current.onProgress?.({
      videoKey: loadedVideoKey,
      youtubeVideoId: loadedVideoId,

      positionSeconds: Math.max(0, Math.floor(currentTime)),

      reason,
      keepalive,
    });
  }

  function startProgressInterval() {
    clearProgressInterval();

    progressIntervalRef.current = window.setInterval(() => {
      emitProgress("interval");
    }, PROGRESS_INTERVAL_MS);
  }

  useEffect(() => {
    const player = playerRef.current;

    const normalizedStartSeconds = normalizeStartSeconds(startSeconds);

    const previousLoadedVideo = loadedVideoRef.current;

    const videoChanged =
      previousLoadedVideo.videoId !== videoId ||
      previousLoadedVideo.videoKey !== videoKey;

    videoIdRef.current = videoId;
    videoKeyRef.current = videoKey;

    startSecondsRef.current = normalizedStartSeconds;

    autoplayRequestRef.current = autoplayRequest;

    if (!player || !isPlayerReadyRef.current || !videoId || !videoKey) {
      return;
    }

    const autoplayRequested =
      lastAutoplayRequestRef.current !== autoplayRequest;

    try {
      if (videoChanged) {
        /*
         * Save the previous video before
         * replacing it in the player.
         */
        emitProgress("video-change");

        clearProgressInterval();

        if (autoplayRequest > 0) {
          player.loadVideoById({
            videoId,
            startSeconds: normalizedStartSeconds,
          });
        } else {
          player.cueVideoById({
            videoId,
            startSeconds: normalizedStartSeconds,
          });
        }

        loadedVideoRef.current = {
          videoId,
          videoKey,
        };

        lastAutoplayRequestRef.current = autoplayRequest;

        lastEndedVideoKeyRef.current = null;

        setLoadError("");
        setIsAutoplayBlocked(false);

        return;
      }

      if (autoplayRequested) {
        player.playVideo();

        lastAutoplayRequestRef.current = autoplayRequest;
      }
    } catch (error) {
      console.error("Unable to change YouTube video:", error);

      setLoadError("Unable to load the selected video.");
    }
  }, [videoId, videoKey, startSeconds, autoplayRequest]);

  useEffect(() => {
    let isCancelled = false;
    let createdPlayer = null;

    async function createPlayer() {
      setIsLoading(true);
      setLoadError("");

      try {
        const YT = await loadYouTubeIframeApi();

        if (isCancelled || !mountElementRef.current) {
          return;
        }

        const initialVideoId = videoIdRef.current;

        const initialStartSeconds = startSecondsRef.current;

        createdPlayer = new YT.Player(mountElementRef.current, {
          width: "100%",
          height: "100%",

          videoId: initialVideoId,

          playerVars: {
            playsinline: 1,
            rel: 0,

            start: initialStartSeconds,

            origin: window.location.origin,
          },

          events: {
            onReady(event) {
              if (isCancelled) {
                event.target.destroy();
                return;
              }

              playerRef.current = event.target;

              isPlayerReadyRef.current = true;

              const currentVideoId = videoIdRef.current;

              const currentVideoKey = videoKeyRef.current;

              const currentStartSeconds = startSecondsRef.current;

              const currentAutoplayRequest = autoplayRequestRef.current;

              loadedVideoRef.current = {
                videoId: currentVideoId,
                videoKey: currentVideoKey,
              };

              if (currentVideoId) {
                if (currentAutoplayRequest > 0) {
                  event.target.loadVideoById({
                    videoId: currentVideoId,

                    startSeconds: currentStartSeconds,
                  });
                } else {
                  event.target.cueVideoById({
                    videoId: currentVideoId,

                    startSeconds: currentStartSeconds,
                  });
                }
              }

              lastAutoplayRequestRef.current = currentAutoplayRequest;

              setIsLoading(false);
            },

            onStateChange(event) {
              if (event.data === YT.PlayerState.PLAYING) {
                lastEndedVideoKeyRef.current = null;

                setIsAutoplayBlocked(false);
                setLoadError("");

                emitProgress("playing");
                startProgressInterval();

                return;
              }

              clearProgressInterval();

              if (event.data === YT.PlayerState.PAUSED) {
                emitProgress("pause");
                return;
              }

              if (event.data !== YT.PlayerState.ENDED) {
                return;
              }

              emitProgress("ended");

              const {
                videoId: endedYoutubeVideoId,

                videoKey: endedVideoKey,
              } = loadedVideoRef.current;

              if (
                !endedVideoKey ||
                lastEndedVideoKeyRef.current === endedVideoKey
              ) {
                return;
              }

              lastEndedVideoKeyRef.current = endedVideoKey;

              callbacksRef.current.onEnded?.({
                videoKey: endedVideoKey,

                youtubeVideoId: endedYoutubeVideoId,
              });
            },

            onError(event) {
              clearProgressInterval();

              const message = getPlayerErrorMessage(event.data);

              setLoadError(message);

              callbacksRef.current.onError?.({
                code: event.data,
                message,

                videoKey: loadedVideoRef.current.videoKey,
              });
            },

            onAutoplayBlocked() {
              setIsAutoplayBlocked(true);
            },
          },
        });

        playerRef.current = createdPlayer;
      } catch (error) {
        if (isCancelled) {
          return;
        }

        console.error("YouTube player failed:", error);

        setLoadError(error.message || "Unable to load the YouTube player.");

        setIsLoading(false);
      }
    }

    createPlayer();

    return () => {
      /*
       * This handles SPA navigation and React
       * component removal.
       */
      emitProgress("unmount", true);

      isCancelled = true;
      isPlayerReadyRef.current = false;

      clearProgressInterval();

      try {
        createdPlayer?.destroy();
      } catch (error) {
        console.error("Unable to destroy YouTube player:", error);
      }

      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        emitProgress("visibility-hidden", true);
      }
    }

    function handlePageHide() {
      emitProgress("pagehide", true);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  function handlePlayFallback() {
    try {
      playerRef.current?.playVideo();

      setIsAutoplayBlocked(false);
    } catch (error) {
      console.error("Unable to start playback:", error);

      setLoadError("Unable to start the video.");
    }
  }

  return (
    <div className="youtube-player-shell">
      <div
        ref={mountElementRef}
        className="youtube-player-mount"
        title={title}
      />

      {isLoading && (
        <div className="player-overlay" aria-live="polite">
          <span className="spinner" aria-hidden="true" />

          <span>Loading player…</span>
        </div>
      )}

      {!isLoading && loadError && (
        <div className="player-overlay player-error-overlay" role="alert">
          <strong>Playback unavailable</strong>

          <span>{loadError}</span>
        </div>
      )}

      {!loadError && isAutoplayBlocked && (
        <div className="player-autoplay-notice">
          <span>Your browser blocked automatic playback.</span>

          <button
            className="primary-button"
            type="button"
            onClick={handlePlayFallback}
          >
            Play video
          </button>
        </div>
      )}
    </div>
  );
}
