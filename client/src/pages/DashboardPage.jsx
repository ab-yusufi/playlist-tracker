import { useEffect, useMemo, useState } from "react";

import { Link, useNavigate } from "react-router";

import { apiRequest } from "../api/http.js";
import AppHeader from "../components/AppHeader.jsx";

import { clampPercentage, formatContentDuration } from "../utils/duration.js";

function sortGroups(groups) {
  return [...groups].sort((first, second) =>
    first.name.localeCompare(second.name, undefined, {
      sensitivity: "base",
    }),
  );
}

function PlaylistThumbnail({ thumbnailUrl }) {
  if (!thumbnailUrl) {
    return (
      <div
        className="playlist-thumbnail playlist-thumbnail-fallback"
        aria-hidden="true"
      >
        ▶
      </div>
    );
  }

  return (
    <img
      className="playlist-thumbnail"
      src={thumbnailUrl}
      alt=""
      loading="lazy"
    />
  );
}

function PlaylistCard({
  playlist,
  groups,
  isDeleting,
  isMoving,
  onDelete,
  onMoveGroup,
}) {
  const stats = playlist.stats || {};

  const progressPercentage = clampPercentage(stats.progressPercentage);

  const currentGroupId = playlist.group?.id || "";

  return (
    <article className="playlist-card">
      <Link
        className="playlist-card-image-link"
        to={`/playlists/${playlist.id}`}
        aria-label={`Open ${playlist.title}`}
      >
        <PlaylistThumbnail thumbnailUrl={playlist.thumbnailUrl} />

        <span className="playlist-card-play">▶</span>
      </Link>

      <div className="playlist-card-content">
        <div className="playlist-card-heading">
          <div>
            <p className="playlist-group-label">
              {playlist.group?.name || "Ungrouped"}
            </p>

            <Link
              className="playlist-title-link"
              to={`/playlists/${playlist.id}`}
            >
              <h2>{playlist.title}</h2>
            </Link>

            {playlist.channelTitle && (
              <p className="playlist-channel">{playlist.channelTitle}</p>
            )}
          </div>

          <button
            className="icon-button danger-icon-button"
            type="button"
            onClick={() => onDelete(playlist)}
            disabled={isDeleting || isMoving}
            aria-label={`Remove ${playlist.title}`}
            title="Remove playlist"
          >
            {isDeleting ? "…" : "×"}
          </button>
        </div>

        <div className="playlist-group-control">
          <label htmlFor={`playlist-group-${playlist.id}`}>Group</label>

          <select
            id={`playlist-group-${playlist.id}`}
            value={currentGroupId}
            onChange={(event) => {
              onMoveGroup(playlist, event.target.value || null);
            }}
            disabled={isMoving || isDeleting}
          >
            <option value="">Ungrouped</option>

            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>

          {isMoving && (
            <span className="group-saving-label" aria-live="polite">
              Saving…
            </span>
          )}
        </div>

        <div className="playlist-progress-heading">
          <span>
            {stats.completedVideos || 0} of {stats.totalVideos || 0} videos
          </span>

          <strong>{progressPercentage}%</strong>
        </div>

        <div
          className="progress-track"
          role="progressbar"
          aria-label={`${playlist.title} progress`}
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

        <dl className="playlist-time-grid">
          <div>
            <dt>Total</dt>
            <dd>{formatContentDuration(stats.totalDurationSeconds)}</dd>
          </div>

          <div>
            <dt>Completed</dt>
            <dd>{formatContentDuration(stats.completedDurationSeconds)}</dd>
          </div>

          <div>
            <dt>Remaining</dt>
            <dd>{formatContentDuration(stats.remainingDurationSeconds)}</dd>
          </div>
        </dl>

        {stats.unavailableVideos > 0 && (
          <p className="playlist-warning">
            {stats.unavailableVideos} unavailable{" "}
            {stats.unavailableVideos === 1 ? "video" : "videos"} excluded
          </p>
        )}

        <Link
          className="primary-button playlist-open-button"
          to={`/playlists/${playlist.id}`}
        >
          {progressPercentage === 100
            ? "Review playlist"
            : playlist.lastVideoPlaylistItemId
              ? "Continue watching"
              : "Open playlist"}
        </Link>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const [playlists, setPlaylists] = useState([]);

  const [groups, setGroups] = useState([]);

  const [playlistUrl, setPlaylistUrl] = useState("");

  const [newGroupName, setNewGroupName] = useState("");

  const [selectedGroupFilter, setSelectedGroupFilter] = useState("all");

  const [isLoading, setIsLoading] = useState(true);

  const [isImporting, setIsImporting] = useState(false);

  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const [deletingPlaylistId, setDeletingPlaylistId] = useState(null);

  const [movingPlaylistId, setMovingPlaylistId] = useState(null);

  const [busyGroupId, setBusyGroupId] = useState(null);

  const [loadError, setLoadError] = useState("");

  const [importError, setImportError] = useState("");

  const [groupError, setGroupError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadDashboard() {
      setIsLoading(true);
      setLoadError("");

      try {
        const [playlistData, groupData] = await Promise.all([
          apiRequest("/playlists", {
            signal: abortController.signal,
          }),

          apiRequest("/groups", {
            signal: abortController.signal,
          }),
        ]);

        setPlaylists(playlistData.playlists || []);

        setGroups(sortGroups(groupData.groups || []));
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        setLoadError(error.message || "Unable to load your dashboard.");
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      abortController.abort();
    };
  }, [reloadKey]);

  const playlistSections = useMemo(() => {
    if (selectedGroupFilter === "ungrouped") {
      return [
        {
          id: "ungrouped",
          title: "Ungrouped",
          playlists: playlists.filter((playlist) => !playlist.group),
        },
      ];
    }

    if (selectedGroupFilter !== "all") {
      const selectedGroup = groups.find(
        (group) => group.id === selectedGroupFilter,
      );

      return [
        {
          id: selectedGroupFilter,

          title: selectedGroup?.name || "Group",

          playlists: playlists.filter(
            (playlist) => playlist.group?.id === selectedGroupFilter,
          ),
        },
      ];
    }

    const sections = [];

    for (const group of groups) {
      const groupedPlaylists = playlists.filter(
        (playlist) => playlist.group?.id === group.id,
      );

      if (groupedPlaylists.length > 0) {
        sections.push({
          id: group.id,
          title: group.name,
          playlists: groupedPlaylists,
        });
      }
    }

    const ungroupedPlaylists = playlists.filter((playlist) => !playlist.group);

    if (ungroupedPlaylists.length > 0) {
      sections.push({
        id: "ungrouped",
        title: "Ungrouped",
        playlists: ungroupedPlaylists,
      });
    }

    return sections;
  }, [playlists, groups, selectedGroupFilter]);

  async function handleAddPlaylist(event) {
    event.preventDefault();

    if (isImporting) {
      return;
    }

    const normalizedUrl = playlistUrl.trim();

    if (!normalizedUrl) {
      setImportError("Paste a YouTube playlist URL.");

      return;
    }

    setImportError("");
    setIsImporting(true);

    try {
      const data = await apiRequest("/playlists", {
        method: "POST",

        json: {
          playlistUrl: normalizedUrl,
        },
      });

      setPlaylistUrl("");

      navigate(`/playlists/${data.playlist.id}`);
    } catch (error) {
      if (error.status === 409 && error.data?.playlistId) {
        navigate(`/playlists/${error.data.playlistId}`);

        return;
      }

      setImportError(error.message || "Unable to import the playlist.");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleCreateGroup(event) {
    event.preventDefault();

    if (isCreatingGroup) {
      return;
    }

    const name = newGroupName.trim();

    if (!name) {
      setGroupError("Enter a group name.");

      return;
    }

    setGroupError("");
    setIsCreatingGroup(true);

    try {
      const data = await apiRequest("/groups", {
        method: "POST",

        json: {
          name,
        },
      });

      setGroups((currentGroups) => sortGroups([...currentGroups, data.group]));

      setNewGroupName("");
    } catch (error) {
      setGroupError(error.message || "Unable to create the group.");
    } finally {
      setIsCreatingGroup(false);
    }
  }

  async function handleRenameGroup(group) {
    if (busyGroupId) {
      return;
    }

    const newName = window.prompt("Rename group", group.name);

    if (newName === null) {
      return;
    }

    const normalizedName = newName.trim();

    if (!normalizedName || normalizedName === group.name) {
      return;
    }

    setGroupError("");
    setBusyGroupId(group.id);

    try {
      const data = await apiRequest(`/groups/${group.id}`, {
        method: "PATCH",

        json: {
          name: normalizedName,
        },
      });

      setGroups((currentGroups) =>
        sortGroups(
          currentGroups.map((currentGroup) =>
            currentGroup.id === data.group.id ? data.group : currentGroup,
          ),
        ),
      );

      setPlaylists((currentPlaylists) =>
        currentPlaylists.map((playlist) =>
          playlist.group?.id === data.group.id
            ? {
                ...playlist,

                group: {
                  id: data.group.id,

                  name: data.group.name,
                },
              }
            : playlist,
        ),
      );
    } catch (error) {
      setGroupError(error.message || "Unable to rename the group.");
    } finally {
      setBusyGroupId(null);
    }
  }

  async function handleDeleteGroup(group) {
    if (busyGroupId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${group.name}"?\n\n` +
        "Its playlists will remain and move to Ungrouped.",
    );

    if (!confirmed) {
      return;
    }

    setGroupError("");
    setBusyGroupId(group.id);

    try {
      await apiRequest(`/groups/${group.id}`, {
        method: "DELETE",
      });

      setGroups((currentGroups) =>
        currentGroups.filter((currentGroup) => currentGroup.id !== group.id),
      );

      setPlaylists((currentPlaylists) =>
        currentPlaylists.map((playlist) =>
          playlist.group?.id === group.id
            ? {
                ...playlist,
                group: null,
              }
            : playlist,
        ),
      );

      if (selectedGroupFilter === group.id) {
        setSelectedGroupFilter("ungrouped");
      }
    } catch (error) {
      setGroupError(error.message || "Unable to delete the group.");
    } finally {
      setBusyGroupId(null);
    }
  }

  async function handleMovePlaylist(playlist, groupId) {
    if (movingPlaylistId) {
      return;
    }

    const previousGroup = playlist.group;

    setLoadError("");
    setMovingPlaylistId(playlist.id);

    /*
     * Optimistic update makes the card move
     * immediately between dashboard sections.
     */
    const nextGroup = groupId
      ? groups.find((group) => group.id === groupId) || null
      : null;

    setPlaylists((currentPlaylists) =>
      currentPlaylists.map((currentPlaylist) =>
        currentPlaylist.id === playlist.id
          ? {
              ...currentPlaylist,

              group: nextGroup
                ? {
                    id: nextGroup.id,

                    name: nextGroup.name,
                  }
                : null,
            }
          : currentPlaylist,
      ),
    );

    try {
      const data = await apiRequest(`/playlists/${playlist.id}/group`, {
        method: "PATCH",

        json: {
          groupId,
        },
      });

      setPlaylists((currentPlaylists) =>
        currentPlaylists.map((currentPlaylist) =>
          currentPlaylist.id === data.playlist.id
            ? data.playlist
            : currentPlaylist,
        ),
      );
    } catch (error) {
      setPlaylists((currentPlaylists) =>
        currentPlaylists.map((currentPlaylist) =>
          currentPlaylist.id === playlist.id
            ? {
                ...currentPlaylist,
                group: previousGroup,
              }
            : currentPlaylist,
        ),
      );

      setLoadError(error.message || "Unable to move the playlist.");
    } finally {
      setMovingPlaylistId(null);
    }
  }

  async function handleDeletePlaylist(playlist) {
    if (deletingPlaylistId) {
      return;
    }

    const confirmed = window.confirm(
      `Remove "${playlist.title}"?\n\n` +
        "Its saved progress will also be deleted.",
    );

    if (!confirmed) {
      return;
    }

    setDeletingPlaylistId(playlist.id);

    setLoadError("");

    try {
      await apiRequest(`/playlists/${playlist.id}`, {
        method: "DELETE",
      });

      setPlaylists((currentPlaylists) =>
        currentPlaylists.filter(
          (currentPlaylist) => currentPlaylist.id !== playlist.id,
        ),
      );
    } catch (error) {
      setLoadError(error.message || "Unable to remove the playlist.");
    } finally {
      setDeletingPlaylistId(null);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="dashboard">
        <section className="dashboard-heading">
          <div>
            <p className="eyebrow">Your learning space</p>

            <h1>Your playlists</h1>

            <p>
              Keep every course in one place and continue without losing your
              progress.
            </p>
          </div>
        </section>

        <section
          className="add-playlist-panel"
          aria-labelledby="add-playlist-heading"
        >
          <div>
            <h2 id="add-playlist-heading">Add a playlist</h2>

            <p>Paste the URL of a public YouTube playlist.</p>
          </div>

          <form className="add-playlist-form" onSubmit={handleAddPlaylist}>
            <div className="playlist-url-field">
              <label className="visually-hidden" htmlFor="playlist-url">
                YouTube playlist URL
              </label>

              <input
                id="playlist-url"
                type="url"
                value={playlistUrl}
                onChange={(event) => {
                  setPlaylistUrl(event.target.value);

                  if (importError) {
                    setImportError("");
                  }
                }}
                placeholder="https://www.youtube.com/playlist?list=..."
                maxLength={2048}
                disabled={isImporting}
                required
              />

              <button
                className="primary-button add-playlist-button"
                type="submit"
                disabled={isImporting}
              >
                {isImporting ? "Importing…" : "Add playlist"}
              </button>
            </div>

            {isImporting && (
              <p className="form-help" aria-live="polite">
                Importing titles, durations, and availability.
              </p>
            )}

            {importError && (
              <div className="form-error" role="alert">
                {importError}
              </div>
            )}
          </form>
        </section>

        <section
          className="group-management-panel"
          aria-labelledby="groups-heading"
        >
          <div className="group-management-header">
            <div>
              <h2 id="groups-heading">Playlist groups</h2>

              <p>A playlist can belong to one group at a time.</p>
            </div>

            <form className="create-group-form" onSubmit={handleCreateGroup}>
              <label className="visually-hidden" htmlFor="new-group-name">
                New group name
              </label>

              <input
                id="new-group-name"
                type="text"
                value={newGroupName}
                onChange={(event) => {
                  setNewGroupName(event.target.value);

                  if (groupError) {
                    setGroupError("");
                  }
                }}
                placeholder="e.g. Web Development"
                maxLength={60}
                disabled={isCreatingGroup}
              />

              <button
                className="secondary-button"
                type="submit"
                disabled={isCreatingGroup}
              >
                {isCreatingGroup ? "Creating…" : "Create group"}
              </button>
            </form>
          </div>

          {groupError && (
            <div className="form-error group-error" role="alert">
              {groupError}
            </div>
          )}

          {groups.length > 0 && (
            <div className="group-list">
              {groups.map((group) => (
                <div className="group-list-item" key={group.id}>
                  <span>{group.name}</span>

                  <div>
                    <button
                      className="group-action-button"
                      type="button"
                      onClick={() => handleRenameGroup(group)}
                      disabled={Boolean(busyGroupId)}
                    >
                      {busyGroupId === group.id ? "Working…" : "Rename"}
                    </button>

                    <button
                      className="group-action-button group-delete-button"
                      type="button"
                      onClick={() => handleDeleteGroup(group)}
                      disabled={Boolean(busyGroupId)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {loadError && (
          <div className="dashboard-error">
            <div className="form-error" role="alert">
              {loadError}
            </div>

            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setReloadKey((currentKey) => currentKey + 1);
              }}
            >
              Try again
            </button>
          </div>
        )}

        {isLoading ? (
          <section className="dashboard-loading" aria-live="polite">
            <span className="spinner" aria-hidden="true" />

            <p>Loading your playlists…</p>
          </section>
        ) : playlists.length === 0 ? (
          <section className="empty-state">
            <div className="empty-state-icon" aria-hidden="true">
              ▶
            </div>

            <h2>No playlists yet</h2>

            <p>Paste your first public YouTube playlist URL above.</p>
          </section>
        ) : (
          <section className="playlist-section">
            <div className="section-heading-row playlist-filter-heading">
              <div>
                <h2>Saved playlists</h2>

                <span className="playlist-count">
                  {playlists.length}{" "}
                  {playlists.length === 1 ? "playlist" : "playlists"}
                </span>
              </div>

              <div className="group-filter">
                <label htmlFor="group-filter">Show</label>

                <select
                  id="group-filter"
                  value={selectedGroupFilter}
                  onChange={(event) => {
                    setSelectedGroupFilter(event.target.value);
                  }}
                >
                  <option value="all">All groups</option>

                  <option value="ungrouped">Ungrouped</option>

                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {playlistSections.every(
              (section) => section.playlists.length === 0,
            ) ? (
              <section className="empty-state filtered-empty-state">
                <h2>No playlists here</h2>

                <p>
                  Move a playlist into this group using the Group menu on its
                  card.
                </p>
              </section>
            ) : (
              <div className="playlist-group-sections">
                {playlistSections.map(
                  (section) =>
                    section.playlists.length > 0 && (
                      <section
                        className="playlist-group-section"
                        key={section.id}
                      >
                        <div className="playlist-group-section-heading">
                          <h3>{section.title}</h3>

                          <span>
                            {section.playlists.length}{" "}
                            {section.playlists.length === 1
                              ? "playlist"
                              : "playlists"}
                          </span>
                        </div>

                        <div className="playlist-grid">
                          {section.playlists.map((playlist) => (
                            <PlaylistCard
                              key={playlist.id}
                              playlist={playlist}
                              groups={groups}
                              isDeleting={deletingPlaylistId === playlist.id}
                              isMoving={movingPlaylistId === playlist.id}
                              onDelete={handleDeletePlaylist}
                              onMoveGroup={handleMovePlaylist}
                            />
                          ))}
                        </div>
                      </section>
                    ),
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
