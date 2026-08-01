import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  getCurrentUser,
  login,
  logout,
  register,
} from "../controllers/auth.controller.js";
import { requireAuthentication } from "../middleware/auth.middleware.js";

const authRouter = Router();

const authenticationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Try again later.",
  },
});

authRouter.post("/register", authenticationLimiter, register);
authRouter.post("/login", authenticationLimiter, login);

authRouter.post("/logout", logout);
authRouter.get("/me", requireAuthentication, getCurrentUser);

export default authRouter;
