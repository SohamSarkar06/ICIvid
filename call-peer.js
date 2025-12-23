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
  apiKey: "...replace with yours...",
  authDomain: "icivid.firebaseapp.com",
  projectId: "icivid",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

  const peer = new Peer(); // auto ID
  let localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  localVideo.srcObject = localStream;

  const urlParams = new URLSearchParams(location.search);
  const targetPeer = urlParams.get("peer");

  // ANSWER incoming call
  peer.on("call", call => {
    call.answer(localStream);
    call.on("stream", remoteStream => {
      remoteVideo.srcObject = remoteStream;
    });
  });

  // MAKE CALL if target passed
  if (targetPeer) {
    const call = peer.call(targetPeer, localStream);
    call.on("stream", remoteStream => {
      remoteVideo.srcObject = remoteStream;
    });
  }

  // CHAT LISTEN
  const chatRef = collection(db, "chats", targetPeer, "messages");
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

  endBtn.onclick = () => {
    peer.destroy();
    localStream.getTracks().forEach(t => t.stop());
    location.href = "dashboard.html";
  };
});
