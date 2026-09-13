import { Router } from "express";
import { getMessages, sendMessage, markAsRead } from "../controllers/messageController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.post("/", sendMessage);
router.get("/:conversationId", getMessages);
router.patch("/:id/read", markAsRead);

export default router;
