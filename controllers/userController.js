import User from "../models/User.js";
import catchAsync from "../utils/catchAsync.js";

// GET /api/users?search=nish  -> list users (excluding self), optional username/email search
export const getUsers = catchAsync(async (req, res) => {
  const { search } = req.query;

  const filter = { _id: { $ne: req.user._id } };
  if (search) {
    filter.$or = [
      { username: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(filter).select("-password");
  res.status(200).json({ users });
});

// GET /api/users/:id
export const getUserById = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.status(200).json({ user });
});

// PATCH /api/users/me
export const updateProfile = catchAsync(async (req, res) => {
  const allowedFields = ["username", "avatar", "bio"];
  const updates = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  }).select("-password");

  res.status(200).json({ user });
});
