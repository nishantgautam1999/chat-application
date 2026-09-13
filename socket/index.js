import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";

// userId -> Set of connected socket ids (a user can have multiple tabs/devices open)
const onlineUsers = new Map();

const addOnlineSocket = (userId, socketId) => {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
};

const removeOnlineSocket = (userId, socketId) => {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return true; // fully offline now
  }
  return false;
};

const initSocket = (io) => {
  // Authenticate every socket connection using the same JWT issued by /api/auth/login
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) return next(new Error("Authentication error: token missing"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error("Authentication error: invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const { userId } = socket;
    console.log(`Socket connected: ${socket.id} (user ${userId})`);

    addOnlineSocket(userId, socket.id);
    await User.findByIdAndUpdate(userId, { isOnline: true });
    io.emit("userOnline", { userId });

    // Join every conversation this user is part of so messages reach them immediately
    const conversations = await Conversation.find({ participants: userId }).select("_id");
    conversations.forEach((c) => socket.join(c._id.toString()));

    // ---- Room management ----
    socket.on("joinConversation", (conversationId) => {
      socket.join(conversationId);
    });

    socket.on("leaveConversation", (conversationId) => {
      socket.leave(conversationId);
    });

    // ---- Messaging ----
    // Real-time alternative to POST /api/messages
    socket.on("sendMessage", async ({ conversationId, content, messageType = "text", attachments = [] }, callback) => {
      try {
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        });
        if (!conversation) {
          return callback?.({ error: "Conversation not found" });
        }

        let message = await Message.create({
          conversation: conversationId,
          sender: userId,
          content,
          messageType,
          attachments,
          readBy: [userId],
        });
        message = await message.populate("sender", "-password");

        conversation.lastMessage = message._id;
        await conversation.save();

        io.to(conversationId).emit("newMessage", message);
        callback?.({ message });
      } catch (err) {
        console.error("sendMessage error:", err.message);
        callback?.({ error: "Failed to send message" });
      }
    });

    socket.on("messageRead", async ({ conversationId, messageId }) => {
      await Message.findByIdAndUpdate(messageId, { $addToSet: { readBy: userId } });
      io.to(conversationId).emit("messageRead", { messageId, userId });
    });

    // ---- Typing indicators ----
    socket.on("typing", ({ conversationId }) => {
      socket.to(conversationId).emit("typing", { conversationId, userId });
    });

    socket.on("stopTyping", ({ conversationId }) => {
      socket.to(conversationId).emit("stopTyping", { conversationId, userId });
    });

    // ---- Presence ----
    socket.on("disconnect", async () => {
      console.log(`Socket disconnected: ${socket.id} (user ${userId})`);
      const isFullyOffline = removeOnlineSocket(userId, socket.id);
      if (isFullyOffline) {
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
        io.emit("userOffline", { userId, lastSeen: new Date() });
      }
    });
  });
};

export const isUserOnline = (userId) => onlineUsers.has(userId.toString());

export default initSocket;
