// ================= IMPORTS =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyBjPo05IXrOkzUVXsnx8wNaJwiRsXE2Onk",
  authDomain: "icivid.firebaseapp.com",
  projectId: "icivid",
  appId: "1:2684424094:web:2d63b2cb5cf98615b8108f"
};

// ================= INIT =================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= DOM =================
const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchUser");
const resultsDiv = document.getElementById("results");
const welcomeUser = document.getElementById("welcomeUser");
const incomingModal = document.getElementById("incomingCall");
const acceptBtn = document.getElementById("accept");
const declineBtn = document.getElementById("decline");

// ================= AUTH =================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }

  // Show username
  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    welcomeUser.textContent = `Hi, ${snap.data().username} 👋`;
  }

  // Start listening for incoming calls
  listenForIncomingCalls(user.uid);
});

// ================= LOGOUT =================
logoutBtn.onclick = async () => {
  await signOut(auth);
  location.href = "index.html";
};

// ================= SEARCH USERS =================
searchInput.addEventListener("input", async () => {
  const value = searchInput.value.trim().toLowerCase();
  resultsDiv.innerHTML = "";
  if (!value) return;

  const snap = await getDocs(collection(db, "users"));

  snap.forEach(d => {
    if (d.id === auth.currentUser.uid) return;

    const u = d.data();
    if (!u.username || !u.peerId) return;

    if (u.username.toLowerCase().includes(value)) {
      resultsDiv.innerHTML += `
        <div class="user-row">
          <span>${u.username}</span>
          <button onclick="startCall('${d.id}', '${u.peerId}')">
            Call
          </button>
        </div>
      `;
    }
  });
});

// ================= SEND CALL REQUEST =================
window.startCall = async (receiverUid, receiverPeerId) => {
  await addDoc(collection(db, "callRequests"), {
    fromUid: auth.currentUser.uid,
    fromPeer: auth.currentUser.uid,   // peerId = uid
    toUid: receiverUid,
    toPeer: receiverPeerId,
    status: "pending",
    createdAt: Date.now()
  });

  // Caller immediately joins call page
  location.href = `call.html?peer=${receiverPeerId}`;
};

// ================= INCOMING CALL LISTENER =================
function listenForIncomingCalls(myUid) {
  const q = query(
    collection(db, "callRequests"),
    where("toUid", "==", myUid),
    where("status", "==", "pending")
  );

  onSnapshot(q, snap => {
    snap.forEach(d => {
      showIncoming(d.id, d.data());
    });
  });
}

// ================= INCOMING CALL UI =================
function showIncoming(requestId, data) {
  incomingModal.classList.remove("hidden");

  acceptBtn.onclick = async () => {
    await updateDoc(doc(db, "callRequests", requestId), {
      status: "accepted"
    });

    // Receiver joins call using caller peerId
    location.href = `call.html?peer=${data.fromPeer}`;
  };

  declineBtn.onclick = async () => {
    await updateDoc(doc(db, "callRequests", requestId), {
      status: "declined"
    });
    incomingModal.classList.add("hidden");
  };
}
