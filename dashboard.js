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
const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchUser");
const resultsDiv = document.getElementById("results");
const welcomeUser = document.getElementById("welcomeUser");
const incomingModal = document.getElementById("incomingCall");
const acceptBtn = document.getElementById("accept");
const declineBtn = document.getElementById("decline");

// ================= AUTH =================
onAuthStateChanged(auth, async (user) => {
  if (!user) return location.href = "index.html";

  const snap = await getDoc(doc(db, "users", user.uid));
  welcomeUser.textContent = `Hi, ${snap.data().username} 👋`;

  listenForIncomingCalls(user.uid);
});

// ================= LOGOUT =================
logoutBtn.onclick = async () => {
  await signOut(auth);
  location.href = "index.html";
};

// ================= SEARCH =================
searchInput.addEventListener("input", async () => {
  const value = searchInput.value.trim().toLowerCase();
  resultsDiv.innerHTML = "";
  if (!value) return;

  const snap = await getDocs(collection(db, "users"));

  snap.forEach(d => {
    if (d.id === auth.currentUser.uid) return;
    const u = d.data();
    if (u.username?.toLowerCase().includes(value)) {
      resultsDiv.innerHTML += `
        <div class="user-row">
          <span>${u.username}</span>
          <button onclick="startCall('${u.peerId}')">Call</button>
        </div>
      `;
    }
  });
});

// ================= CALL REQUEST =================
window.startCall = async (peerId) => {
  await addDoc(collection(db, "callRequests"), {
    from: auth.currentUser.uid,
    toPeer: peerId,
    status: "pending",
    createdAt: Date.now()
  });

  // Caller waits in call page
  location.href = `call.html?peer=${peerId}`;
};

// ================= INCOMING =================
function listenForIncomingCalls(uid) {
  const q = query(
    collection(db, "callRequests"),
    where("toPeer", "==", uid),
    where("status", "==", "pending")
  );

  onSnapshot(q, snap => {
    snap.forEach(d => showIncoming(d.id, d.data()));
  });
}

// ================= MODAL =================
function showIncoming(id, data) {
  incomingModal.classList.remove("hidden");

  acceptBtn.onclick = async () => {
    await updateDoc(doc(db, "callRequests", id), { status: "accepted" });
    location.href = `call.html?peer=${data.from}`;
  };

  declineBtn.onclick = async () => {
    await updateDoc(doc(db, "callRequests", id), { status: "declined" });
    incomingModal.classList.add("hidden");
  };
}
