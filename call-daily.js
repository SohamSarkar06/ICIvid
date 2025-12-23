import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBjPo05IXrOkzUVXsnx8wNaJwiRsXE2Onk",
  authDomain: "icivid.firebaseapp.com",
  projectId: "icivid",
  appId: "1:2684424094:web:2d63b2cb5cf98615b8108f"
};

initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

const roomUrl = new URLSearchParams(location.search).get("room");
const frameContainer = document.getElementById("callFrame");

// 🔥 CREATE DAILY CALL
const call = DailyIframe.createFrame(frameContainer, {
  showLeaveButton: true,
  showFullscreenButton: true,
  showParticipantsBar: false
});

// Join room
call.join({ url: roomUrl });

// Redirect on leave
call.on("left-meeting", () => {
  location.href = "dashboard.html";
});

// ================= CHAT (UNCHANGED) =================
onAuthStateChanged(auth, async (user) => {
  if (!user) return location.href = "index.html";

  const chatId = roomUrl.split("/").pop();
  const chatRef = collection(db, "chats", chatId, "messages");

  const q = query(chatRef, orderBy("createdAt"));
  onSnapshot(q, snap => {
    document.getElementById("messages").innerHTML = "";
    snap.forEach(doc => {
      const m = doc.data();
      const div = document.createElement("div");
      div.className = m.sender === user.uid ? "me" : "other";
      div.textContent = m.text;
      messages.appendChild(div);
    });
  });

  sendBtn.onclick = async () => {
    if (!messageInput.value.trim()) return;
    await addDoc(chatRef, {
      text: messageInput.value,
      sender: user.uid,
      createdAt: serverTimestamp()
    });
    messageInput.value = "";
  };
});
