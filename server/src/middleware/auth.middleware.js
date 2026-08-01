import jwt from "jsonwebtoken";

import User from "../models/user.model.js";
import { getAuthCookieName } from "../utils/auth-cookie.js";

export async function requireAuthentication(request, response, next) {
  try {
    const token = request.cookies[getAuthCookieName()];

    if (!token) {
      return response.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is not defined");
    }

    const decodedToken = jwt.verify(token, secret);

    const user = await User.findById(decodedToken.sub).select(
      "_id email createdAt updatedAt",
    );

    if (!user) {
      return response.status(401).json({
        success: false,
        message: "User account no longer exists",
      });
    }

    request.user = user;

    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return response.status(401).json({
        success: false,
        message: "Your session is invalid or has expired",
      });
    }

    return next(error);
  }
}
