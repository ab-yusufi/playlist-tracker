import mongoose from "mongoose";

const playlistVideoSchema = new mongoose.Schema(
  {
    playlistItemId: {
      type: String,
      required: true,
      trim: true,
    },

    youtubeVideoId: {
      type: String,
      default: null,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    thumbnailUrl: {
      type: String,
      default: null,
      trim: true,
    },

    position: {
      type: Number,
      required: true,
      min: 0,
    },

    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },

    isEmbeddable: {
      type: Boolean,
      default: true,
    },

    unavailableReason: {
      type: String,
      default: null,
      trim: true,
    },

    isCompleted: {
      type: Boolean,
      default: false,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    lastPositionSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastWatchedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  },
);

const playlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
      index: true,
    },

    youtubePlaylistId: {
      type: String,
      required: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    thumbnailUrl: {
      type: String,
      default: null,
      trim: true,
    },

    channelTitle: {
      type: String,
      default: null,
      trim: true,
    },

    youtubeItemCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    videos: {
      type: [playlistVideoSchema],
      default: [],
    },

    lastVideoPlaylistItemId: {
      type: String,
      default: null,
    },

    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

playlistSchema.index(
  {
    user: 1,
    youtubePlaylistId: 1,
  },
  {
    unique: true,
  },
);

playlistSchema.index({
  user: 1,
  updatedAt: -1,
});

const Playlist = mongoose.model("Playlist", playlistSchema);

export default Playlist;
