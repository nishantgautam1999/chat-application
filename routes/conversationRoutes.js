import { Router } from "express";
import {
  accessConversation,
  getConversations,
  getConversationById,
  createGroup,
} from "../controllers/conversationController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.post("/", accessConversation);
router.get("/", getConversations);
router.post("/group", createGroup);
router.get("/:id", getConversationById);

export default router;
