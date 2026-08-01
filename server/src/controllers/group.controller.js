import mongoose from "mongoose";
import { z } from "zod";

import Group from "../models/group.model.js";
import Playlist from "../models/playlist.model.js";
import AppError from "../utils/app-error.js";

const groupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Enter a group name")
      .max(60, "Group name must not exceed 60 characters"),
  })
  .strict();

function cleanGroupName(name) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeGroupName(name) {
  return cleanGroupName(name).toLowerCase();
}

function validateGroupId(groupId) {
  if (!mongoose.isValidObjectId(groupId)) {
    throw new AppError("Invalid group ID.", 400, "INVALID_GROUP_ID");
  }
}

function serializeGroup(group) {
  const plainGroup =
    typeof group.toObject === "function" ? group.toObject() : group;

  return {
    id: plainGroup._id.toString(),
    name: plainGroup.name,
    createdAt: plainGroup.createdAt,
    updatedAt: plainGroup.updatedAt,
  };
}

function sendGroupValidationError(response, validationResult) {
  return response.status(400).json({
    success: false,

    message: validationResult.error.issues[0]?.message || "Invalid group",

    errors: validationResult.error.flatten().fieldErrors,
  });
}

export async function listGroups(request, response, next) {
  try {
    const groups = await Group.find({
      user: request.user._id,
    })
      .sort({
        name: 1,
      })
      .lean();

    return response.status(200).json({
      success: true,

      groups: groups.map(serializeGroup),
    });
  } catch (error) {
    return next(error);
  }
}

export async function createGroup(request, response, next) {
  try {
    const validationResult = groupSchema.safeParse(request.body);

    if (!validationResult.success) {
      return sendGroupValidationError(response, validationResult);
    }

    const name = cleanGroupName(validationResult.data.name);

    const group = await Group.create({
      user: request.user._id,
      name,
      normalizedName: normalizeGroupName(name),
    });

    return response.status(201).json({
      success: true,
      message: "Group created successfully",
      group: serializeGroup(group),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({
        success: false,
        message: "You already have a group with this name.",
        code: "GROUP_ALREADY_EXISTS",
      });
    }

    return next(error);
  }
}

export async function renameGroup(request, response, next) {
  try {
    validateGroupId(request.params.groupId);

    const validationResult = groupSchema.safeParse(request.body);

    if (!validationResult.success) {
      return sendGroupValidationError(response, validationResult);
    }

    const name = cleanGroupName(validationResult.data.name);

    const group = await Group.findOneAndUpdate(
      {
        _id: request.params.groupId,
        user: request.user._id,
      },

      {
        $set: {
          name,
          normalizedName: normalizeGroupName(name),
        },
      },

      {
        new: true,
        runValidators: true,
      },
    );

    if (!group) {
      throw new AppError("Group not found.", 404, "GROUP_NOT_FOUND");
    }

    return response.status(200).json({
      success: true,
      message: "Group renamed successfully",
      group: serializeGroup(group),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({
        success: false,
        message: "You already have a group with this name.",
        code: "GROUP_ALREADY_EXISTS",
      });
    }

    return next(error);
  }
}

export async function deleteGroup(request, response, next) {
  try {
    validateGroupId(request.params.groupId);

    const group = await Group.findOne({
      _id: request.params.groupId,
      user: request.user._id,
    });

    if (!group) {
      throw new AppError("Group not found.", 404, "GROUP_NOT_FOUND");
    }

    const playlistUpdateResult = await Playlist.updateMany(
      {
        user: request.user._id,
        group: group._id,
      },

      {
        $set: {
          group: null,
        },
      },
    );

    await Group.deleteOne({
      _id: group._id,
      user: request.user._id,
    });

    return response.status(200).json({
      success: true,

      message: "Group deleted successfully",

      groupId: group._id.toString(),

      movedPlaylists: playlistUpdateResult.modifiedCount,
    });
  } catch (error) {
    return next(error);
  }
}
