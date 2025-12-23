import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

// ================= DOM =================
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const muteBtn = document.getElementById("muteBtn");
const videoBtn = document.getElementById("videoBtn");
const endBtn = document.getElementById("endBtn");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");

onAuthStateChanged(auth, async (user) => {
  if (!user) return location.href = "index.html";

  const params = new URLSearchParams(location.search);
  const targetPeer = params.get("peer");

  // 🔥 STABLE PEER ID
  const peer = new Peer(user.uid);

  // 🎥 Media
  const localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  localVideo.srcObject = localStream;

  // 📞 ANSWER CALLS
  peer.on("call", call => {
    call.answer(localStream);
    call.on("stream", remoteStream => {
      remoteVideo.srcObject = remoteStream;
    });
  });

  // 📞 CALL ONLY AFTER PEER IS READY
  peer.on("open", () => {
    if (targetPeer && targetPeer !== user.uid) {
      const call = peer.call(targetPeer, localStream);
      call.on("stream", remoteStream => {
        remoteVideo.srcObject = remoteStream;
      });
    }
  });

  // ================= CHAT =================
  if (!targetPeer) return;

  const chatId = [user.uid, targetPeer].sort().join("_");
  const chatRef = collection(db, "chats", chatId, "messages");

  const chatQuery = query(chatRef, orderBy("createdAt"));
  onSnapshot(chatQuery, snap => {
    snap.docChanges().forEach(change => {
      if (change.type !== "added") return;
      const m = change.doc.data();
      const div = document.createElement("div");
      div.className = `message ${m.sender === user.uid ? "me" : "other"}`;
      div.textContent = m.text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
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

  // ❌ END CALL
  endBtn.onclick = () => {
    peer.destroy();
    localStream.getTracks().forEach(t => t.stop());
    location.href = "dashboard.html";
  };
});
