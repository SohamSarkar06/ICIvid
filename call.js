import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
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
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ================= FIREBASE INIT ================= */

const firebaseConfig = {
  apiKey: "AIzaSyBjPo05IXrOkzUVXsnx8wNaJwiRsXE2Onk",
  authDomain: "icivid.firebaseapp.com",
  projectId: "icivid"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ================= DOM ================= */

const localVideo  = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const muteBtn   = document.getElementById("muteBtn");
const videoBtn  = document.getElementById("videoBtn");
const screenBtn = document.getElementById("screenBtn");
const endBtn    = document.getElementById("endBtn");

const msgInput = document.getElementById("msgInput");
const sendMsg  = document.getElementById("sendMsg");
const messages = document.getElementById("messages");

const callInfo = document.getElementById("callInfo");
const otherUserNameEl = document.getElementById("otherUserName");

/* ================= STATE ================= */

const callId = new URLSearchParams(location.search).get("call");

let pc;
let localStream;

const callRef = doc(db, "calls", callId);
const reqRef  = doc(db, "callRequests", callId);

const offerCandidates  = collection(callRef, "offerCandidates");
const answerCandidates = collection(callRef, "answerCandidates");
const messagesRef      = collection(callRef, "messages");

/* ================= ICE CONFIG (TURN) ================= */

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:global.relay.metered.ca:443?transport=tcp",
      username: "97119b0d1ca1589bd69cfb33",
      credential: "SfIwVlqOh3Zub8MW"
    }
  ]
};

/* ================= ENTRY ================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) return;

  const req = reqSnap.data();
  const isCaller = req.from === user.uid;

  // Show "You are in call with X"
  const otherUid = isCaller ? req.to : req.from;
  const otherUserSnap = await getDoc(doc(db, "users", otherUid));
  if (otherUserSnap.exists()) {
    otherUserNameEl.textContent = otherUserSnap.data().username;
    callInfo.classList.remove("hidden");
  }

  await initMedia();
  await initPeer(isCaller);
  initChat(user.uid);

  // Call end listener
  onSnapshot(callRef, snap => {
    if (snap.data()?.ended) {
      alert("Call ended by the other user");
      pc?.close();
      window.close();
    }
  });
});

/* ================= MEDIA ================= */

async function initMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  localVideo.srcObject = localStream;
}

/* ================= WEBRTC ================= */

async function initPeer(isCaller) {
  pc = new RTCPeerConnection(rtcConfig);

  // Send local tracks
  localStream.getTracks().forEach(track =>
    pc.addTrack(track, localStream)
  );

  // 🔥 BULLETPROOF REMOTE VIDEO HANDLING
  pc.ontrack = (event) => {
    console.log("🎥 Remote track received:", event.track.kind);

    let stream = remoteVideo.srcObject;
    if (!stream) {
      stream = new MediaStream();
      remoteVideo.srcObject = stream;
    }

    stream.addTrack(event.track);

    remoteVideo
      .play()
      .then(() => console.log("✅ Remote video playing"))
      .catch(() => {});
  };

  if (isCaller) {
    // ===== CALLER =====
    pc.onicecandidate = e => {
      if (e.candidate) addDoc(offerCandidates, e.candidate.toJSON());
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await setDoc(callRef, {
      offer: { type: offer.type, sdp: offer.sdp }
    }, { merge: true });

    onSnapshot(callRef, async snap => {
      if (snap.data()?.answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(
          new RTCSessionDescription(snap.data().answer)
        );
      }
    });

    onSnapshot(answerCandidates, snap => {
      snap.docChanges().forEach(c => {
        if (c.type === "added") {
          pc.addIceCandidate(new RTCIceCandidate(c.doc.data()));
        }
      });
    });

  } else {
    // ===== RECEIVER (FIXED) =====
    pc.onicecandidate = e => {
      if (e.candidate) addDoc(answerCandidates, e.candidate.toJSON());
    };

    onSnapshot(callRef, async snap => {
      const data = snap.data();

      // Wait for offer ONCE
      if (!data?.offer || pc.currentRemoteDescription) return;

      console.log("📨 Offer received → creating answer");

      await pc.setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await setDoc(callRef, {
        answer: { type: answer.type, sdp: answer.sdp }
      }, { merge: true });
    });

    onSnapshot(offerCandidates, snap => {
      snap.docChanges().forEach(c => {
        if (c.type === "added") {
          pc.addIceCandidate(new RTCIceCandidate(c.doc.data()));
        }
      });
    });
  }
}

/* ================= CHAT ================= */

function initChat(uid) {
  const q = query(messagesRef, orderBy("createdAt"));

  sendMsg.onclick = async () => {
    if (!msgInput.value.trim()) return;

    await addDoc(messagesRef, {
      text: msgInput.value,
      sender: uid,
      createdAt: serverTimestamp()
    });

    msgInput.value = "";
  };

  onSnapshot(q, snap => {
    messages.innerHTML = "";

    snap.forEach(doc => {
      const m = doc.data();
      const time = m.createdAt?.toDate
        ? m.createdAt.toDate().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          })
        : "";

      messages.innerHTML += `
        <div class="message ${m.sender === uid ? "me" : "other"}">
          ${m.text}
          <span class="time">${time}</span>
        </div>
      `;
    });

    messages.scrollTop = messages.scrollHeight;
  });
}

/* ================= CONTROLS ================= */

muteBtn.onclick = () => {
  const track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
};

videoBtn.onclick = () => {
  const track = localStream.getVideoTracks()[0];
  track.enabled = !track.enabled;
};

screenBtn.onclick = async () => {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  const sender = pc.getSenders().find(s => s.track.kind === "video");
  sender.replaceTrack(screenStream.getVideoTracks()[0]);
};

endBtn.onclick = async () => {
  await setDoc(callRef, { ended: true }, { merge: true });
  pc.close();
  window.close();
};

// Autoplay fallback
document.body.addEventListener("click", () => {
  if (remoteVideo.paused) {
    remoteVideo.muted = false;
    remoteVideo.play().catch(() => {});
  }
}, { once: true });
