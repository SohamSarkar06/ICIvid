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
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyBjPo05IXrOkzUVXsnx8wNaJwiRsXE2Onk",
  authDomain: "icivid.firebaseapp.com",
  projectId: "icivid",
  appId: "1:2684424094:web:2d63b2cb5cf98615b8108f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= DOM =================
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const muteBtn = document.getElementById("muteBtn");
const videoBtn = document.getElementById("videoBtn");
const screenBtn = document.getElementById("screenBtn");
const endBtn = document.getElementById("endBtn");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");

// ================= AUTH =================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }
  startCall(user.uid);
});

// ================= MAIN =================
async function startCall(uid) {
  const callId = new URLSearchParams(location.search).get("call");
  const callRef = doc(db, "calls", callId);

  const snap = await getDoc(callRef);
  const callData = snap.data();

  // ================= WEBRTC (TURN FIX) =================
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject"
      }
    ]
  });

  // 🔑 REQUIRED
  pc.addTransceiver("video", { direction: "sendrecv" });
  pc.addTransceiver("audio", { direction: "sendrecv" });

  // ================= MEDIA =================
  const localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  localVideo.srcObject = localStream;
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  const remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;

  pc.ontrack = (e) => {
    e.streams[0].getTracks().forEach(track => {
      if (!remoteStream.getTracks().includes(track)) {
        remoteStream.addTrack(track);
      }
    });
  };

  // ================= ICE =================
  pc.onicecandidate = e => {
    if (!e.candidate) return;
    addDoc(
      collection(
        db,
        "calls",
        callId,
        uid === callData.caller ? "iceCaller" : "iceReceiver"
      ),
      e.candidate.toJSON()
    );
  };

  // ================= SIGNALING =================
  if (uid === callData.caller) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await updateDoc(callRef, { offer });

    onSnapshot(callRef, s => {
      const d = s.data();
      if (d.answer && !pc.currentRemoteDescription) {
        pc.setRemoteDescription(d.answer);
      }
    });

    onSnapshot(
      collection(db, "calls", callId, "iceReceiver"),
      s => s.docChanges().forEach(c =>
        pc.addIceCandidate(c.doc.data())
      )
    );
  } else {
    onSnapshot(callRef, async s => {
      const d = s.data();
      if (d.offer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(d.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await updateDoc(callRef, { answer });
      }
    });

    onSnapshot(
      collection(db, "calls", callId, "iceCaller"),
      s => s.docChanges().forEach(c =>
        pc.addIceCandidate(c.doc.data())
      )
    );
  }

  // ================= CONTROLS =================
  const audioTrack = localStream.getAudioTracks()[0];
  const videoTrack = localStream.getVideoTracks()[0];

  muteBtn.onclick = () => {
    audioTrack.enabled = !audioTrack.enabled;
    muteBtn.textContent = audioTrack.enabled ? "🎤" : "🔇";
  };

  videoBtn.onclick = () => {
    videoTrack.enabled = !videoTrack.enabled;
    videoBtn.textContent = videoTrack.enabled ? "🎥" : "🚫";
  };

  // ================= SCREEN SHARE =================
  let screenStream = null;
  const sender = pc.getSenders().find(s => s.track?.kind === "video");

  screenBtn.onclick = async () => {
    if (!screenStream) {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      sender.replaceTrack(screenStream.getVideoTracks()[0]);
      localVideo.srcObject = screenStream;

      screenStream.getVideoTracks()[0].onended = stopScreen;
    } else {
      stopScreen();
    }
  };

  function stopScreen() {
    sender.replaceTrack(videoTrack);
    localVideo.srcObject = localStream;
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
  }

  // ================= CHAT =================
  const chatQuery = query(
    collection(db, "chats", callId, "messages"),
    orderBy("createdAt")
  );

  sendBtn.onclick = async () => {
    if (!messageInput.value.trim()) return;
    await addDoc(collection(db, "chats", callId, "messages"), {
      text: messageInput.value,
      sender: uid,
      createdAt: serverTimestamp()
    });
    messageInput.value = "";
  };

  onSnapshot(chatQuery, snap => {
    snap.docChanges().forEach(c => {
      if (c.type !== "added") return;
      const m = c.doc.data();
      const div = document.createElement("div");
      div.className = `message ${m.sender === uid ? "me" : "other"}`;
      div.textContent = m.text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    });
  });

  // ================= END =================
  endBtn.onclick = async () => {
    pc.close();
    localStream.getTracks().forEach(t => t.stop());
    await updateDoc(callRef, { status: "ended" });
    location.href = "dashboard.html";
  };
}
