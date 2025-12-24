// ================= IMPORTS =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

let pc;
let localStream;

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
  const callSnap = await getDoc(callRef);
  const callData = callSnap.data();

  // ================= PEER CONNECTION =================
  pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  });

  pc.oniceconnectionstatechange = () => {
    console.log("ICE:", pc.iceConnectionState);
  };

  // ================= LOCAL MEDIA =================
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  localVideo.srcObject = localStream;

  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  // ================= REMOTE MEDIA =================
  const remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
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

    onSnapshot(callRef, snap => {
      const d = snap.data();
      if (d.answer && !pc.currentRemoteDescription) {
        pc.setRemoteDescription(d.answer);
      }
    });

    onSnapshot(
      collection(db, "calls", callId, "iceReceiver"),
      snap => snap.docChanges().forEach(c =>
        pc.addIceCandidate(c.doc.data())
      )
    );
  } else {
    onSnapshot(callRef, async snap => {
      const d = snap.data();
      if (d.offer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(d.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await updateDoc(callRef, { answer });
      }
    });

    onSnapshot(
      collection(db, "calls", callId, "iceCaller"),
      snap => snap.docChanges().forEach(c =>
        pc.addIceCandidate(c.doc.data())
      )
    );
  }

  // ================= CONTROLS =================
  const audioTrack = localStream.getAudioTracks()[0];
  const videoTrack = localStream.getVideoTracks()[0];

  muteBtn.onclick = () => audioTrack.enabled = !audioTrack.enabled;
  videoBtn.onclick = () => videoTrack.enabled = !videoTrack.enabled;

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
      div.textContent = m.text;
      messages.appendChild(div);
    });
  });

  endBtn.onclick = async () => {
    pc.close();
    localStream.getTracks().forEach(t => t.stop());
    await updateDoc(callRef, { status: "ended" });
    location.href = "dashboard.html";
  };
}
