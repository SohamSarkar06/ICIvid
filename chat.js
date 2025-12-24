import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc,
  collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyBjPo05IXrOkzUVXsnx8wNaJwiRsXE2Onk",
  authDomain: "icivid.firebaseapp.com",
  projectId: "icivid"
});

const auth = getAuth(app);
const db = getFirestore(app);

const params = new URLSearchParams(location.search);
const chatId = params.get("chat");
const otherUid = params.get("user");

const messagesDiv = document.getElementById("messages");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const chatUser = document.getElementById("chatUser");
const callBtn = document.getElementById("callBtn");

const chatRef = doc(db, "chats", chatId);
const messagesRef = collection(chatRef, "messages");

onAuthStateChanged(auth, async (user) => {
  if (!user) return location.href = "index.html";

  const uSnap = await getDoc(doc(db, "users", otherUid));
  if (uSnap.exists()) chatUser.textContent = uSnap.data().username;

  // Load messages
  const q = query(messagesRef, orderBy("createdAt"));
  onSnapshot(q, snap => {
    messagesDiv.innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      messagesDiv.innerHTML += `
        <div class="message ${m.sender === user.uid ? "me" : "other"}">
          ${m.text}
        </div>
      `;
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });

  sendBtn.onclick = async () => {
    if (!msgInput.value.trim()) return;

    await addDoc(messagesRef, {
      text: msgInput.value,
      sender: user.uid,
      createdAt: serverTimestamp()
    });

    await setDoc(chatRef, {
      lastMessage: msgInput.value,
      updatedAt: serverTimestamp()
    }, { merge: true });

    msgInput.value = "";
  };

  // 📞 CALL FROM CHAT
  callBtn.onclick = async () => {
    const req = await addDoc(collection(db, "callRequests"), {
      from: user.uid,
      to: otherUid,
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000
    });
    location.href = `call-wait.html?req=${req.id}`;
  };
});
