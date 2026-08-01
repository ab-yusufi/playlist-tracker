import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Group name is required"],
      trim: true,
      maxlength: [60, "Group name must not exceed 60 characters"],
    },

    normalizedName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

groupSchema.index(
  {
    user: 1,
    normalizedName: 1,
  },
  {
    unique: true,
  },
);

const Group = mongoose.model("Group", groupSchema);

export default Group;
