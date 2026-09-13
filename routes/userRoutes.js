import { Router } from "express";
import { getUsers, getUserById, updateProfile } from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.get("/", getUsers);
router.patch("/me", updateProfile);
router.get("/:id", getUserById);

export default router;
