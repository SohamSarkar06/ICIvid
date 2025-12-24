import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc,
  collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp,
  updateDoc, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyBjPo05IXrOkzUVXsnx8wNaJwiRsXE2Onk",
  authDomain: "icivid.firebaseapp.com",
  projectId: "icivid"
});

const auth = getAuth(app);
const db = getFirestore(app);

// ================= PARAMS =================
const params = new URLSearchParams(location.search);
const chatId = params.get("chat");
const otherUid = params.get("user");

// ================= DOM =================
const messagesDiv = document.getElementById("messages");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const chatUser = document.getElementById("chatUser");
const callBtn = document.getElementById("callBtn");

// 📞 Incoming call modal
const incomingModal = document.getElementById("incomingCall");
const callerNameEl = document.getElementById("callerName");
const acceptBtn = document.getElementById("accept");
const declineBtn = document.getElementById("decline");

const chatRef = doc(db, "chats", chatId);
const messagesRef = collection(chatRef, "messages");

// ================= AUTH =================
onAuthStateChanged(auth, async (user) => { if (!user) return location.href = "index.html"; // Show chat user 
                                          const uSnap = await getDoc(doc(db, "users", otherUid)); if (uSnap.exists()) chatUser.textContent = uSnap.data().username; // ================= LOAD MESSAGES (WITH TIMESTAMP) ================= 
                                          const q = query(messagesRef, orderBy("createdAt")); onSnapshot(q, snap => { messagesDiv.innerHTML = ""; snap.forEach(d => { const m = d.data(); const time = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""; messagesDiv.innerHTML += <div class="message ${m.sender === user.uid ? "me" : "other"}"> <div class="text">${m.text}</div> <div class="time">${time}</div> </div> ; }); messagesDiv.scrollTop = messagesDiv.scrollHeight; });
  // ================= SEND MESSAGE (TIMESTAMP STORED) =================
  sendBtn.onclick = async () => {
    if (!msgInput.value.trim()) return;

    await addDoc(messagesRef, {
      text: msgInput.value,
      sender: user.uid,
      createdAt: serverTimestamp()
    });

await setDoc(chatRef, {
  lastMessage: msgInput.value,
  lastMessageSender: user.uid,
  updatedAt: serverTimestamp()
}, { merge: true });


    msgInput.value = "";
  };

  // ================= 📞 CALL FROM CHAT =================
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

  // ================= 📞 INCOMING CALL LISTENER =================
  const incomingQ = query(
    collection(db, "callRequests"),
    where("to", "==", user.uid),
    where("status", "==", "pending")
  );

  onSnapshot(incomingQ, async snap => {
    snap.forEach(async d => {
      const data = d.data();

      const callerSnap = await getDoc(doc(db, "users", data.from));
      callerNameEl.textContent = callerSnap.exists()
        ? `${callerSnap.data().username} is calling`
        : "Incoming call";

      incomingModal.classList.remove("hidden");

      acceptBtn.onclick = async () => {
        await updateDoc(doc(db, "callRequests", d.id), {
          status: "accepted"
        });

        await setDoc(doc(db, "calls", d.id), {
          caller: data.from,
          receiver: user.uid,
          createdAt: Date.now()
        });

        location.href = `call.html?call=${d.id}`;
      };

      declineBtn.onclick = async () => {
        await updateDoc(doc(db, "callRequests", d.id), {
          status: "declined"
        });
        incomingModal.classList.add("hidden");
      };
    });
  });
});
