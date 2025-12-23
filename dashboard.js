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
  setDoc,
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

// ================= AUTH (SINGLE SOURCE OF TRUTH) =================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }

  // Show username
  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists() && snap.data().username) {
    welcomeUser.textContent = `Hi, ${snap.data().username} 👋`;
  }

  // Listen for incoming calls AFTER auth is ready
  listenForIncomingCalls(user.uid);
});

// ================= LOGOUT =================
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});

// ================= SEARCH USERS =================
searchInput.addEventListener("input", async () => {
  const value = searchInput.value.trim().toLowerCase();
  resultsDiv.innerHTML = "";
  if (!value) return;

  const snap = await getDocs(collection(db, "users"));

  snap.forEach(docu => {
    const user = docu.data();
    if (!user.username) return;
    if (docu.id === auth.currentUser.uid) return;

    if (user.username.toLowerCase().includes(value)) {
      resultsDiv.innerHTML += `
        <div class="user-row">
          <span>${user.username}</span>
          <button onclick="startCall('${docu.id}')">Call</button>
        </div>
      `;
    }
  });
});

// ================= SEND CALL REQUEST =================
window.startCall = async (receiverId) => {
  const callRef = await addDoc(collection(db, "calls"), {
    caller: auth.currentUser.uid,
    receiver: receiverId,
    createdAt: Date.now(),
    status: "ringing"
  });

  // Optional: create callRequests if you want ringing UI
  await addDoc(collection(db, "callRequests"), {
    callId: callRef.id,
    from: auth.currentUser.uid,
    to: receiverId,
    status: "pending",
    createdAt: Date.now()
  });

  // 🔑 Caller goes to call page IMMEDIATELY
  location.href = `call.html?call=${callRef.id}`;
};


// ================= INCOMING CALL LISTENER =================
function listenForIncomingCalls(uid) {
  const q = query(
    collection(db, "callRequests"),
    where("to", "==", uid),
    where("status", "==", "pending")
  );

  onSnapshot(q, snap => {
    snap.forEach(docu => {
      showIncoming(docu.id, docu.data());
    });
  });
}

// ================= INCOMING CALL UI (FIXED) =================
function showIncoming(callId, data) {
  incomingModal.classList.remove("hidden");

  acceptBtn.onclick = async () => {
    try {
      // 1️⃣ Accept request
      await updateDoc(doc(db, "callRequests", callId), {
        status: "accepted"
      });

      // 2️⃣ Create signaling document
      await setDoc(doc(db, "calls", callId), {
        caller: data.from,
        receiver: auth.currentUser.uid,
        createdAt: Date.now()
      });

      // 3️⃣ Move receiver into call
      location.href = `call.html?call=${callId}`;
    } catch (err) {
      console.error("Accept failed:", err);
      alert("Failed to accept call");
    }
  };

  declineBtn.onclick = async () => {
    await updateDoc(doc(db, "callRequests", callId), {
      status: "declined"
    });
    incomingModal.classList.add("hidden");
  };
}
