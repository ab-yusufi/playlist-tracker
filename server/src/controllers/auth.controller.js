import { z } from "zod";

import User from "../models/user.model.js";
import {
  clearAuthCookie,
  createAuthToken,
  setAuthCookie,
} from "../utils/auth-cookie.js";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254, "Email is too long");

const registrationSchema = z.object({
  email: emailSchema,

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must not exceed 72 characters"),
});

const loginSchema = z.object({
  email: emailSchema,

  password: z
    .string()
    .min(1, "Password is required")
    .max(72, "Password must not exceed 72 characters"),
});

function validationErrorResponse(response, validationResult) {
  const firstIssue = validationResult.error.issues[0];

  return response.status(400).json({
    success: false,
    message: firstIssue?.message || "Invalid request",
    errors: validationResult.error.flatten().fieldErrors,
  });
}

function serializeUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    createdAt: user.createdAt,
  };
}

export async function register(request, response, next) {
  try {
    const validationResult = registrationSchema.safeParse(request.body);

    if (!validationResult.success) {
      return validationErrorResponse(response, validationResult);
    }

    const { email, password } = validationResult.data;

    const existingUser = await User.exists({ email });

    if (existingUser) {
      return response.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const user = await User.create({
      email,
      password,
    });

    const token = createAuthToken(user._id);
    setAuthCookie(response, token);

    return response.status(201).json({
      success: true,
      message: "Account created successfully",
      user: serializeUser(user),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    return next(error);
  }
}

export async function login(request, response, next) {
  try {
    const validationResult = loginSchema.safeParse(request.body);

    if (!validationResult.success) {
      return validationErrorResponse(response, validationResult);
    }

    const { email, password } = validationResult.data;

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return response.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await user.comparePassword(password);

    if (!passwordMatches) {
      return response.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = createAuthToken(user._id);
    setAuthCookie(response, token);

    return response.status(200).json({
      success: true,
      message: "Logged in successfully",
      user: serializeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

export function logout(_request, response) {
  clearAuthCookie(response);

  return response.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
}

export function getCurrentUser(request, response) {
  return response.status(200).json({
    success: true,
    user: serializeUser(request.user),
  });
}
