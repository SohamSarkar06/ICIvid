// ================= IMPORTS =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ================= INIT =================
const app = initializeApp({
  apiKey: "AIzaSyBjPo05IXrOkzUVXsnx8wNaJwiRsXE2Onk",
  authDomain: "icivid.firebaseapp.com",
  projectId: "icivid"
});

const auth = getAuth(app);
const db = getFirestore(app);

// ================= DOM =================
const chatMessages = document.getElementById("chatMessages");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const chatUserEl = document.getElementById("chatUser");
const callBtn = document.getElementById("callBtn");

// ================= URL PARAMS =================
const params = new URLSearchParams(location.search);
const chatId = params.get("chat");
const otherUid = params.get("user");

if (!chatId || !otherUid) {
  alert("Invalid chat");
  history.back();
}

// ================= AUTH =================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }

  // Show username in header
  const otherSnap = await getDoc(doc(db, "users", otherUid));
  if (otherSnap.exists()) {
    chatUserEl.textContent = otherSnap.data().username;
  }

  listenMessages(user.uid);
  sendBtn.onclick = () => sendMessage(user.uid);
});

// ================= LISTEN MESSAGES =================
function listenMessages(myUid) {
  const msgsRef = collection(db, "chats", chatId, "messages");
  const q = query(msgsRef, orderBy("createdAt"));

  onSnapshot(q, snap => {
    chatMessages.innerHTML = "";

    snap.forEach(docu => {
      const m = docu.data();
      const isMe = m.sender === myUid;

      const time = m.createdAt?.toDate
        ? m.createdAt.toDate().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          })
        : "";

      chatMessages.innerHTML += `
        <div class="chat-bubble ${isMe ? "me" : "other"}">
          ${m.text}
          <span class="time">${time}</span>
        </div>
      `;
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

// ================= SEND MESSAGE =================
async function sendMessage(myUid) {
  const text = msgInput.value.trim();
  if (!text) return;

  msgInput.value = "";

  const chatRef = doc(db, "chats", chatId);

  await addDoc(collection(chatRef, "messages"), {
    text,
    sender: myUid,
    createdAt: serverTimestamp()
  });

  await setDoc(chatRef, {
    lastMessage: text,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// ================= CALL FROM CHAT =================
callBtn.onclick = async () => {
  const now = Date.now();

  const req = await addDoc(collection(db, "callRequests"), {
    from: auth.currentUser.uid,
    to: otherUid,
    status: "pending",
    createdAt: now,
    expiresAt: now + 5 * 60 * 1000
  });

  location.href = `call-wait.html?req=${req.id}`;
};
