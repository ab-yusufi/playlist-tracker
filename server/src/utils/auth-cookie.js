import jwt from "jsonwebtoken";

function getCookieName() {
  return process.env.JWT_COOKIE_NAME || "playlist_tracker_token";
}

function getCookieDays() {
  const parsedDays = Number.parseInt(process.env.JWT_COOKIE_DAYS || "7", 10);

  return Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 7;
}

export function createAuthToken(userId) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }

  return jwt.sign(
    {
      sub: userId.toString(),
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );
}

const COOKIE_NAME = process.env.JWT_COOKIE_NAME || "playlist_tracker_token";

const COOKIE_DAYS = Number(process.env.JWT_COOKIE_DAYS) || 7;

export function setAuthCookie(response, token) {
  const isProduction = process.env.NODE_ENV === "production";
  const cookieDays = getCookieDays();

  response.cookie(getCookieName(), token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: cookieDays * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(response) {
  const isProduction = process.env.NODE_ENV === "production";

  response.clearCookie(getCookieName(), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
}

function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  };
}

export function getAuthCookieName() {
  return getCookieName();
}
