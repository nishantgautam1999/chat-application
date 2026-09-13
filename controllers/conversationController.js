import Conversation from "../models/Conversation.js";
import catchAsync from "../utils/catchAsync.js";

// POST /api/conversations  { participantId }  -> get-or-create a 1-to-1 conversation
export const accessConversation = catchAsync(async (req, res) => {
  const { participantId } = req.body;

  if (!participantId) {
    return res.status(400).json({ message: "participantId is required" });
  }

  let conversation = await Conversation.findOne({
    isGroup: false,
    participants: { $all: [req.user._id, participantId], $size: 2 },
  })
    .populate("participants", "-password")
    .populate("lastMessage");

  if (!conversation) {
    conversation = await Conversation.create({
      isGroup: false,
      participants: [req.user._id, participantId],
    });
    conversation = await conversation.populate("participants", "-password");
  }

  res.status(200).json({ conversation });
});

// GET /api/conversations -> all conversations for the logged-in user
export const getConversations = catchAsync(async (req, res) => {
  const conversations = await Conversation.find({ participants: req.user._id })
    .populate("participants", "-password")
    .populate("groupAdmin", "-password")
    .populate("lastMessage")
    .sort({ updatedAt: -1 });

  res.status(200).json({ conversations });
});

// GET /api/conversations/:id
export const getConversationById = catchAsync(async (req, res) => {
  const conversation = await Conversation.findOne({
    _id: req.params.id,
    participants: req.user._id,
  })
    .populate("participants", "-password")
    .populate("groupAdmin", "-password")
    .populate("lastMessage");

  if (!conversation) {
    return res.status(404).json({ message: "Conversation not found" });
  }

  res.status(200).json({ conversation });
});

// POST /api/conversations/group  { groupName, participantIds: [] }
export const createGroup = catchAsync(async (req, res) => {
  const { groupName, participantIds } = req.body;

  if (!groupName || !Array.isArray(participantIds) || participantIds.length < 2) {
    return res
      .status(400)
      .json({ message: "groupName and at least 2 other participantIds are required" });
  }

  const conversation = await Conversation.create({
    isGroup: true,
    groupName,
    groupAdmin: req.user._id,
    participants: [req.user._id, ...participantIds],
  });

  const populated = await conversation.populate("participants", "-password");

  res.status(201).json({ conversation: populated });
});
