// Conexão WebSocket para chat
const socket = new WebSocket("ws://localhost:8080");

const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

socket.onmessage = (event) => {
  const msg = document.createElement("div");
  msg.textContent = event.data;
  messagesDiv.appendChild(msg);
};

sendButton.onclick = () => {
  if (messageInput.value.trim() !== "") {
    socket.send(messageInput.value);
    messageInput.value = "";
  }
};