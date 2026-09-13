import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import catchAsync from "../utils/catchAsync.js";

export const register = catchAsync(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: "username, email and password are required" });
  }

  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    return res.status(409).json({ message: "Username or email already in use" });
  }

  const user = await User.create({ username, email, password });
  const token = generateToken(user._id);

  res.status(201).json({ user: user.toSafeObject(), token });
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  user.isOnline = true;
  await user.save();

  const token = generateToken(user._id);

  res.status(200).json({ user: user.toSafeObject(), token });
});

export const getMe = catchAsync(async (req, res) => {
  res.status(200).json({ user: req.user.toSafeObject() });
});

export const logout = catchAsync(async (req, res) => {
  req.user.isOnline = false;
  req.user.lastSeen = new Date();
  await req.user.save();
  res.status(200).json({ message: "Logged out successfully" });
});
