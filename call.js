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
  // your config
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------------- Video ---------------- */

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

/* ---------------- Peer ---------------- */

const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});

/* 🔍 LOG EVERYTHING */
pc.oniceconnectionstatechange = () =>
  console.log("ICE STATE:", pc.iceConnectionState);

pc.onconnectionstatechange = () =>
  console.log("PC STATE:", pc.connectionState);

pc.onsignalingstatechange = () =>
  console.log("SIGNAL STATE:", pc.signalingState);

/* ---------------- Remote Stream ---------------- */

const remoteStream = new MediaStream();
remoteVideo.srcObject = remoteStream;

pc.ontrack = (event) => {
  console.log("🔥 ONTRACK FIRED", event.streams);
  event.streams[0].getTracks().forEach(track => {
    console.log("➡️ Remote track:", track.kind);
    remoteStream.addTrack(track);
  });
};

/* ---------------- Local Media ---------------- */

const localStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});

console.log("🎥 Local tracks:", localStream.getTracks());

localVideo.srcObject = localStream;
localVideo.muted = true;

localStream.getTracks().forEach(track => {
  pc.addTrack(track, localStream);
});

/* ---------------- Signaling ---------------- */

const params = new URLSearchParams(window.location.search);
const reqId = params.get("req");

const callRef = doc(db, "callRequests", reqId);
const offerCandidates = collection(callRef, "offerCandidates");
const answerCandidates = collection(callRef, "answerCandidates");

const callSnap = await getDoc(callRef);
const callData = callSnap.data();

const isCaller = !callData?.offer;

/* ---------------- ICE ---------------- */

pc.onicecandidate = async (event) => {
  if (!event.candidate) return;

  console.log("📡 ICE candidate generated");

  await addDoc(
    isCaller ? offerCandidates : answerCandidates,
    event.candidate.toJSON()
  );
};

onSnapshot(offerCandidates, snapshot => {
  snapshot.docChanges().forEach(change => {
    if (change.type === "added") {
      console.log("⬅️ ICE from offer side");
      pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
    }
  });
});

onSnapshot(answerCandidates, snapshot => {
  snapshot.docChanges().forEach(change => {
    if (change.type === "added") {
      console.log("⬅️ ICE from answer side");
      pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
    }
  });
});

/* ---------------- Answerer ---------------- */

if (callData?.offer) {
  console.log("📞 Answerer");

  await pc.setRemoteDescription(callData.offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await updateDoc(callRef, {
    answer: {
      type: answer.type,
      sdp: answer.sdp
    }
  });
}

/* ---------------- Caller ---------------- */

if (!callData?.offer) {
  console.log("📞 Caller");

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await updateDoc(callRef, {
    offer: {
      type: offer.type,
      sdp: offer.sdp
    }
  });
}
