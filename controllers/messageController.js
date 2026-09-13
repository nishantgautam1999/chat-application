import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import catchAsync from "../utils/catchAsync.js";

// GET /api/messages/:conversationId?page=1&limit=30
export const getMessages = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 30;

  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: req.user._id,
  });
  if (!conversation) {
    return res.status(404).json({ message: "Conversation not found" });
  }

  const messages = await Message.find({ conversation: conversationId })
    .populate("sender", "-password")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.status(200).json({ messages: messages.reverse(), page, limit });
});

// POST /api/messages  { conversationId, content, messageType, attachments }
// Persists the message and also broadcasts it over Socket.io to the conversation room,
// so it works the same whether a client sends over REST or over the "sendMessage" socket event.
export const sendMessage = catchAsync(async (req, res) => {
  const { conversationId, content, messageType = "text", attachments = [] } = req.body;

  if (!conversationId || (!content && attachments.length === 0)) {
    return res
      .status(400)
      .json({ message: "conversationId and content (or attachments) are required" });
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: req.user._id,
  });
  if (!conversation) {
    return res.status(404).json({ message: "Conversation not found" });
  }

  let message = await Message.create({
    conversation: conversationId,
    sender: req.user._id,
    content,
    messageType,
    attachments,
    readBy: [req.user._id],
  });

  message = await message.populate("sender", "-password");

  conversation.lastMessage = message._id;
  await conversation.save();

  const io = req.app.get("io");
  if (io) {
    io.to(conversationId.toString()).emit("newMessage", message);
  }

  res.status(201).json({ message });
});

// PATCH /api/messages/:id/read
export const markAsRead = catchAsync(async (req, res) => {
  const message = await Message.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { readBy: req.user._id } },
    { new: true },
  ).populate("sender", "-password");

  if (!message) {
    return res.status(404).json({ message: "Message not found" });
  }

  const io = req.app.get("io");
  if (io) {
    io.to(message.conversation.toString()).emit("messageRead", {
      messageId: message._id,
      userId: req.user._id,
    });
  }

  res.status(200).json({ message });
});
