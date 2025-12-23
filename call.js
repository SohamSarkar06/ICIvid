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

// ================= TWILIO CREDENTIALS =================

const TWILIO_ACCOUNT_SID = "ACfa9b88bb1ffdfc4a5bb8c532d4fcc90d";
const TWILIO_AUTH_TOKEN = "fa1751cf5b7bbe518fefe7c02b3d93bc";
const TWILIO_API_KEY_SID = "SK622c00ea8c0b55a7c1a03fc6df308468";
const TWILIO_API_KEY_SECRET = "uUdFLFEP05eJ8nvsq5tiOx6dtw4QmqaF";

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

// ================= GLOBAL VARIABLES =================
let pc = null;
let localStream = null;
let remoteStream = null;
let screenStream = null;
let callId = null;
let userId = null;
let isCaller = false;

// ================= HELPER: GET TWILIO TURN SERVERS =================
async function getTwilioTurnServers() {
  // Method 1: Generate TURN token using Twilio REST API
  try {
    console.log("Fetching Twilio TURN servers...");
    
    // Create authentication token
    const token = btoa(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`);
    
    // Request TURN credentials from Twilio
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Tokens.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Twilio API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Twilio TURN servers received:", data.ice_servers);
    return data.ice_servers;
    
  } catch (error) {
    console.error("Failed to get Twilio TURN servers:", error);
    
    // Fallback: Use pre-configured Twilio TURN servers
    return [
      // STUN servers
      { urls: "stun:global.stun.twilio.com:3478?transport=udp" },
      { urls: "stun:global.stun.twilio.com:3478?transport=tcp" },
      
      // TURN servers (using long-term credentials - less secure but works)
      {
        urls: "turn:global.turn.twilio.com:3478?transport=udp",
        username: TWILIO_API_KEY_SID,
        credential: TWILIO_API_KEY_SECRET
      },
      {
        urls: "turn:global.turn.twilio.com:3478?transport=tcp",
        username: TWILIO_API_KEY_SID,
        credential: TWILIO_API_KEY_SECRET
      },
      {
        urls: "turn:global.turn.twilio.com:443?transport=tcp",
        username: TWILIO_API_KEY_SID,
        credential: TWILIO_API_KEY_SECRET
      },
      
      // Public STUN as backup
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ];
  }
}

// ================= AUTH =================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }
  userId = user.uid;
  await initializeCall();
});

// ================= MAIN CALL INITIALIZATION =================
async function initializeCall() {
  callId = new URLSearchParams(location.search).get("call");
  if (!callId) {
    alert("Error: No call ID found");
    location.href = "dashboard.html";
    return;
  }

  const callRef = doc(db, "calls", callId);
  const snap = await getDoc(callRef);
  
  if (!snap.exists()) {
    alert("Call session not found");
    location.href = "dashboard.html";
    return;
  }

  const callData = snap.data();
  isCaller = userId === callData.caller;
  
  console.log(`User role: ${isCaller ? "Caller" : "Receiver"}`);
  console.log("Call data:", callData);

  // Start the call process
  await startWebRTCCall(callData);
}

// ================= WEBRTC CALL SETUP =================
async function startWebRTCCall(callData) {
  // 1. Get local media stream
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: true
    });
    localVideo.srcObject = localStream;
    console.log("Local stream obtained with tracks:", localStream.getTracks().length);
  } catch (err) {
    console.error("Failed to get media:", err);
    alert("Cannot access camera/microphone. Please check permissions.");
    return;
  }

  // 2. Get TURN servers from Twilio
  const iceServers = await getTwilioTurnServers();
  console.log("Using ICE servers:", iceServers);

  // 3. Create peer connection
  pc = new RTCPeerConnection({
    iceServers: iceServers,
    iceTransportPolicy: "all",
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require"
  });

  // ================= DEBUG LOGGING =================
  pc.oniceconnectionstatechange = () => {
    console.log("ICE Connection State:", pc.iceConnectionState);
    if (pc.iceConnectionState === "disconnected") {
      console.warn("ICE disconnected - network issues");
    }
    if (pc.iceConnectionState === "failed") {
      console.error("ICE connection failed");
    }
    if (pc.iceConnectionState === "connected") {
      console.log("✅ ICE connected successfully!");
    }
  };

  pc.onicegatheringstatechange = () => {
    console.log("ICE Gathering State:", pc.iceGatheringState);
  };

  pc.onsignalingstatechange = () => {
    console.log("Signaling State:", pc.signalingState);
  };

  pc.onconnectionstatechange = () => {
    console.log("Connection State:", pc.connectionState);
  };

  // ================= ADD LOCAL TRACKS =================
  localStream.getTracks().forEach(track => {
    console.log(`Adding local ${track.kind} track`);
    pc.addTrack(track, localStream);
  });

  // ================= FIXED: REMOTE TRACK HANDLING =================
  remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;
  
  // Clear any existing tracks when stream changes
  remoteVideo.onemptied = () => {
    console.log("Remote video emptied");
  };
  
  remoteVideo.onloadedmetadata = () => {
    console.log("Remote video metadata loaded");
    remoteVideo.play().catch(e => console.warn("Auto-play prevented:", e));
  };

  // CRITICAL FIX: Proper ontrack handler
  pc.ontrack = (event) => {
    console.log("🚀 ontrack EVENT FIRED!", {
      trackKind: event.track.kind,
      trackId: event.track.id,
      streamId: event.streams[0]?.id,
      streams: event.streams.length
    });

    // Method 1: Use the stream from the event if available
    if (event.streams && event.streams[0]) {
      if (remoteVideo.srcObject !== event.streams[0]) {
        console.log("Setting remote video to incoming stream");
        remoteVideo.srcObject = event.streams[0];
      }
    } 
    // Method 2: Add track to our remote stream
    else if (event.track) {
      // Remove existing track of same kind
      const existingTracks = remoteStream.getTracks().filter(t => t.kind === event.track.kind);
      existingTracks.forEach(track => {
        console.log(`Removing existing ${track.kind} track`);
        remoteStream.removeTrack(track);
        track.stop();
      });
      
      // Add new track
      console.log(`Adding ${event.track.kind} track to remote stream`);
      remoteStream.addTrack(event.track);
      
      // Update video element
      if (remoteVideo.srcObject !== remoteStream) {
        remoteVideo.srcObject = remoteStream;
      }
    }
    
    // Track ended event
    event.track.onended = () => {
      console.log(`Remote ${event.track.kind} track ended`);
    };
  };

  // ================= ICE CANDIDATES =================
  pc.onicecandidate = (event) => {
    if (!event.candidate) {
      console.log("ICE candidate gathering complete");
      return;
    }
    
    const candidateCollection = isCaller ? "iceCaller" : "iceReceiver";
    console.log("Sending ICE candidate to", candidateCollection);
    
    addDoc(collection(db, "calls", callId, candidateCollection), {
      candidate: event.candidate.candidate,
      sdpMid: event.candidate.sdpMid,
      sdpMLineIndex: event.candidate.sdpMLineIndex,
      timestamp: Date.now()
    }).catch(err => console.error("Failed to send ICE candidate:", err));
  };

  // ================= SIGNALING: OFFER/ANSWER =================
  if (isCaller) {
    await createOffer(callId);
  } else {
    await listenForOffer(callId);
  }

  // ================= LISTEN FOR ICE CANDIDATES =================
  listenForIceCandidates();

  // ================= SETUP CONTROLS =================
  setupControls();
  
  // ================= SETUP CHAT =================
  setupChat();
  
  // ================= SETUP CALL END HANDLER =================
  setupEndCall();
}

// ================= CREATE OFFER (CALLER) =================
async function createOffer(callId) {
  try {
    console.log("Creating offer...");
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    
    console.log("Offer created:", offer.type);
    await pc.setLocalDescription(offer);
    
    // Save offer to Firestore
    await updateDoc(doc(db, "calls", callId), { 
      offer: {
        type: offer.type,
        sdp: offer.sdp
      },
      status: "connecting",
      updatedAt: Date.now()
    });
    
    console.log("✅ Offer saved to Firestore");
    
  } catch (err) {
    console.error("Failed to create offer:", err);
  }
}

// ================= LISTEN FOR OFFER (RECEIVER) =================
async function listenForOffer(callId) {
  console.log("Listening for offer from caller...");
  
  const callRef = doc(db, "calls", callId);
  
  onSnapshot(callRef, async (snapshot) => {
    const data = snapshot.data();
    if (data.offer && !pc.currentRemoteDescription) {
      console.log("✅ Offer received from caller");
      
      try {
        // Set remote description (the offer)
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log("Remote description (offer) set");
        
        // Create and send answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("Answer created:", answer.type);
        
        // Send answer back to Firestore
        await updateDoc(callRef, { 
          answer: {
            type: answer.type,
            sdp: answer.sdp
          },
          updatedAt: Date.now()
        });
        
        console.log("✅ Answer sent to Firestore");
        
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    }
  });
}

// ================= LISTEN FOR ICE CANDIDATES =================
function listenForIceCandidates() {
  const remoteCollection = isCaller ? "iceReceiver" : "iceCaller";
  const remoteCollectionRef = collection(db, "calls", callId, remoteCollection);
  
  console.log(`Listening for ICE candidates from ${remoteCollection}`);
  
  onSnapshot(remoteCollectionRef, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === "added") {
        const candidateData = change.doc.data();
        try {
          const candidate = new RTCIceCandidate({
            candidate: candidateData.candidate,
            sdpMid: candidateData.sdpMid,
            sdpMLineIndex: candidateData.sdpMLineIndex
          });
          
          await pc.addIceCandidate(candidate);
          console.log(`✅ Added ICE candidate from ${remoteCollection}`);
        } catch (err) {
          console.error(`Error adding ICE candidate from ${remoteCollection}:`, err);
        }
      }
    });
  });
}

// ================= CONTROLS =================
function setupControls() {
  const audioTrack = localStream.getAudioTracks()[0];
  const videoTrack = localStream.getVideoTracks()[0];

  // Mute/Unmute
  muteBtn.onclick = () => {
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      muteBtn.textContent = audioTrack.enabled ? "🎤" : "🔇";
      muteBtn.title = audioTrack.enabled ? "Mute" : "Unmute";
      console.log(`Audio ${audioTrack.enabled ? "unmuted" : "muted"}`);
    }
  };

  // Video On/Off
  videoBtn.onclick = () => {
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      videoBtn.textContent = videoTrack.enabled ? "🎥" : "📷";
      videoBtn.title = videoTrack.enabled ? "Turn off video" : "Turn on video";
      console.log(`Video ${videoTrack.enabled ? "enabled" : "disabled"}`);
    }
  };

  // Screen Share
  screenBtn.onclick = async () => {
    try {
      if (!screenStream) {
        // Start screen share
        screenStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true,
          audio: false 
        });
        
        const screenTrack = screenStream.getVideoTracks()[0];
        const videoSender = pc.getSenders().find(s => s.track && s.track.kind === "video");
        
        if (videoSender) {
          // Replace camera track with screen track
          await videoSender.replaceTrack(screenTrack);
          localVideo.srcObject = screenStream;
          screenBtn.textContent = "🖥️●";
          screenBtn.title = "Stop sharing";
          console.log("Screen sharing started");
        }
        
        // When screen sharing stops
        screenTrack.onended = () => {
          if (videoTrack) {
            const videoSender = pc.getSenders().find(s => s.track && s.track.kind === "video");
            if (videoSender) videoSender.replaceTrack(videoTrack);
            localVideo.srcObject = localStream;
            screenBtn.textContent = "🖥️";
            screenBtn.title = "Share screen";
            screenStream = null;
            console.log("Screen sharing stopped");
          }
        };
      } else {
        // Stop screen share manually
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
      }
    } catch (err) {
      console.error("Screen share error:", err);
      if (err.name !== 'NotAllowedError') {
        alert("Could not share screen. Please try again.");
      }
    }
  };
}

// ================= CHAT =================
function setupChat() {
  const chatQuery = query(
    collection(db, "chats", callId, "messages"),
    orderBy("createdAt")
  );

  // Send message
  sendBtn.onclick = async () => {
    const text = messageInput.value.trim();
    if (!text) return;
    
    try {
      await addDoc(collection(db, "chats", callId, "messages"), {
        text: text,
        sender: userId,
        senderName: auth.currentUser.email,
        createdAt: serverTimestamp()
      });
      messageInput.value = "";
      messageInput.focus();
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // Send on Enter key
  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendBtn.click();
    }
  });

  // Listen for messages
  onSnapshot(chatQuery, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const message = change.doc.data();
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${message.sender === userId ? "me" : "other"}`;
        
        const senderSpan = document.createElement("span");
        senderSpan.className = "sender";
        senderSpan.textContent = message.sender === userId ? "You" : "Them";
        
        const textSpan = document.createElement("span");
        textSpan.className = "text";
        textSpan.textContent = message.text;
        
        messageDiv.appendChild(senderSpan);
        messageDiv.appendChild(document.createElement("br"));
        messageDiv.appendChild(textSpan);
        
        messages.appendChild(messageDiv);
        messages.scrollTop = messages.scrollHeight;
      }
    });
  });
}

// ================= END CALL =================
function setupEndCall() {
  endBtn.onclick = async () => {
    console.log("Ending call...");
    
    // Close peer connection
    if (pc) {
      pc.close();
      pc = null;
    }
    
    // Stop all media tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }
    
    // Update call status in Firestore
    try {
      await updateDoc(doc(db, "calls", callId), { 
        status: "ended", 
        endedAt: Date.now(),
        endedBy: userId
      });
    } catch (err) {
      console.error("Error updating call status:", err);
    }
    
    // Redirect to dashboard
    location.href = "dashboard.html";
  };
  
  // Handle page close/refresh
  window.addEventListener('beforeunload', async () => {
    if (pc && pc.connectionState !== 'closed') {
      await updateDoc(doc(db, "calls", callId), { 
        status: "ended", 
        endedAt: Date.now(),
        endedBy: userId
      });
    }
  });
}

// ================= DEBUG UTILITY =================
// Add this to manually check remote video state
window.debugRemoteVideo = function() {
  console.log("=== REMOTE VIDEO DEBUG ===");
  console.log("Remote video element:", remoteVideo);
  console.log("Remote video srcObject:", remoteVideo.srcObject);
  console.log("Remote video readyState:", remoteVideo.readyState);
  console.log("Remote video paused:", remoteVideo.paused);
  console.log("Remote video error:", remoteVideo.error);
  
  if (remoteVideo.srcObject) {
    const stream = remoteVideo.srcObject;
    console.log("Remote stream tracks:", stream.getTracks().map(t => ({
      kind: t.kind,
      id: t.id,
      readyState: t.readyState,
      enabled: t.enabled
    })));
  }
  
  console.log("Peer connection state:", pc ? pc.connectionState : "No PC");
  console.log("ICE connection state:", pc ? pc.iceConnectionState : "No PC");
  console.log("=========================");
};
