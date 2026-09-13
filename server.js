import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import initSocket from "./socket/index.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
});

// Make io available to REST controllers via req.app.get("io")
app.set("io", io);

app.use(express.json());
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);

// Simple static test client so the app can be tried in a browser out of the box
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);

app.use(notFound);
app.use(errorHandler);

initSocket(io);

const PORT = process.env.PORT || 8080;

const start = async () => {
  await connectDB();
  server.listen(PORT, () => console.log(`Server is running on PORT ${PORT}`));
};

start();
