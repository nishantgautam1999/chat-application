const API = "/api";

let token = localStorage.getItem("token") || null;
let me = JSON.parse(localStorage.getItem("me") || "null");
let socket = null;
let activeConversation = null; // full conversation object
let typingTimeout = null;

// ---------- DOM refs ----------
const authScreen = document.getElementById("auth-screen");
const chatScreen = document.getElementById("chat-screen");
const authError = document.getElementById("auth-error");

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const tabBtns = document.querySelectorAll(".tab-btn");

const meUsername = document.getElementById("me-username");
const logoutBtn = document.getElementById("logout-btn");
const userSearch = document.getElementById("user-search");
const userList = document.getElementById("user-list");

const chatHeader = document.getElementById("chat-header");
const messagesEl = document.getElementById("messages");
const typingIndicator = document.getElementById("typing-indicator");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");

// ---------- Tabs ----------
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    if (btn.dataset.tab === "login") {
      loginForm.classList.remove("hidden");
      registerForm.classList.add("hidden");
    } else {
      registerForm.classList.remove("hidden");
      loginForm.classList.add("hidden");
    }
  });
});

// ---------- Auth ----------
async function apiRequest(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  try {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    onAuthSuccess(data);
  } catch (err) {
    authError.textContent = err.message;
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  try {
    const username = document.getElementById("register-username").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    const data = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
    onAuthSuccess(data);
  } catch (err) {
    authError.textContent = err.message;
  }
});

function onAuthSuccess(data) {
  token = data.token;
  me = data.user;
  localStorage.setItem("token", token);
  localStorage.setItem("me", JSON.stringify(me));
  showChatScreen();
}

logoutBtn.addEventListener("click", async () => {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch (_) {
    /* ignore */
  }
  localStorage.removeItem("token");
  localStorage.removeItem("me");
  token = null;
  me = null;
  if (socket) socket.disconnect();
  location.reload();
});

// ---------- Chat screen bootstrap ----------
function showChatScreen() {
  authScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  meUsername.textContent = me.username;
  connectSocket();
  loadUsers();
}

function connectSocket() {
  socket = io({ auth: { token } });

  socket.on("newMessage", (message) => {
    if (activeConversation && message.conversation === activeConversation._id) {
      renderMessage(message);
      scrollToBottom();
      socket.emit("messageRead", { conversationId: activeConversation._id, messageId: message._id });
    }
  });

  socket.on("typing", ({ conversationId }) => {
    if (activeConversation && conversationId === activeConversation._id) {
      typingIndicator.textContent = "Typing...";
    }
  });

  socket.on("stopTyping", ({ conversationId }) => {
    if (activeConversation && conversationId === activeConversation._id) {
      typingIndicator.textContent = "";
    }
  });

  socket.on("userOnline", ({ userId }) => setUserStatus(userId, true));
  socket.on("userOffline", ({ userId }) => setUserStatus(userId, false));
}

function setUserStatus(userId, isOnline) {
  const dot = userList.querySelector(`[data-user-id="${userId}"] .status-dot`);
  if (dot) dot.classList.toggle("online", isOnline);
}

// ---------- Users / conversations ----------
async function loadUsers(search = "") {
  const { users } = await apiRequest(`/users${search ? `?search=${encodeURIComponent(search)}` : ""}`);
  userList.innerHTML = "";
  users.forEach((user) => {
    const li = document.createElement("li");
    li.dataset.userId = user._id;
    li.innerHTML = `<span class="status-dot ${user.isOnline ? "online" : ""}"></span> ${user.username}`;
    li.addEventListener("click", () => openConversationWith(user));
    userList.appendChild(li);
  });
}

let searchDebounce;
userSearch.addEventListener("input", (e) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadUsers(e.target.value), 250);
});

async function openConversationWith(user) {
  [...userList.children].forEach((li) => li.classList.remove("active"));
  userList.querySelector(`[data-user-id="${user._id}"]`)?.classList.add("active");

  const { conversation } = await apiRequest("/conversations", {
    method: "POST",
    body: JSON.stringify({ participantId: user._id }),
  });

  activeConversation = conversation;
  chatHeader.textContent = user.username;
  messageForm.classList.remove("hidden");
  socket.emit("joinConversation", conversation._id);

  const { messages } = await apiRequest(`/messages/${conversation._id}`);
  messagesEl.innerHTML = "";
  messages.forEach(renderMessage);
  scrollToBottom();
}

// ---------- Messages ----------
function renderMessage(message) {
  const div = document.createElement("div");
  const isOwn = (message.sender._id || message.sender) === me._id;
  div.className = `msg ${isOwn ? "own" : ""}`;
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  div.innerHTML = `<div>${escapeHtml(message.content)}</div><div class="meta">${time}</div>`;
  messagesEl.appendChild(div);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const content = messageInput.value.trim();
  if (!content || !activeConversation) return;

  socket.emit(
    "sendMessage",
    { conversationId: activeConversation._id, content },
    (ack) => {
      if (ack?.error) console.error(ack.error);
    },
  );

  messageInput.value = "";
  socket.emit("stopTyping", { conversationId: activeConversation._id });
});

messageInput.addEventListener("input", () => {
  if (!activeConversation) return;
  socket.emit("typing", { conversationId: activeConversation._id });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("stopTyping", { conversationId: activeConversation._id });
  }, 1000);
});

// ---------- Init ----------
if (token && me) {
  showChatScreen();
}
