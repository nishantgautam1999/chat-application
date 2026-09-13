# Chat Application

Real-time chat backend built with Node.js, Express, Socket.io, and MongoDB (Mongoose). Includes a minimal static test client so you can try it in the browser without a separate frontend.

## Features

- JWT authentication (register / login / me / logout)
- Users, 1-to-1 and group conversations, messages with read receipts
- Real-time messaging, typing indicators, and online/offline presence via Socket.io
- REST API for history/CRUD, mirrored by socket events for live delivery

## Project structure

```
config/db.js              MongoDB connection
models/                   User, Conversation, Message (Mongoose schemas)
middleware/auth.js         JWT route protection
middleware/errorHandler.js Centralized error handling
controllers/                Route handlers (auth, users, conversations, messages)
routes/                     Express routers
socket/index.js              Socket.io auth, rooms, presence, real-time events
public/                      Minimal HTML/CSS/JS test client
server.js                    App entry point
```

## Setup

1. Install dependencies (already present in `package.json`):
   ```
   npm install
   ```
2. Configure `.env`:
   ```
   PORT=8080
   MONGO_URL=mongodb://127.0.0.1:27017/chat-application
   CLIENT_URL=http://localhost:8080
   JWT_SECRET=replace_with_a_long_random_secret
   JWT_EXPIRES_IN=7d
   NODE_ENV=development
   ```
   Use a MongoDB Atlas connection string in `MONGO_URL` if you don't run Mongo locally.
3. Start MongoDB locally (if using a local instance), then run:
   ```
   npm start
   ```
4. Open `http://localhost:8080` in two different browsers (or one normal + one incognito window), register two accounts, and chat between them in real time.

## REST API

| Method | Route                          | Auth | Description                              |
|--------|--------------------------------|------|------------------------------------------|
| POST   | /api/auth/register             | No   | Create account                           |
| POST   | /api/auth/login                | No   | Login, returns JWT                       |
| GET    | /api/auth/me                   | Yes  | Current user                             |
| POST   | /api/auth/logout                | Yes  | Marks user offline                       |
| GET    | /api/users?search=              | Yes  | List/search users (excluding self)       |
| GET    | /api/users/:id                  | Yes  | Get a user by id                         |
| PATCH  | /api/users/me                   | Yes  | Update username/avatar/bio               |
| POST   | /api/conversations               | Yes  | Get-or-create a 1-to-1 conversation      |
| GET    | /api/conversations                | Yes  | List my conversations                    |
| POST   | /api/conversations/group           | Yes  | Create a group conversation               |
| GET    | /api/conversations/:id             | Yes  | Get one conversation                      |
| POST   | /api/messages                      | Yes  | Send a message (also broadcasts via socket) |
| GET    | /api/messages/:conversationId?page=&limit= | Yes | Paginated message history        |
| PATCH  | /api/messages/:id/read              | Yes  | Mark a message as read                    |

Send the JWT as `Authorization: Bearer <token>`.

## Socket.io events

Connect with `io({ auth: { token } })` using the same JWT from login.

Client → server: `joinConversation`, `leaveConversation`, `sendMessage`, `messageRead`, `typing`, `stopTyping`
Server → client: `newMessage`, `messageRead`, `typing`, `stopTyping`, `userOnline`, `userOffline`

## Data models

- **User**: username, email, password (hashed), avatar, bio, isOnline, lastSeen
- **Conversation**: isGroup, groupName, groupAdmin, participants[], lastMessage
- **Message**: conversation, sender, content, messageType, attachments[], readBy[]
