import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  // your existing config
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================= VIDEO ELEMENTS ================= */

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

/* ================= PEER CONNECTION ================= */

const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});

/* 🔴 IMPORTANT: Explicit receive transceivers */
pc.addTransceiver("video", { direction: "sendrecv" });
pc.addTransceiver("audio", { direction: "sendrecv" });

/* ================= REMOTE STREAM (FIX #1) ================= */

const remoteStream = new MediaStream();
remoteVideo.srcObject = remoteStream;

pc.ontrack = (event) => {
  event.streams[0].getTracks().forEach(track => {
    remoteStream.addTrack(track);
  });
};

/* ================= LOCAL MEDIA ================= */

const localStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});

localVideo.srcObject = localStream;
localVideo.muted = true;

localStream.getTracks().forEach(track => {
  pc.addTrack(track, localStream);
});

/* ================= SIGNALING ================= */

const params = new URLSearchParams(window.location.search);
const reqId = params.get("req");

const callRef = doc(db, "callRequests", reqId);
const offerCandidates = collection(callRef, "offerCandidates");
const answerCandidates = collection(callRef, "answerCandidates");

const callSnap = await getDoc(callRef);
const callData = callSnap.data();

const isCaller = !callData?.offer;

/* ================= ICE (FIX #2) ================= */

pc.onicecandidate = async (event) => {
  if (!event.candidate) return;

  await addDoc(
    isCaller ? offerCandidates : answerCandidates,
    event.candidate.toJSON()
  );
};

/* ================= ANSWERER ================= */

if (callData?.offer) {
  await pc.setRemoteDescription(callData.offer);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await updateDoc(callRef, {
    answer: {
      type: answer.type,
      sdp: answer.sdp
    }
  });

  onSnapshot(offerCandidates, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });
}

/* ================= CALLER ================= */

if (!callData?.offer) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await updateDoc(callRef, {
    offer: {
      type: offer.type,
      sdp: offer.sdp
    }
  });

  onSnapshot(answerCandidates, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });
}

/* ================= FORCE PLAY (FIX #3) ================= */

remoteVideo.onloadedmetadata = () => {
  remoteVideo.play().catch(() => {});
};
