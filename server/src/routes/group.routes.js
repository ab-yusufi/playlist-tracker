import { Router } from "express";

import {
  createGroup,
  deleteGroup,
  listGroups,
  renameGroup,
} from "../controllers/group.controller.js";

import { requireAuthentication } from "../middleware/auth.middleware.js";

const groupRouter = Router();

groupRouter.use(requireAuthentication);

groupRouter.get("/", listGroups);

groupRouter.post("/", createGroup);

groupRouter.patch("/:groupId", renameGroup);

groupRouter.delete("/:groupId", deleteGroup);

export default groupRouter;
