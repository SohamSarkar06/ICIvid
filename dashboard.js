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
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ================= FIREBASE =================
const app = initializeApp({
  apiKey: "AIzaSyBjPo05IXrOkzUVXsnx8wNaJwiRsXE2Onk",
  authDomain: "icivid.firebaseapp.com",
  projectId: "icivid"
});

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

// 🔥 NEW
const historyDiv = document.getElementById("callHistory");

// ================= HELPERS =================
function getChatId(a, b) {
  return [a, b].sort().join("_");
}

// ================= AUTH =================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    welcomeUser.textContent = `Hi, ${snap.data().username} 👋`;
  }

  listenForIncomingCalls(user.uid);
  loadCallHistory(user.uid);
});

// ================= LOGOUT =================
logoutBtn.onclick = async () => {
  await signOut(auth);
  location.href = "index.html";
};

// ================= SEARCH USERS (UNCHANGED) =================
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

// ================= CALL PIPELINE (UNCHANGED) =================
window.startCall = async (receiverId) => {
  const now = Date.now();

  const req = await addDoc(collection(db, "callRequests"), {
    from: auth.currentUser.uid,
    to: receiverId,
    status: "pending",
    createdAt: now,
    expiresAt: now + 5 * 60 * 1000
  });

  location.href = `call-wait.html?req=${req.id}`;
};

// ================= INCOMING CALL =================
function listenForIncomingCalls(uid) {
  const q = query(
    collection(db, "callRequests"),
    where("to", "==", uid),
    where("status", "==", "pending")
  );

  onSnapshot(q, snap => {
    snap.forEach(docu => {
      incomingModal.classList.remove("hidden");

      acceptBtn.onclick = async () => {
        await updateDoc(doc(db, "callRequests", docu.id), {
          status: "accepted"
        });

        await setDoc(doc(db, "calls", docu.id), {
          caller: docu.data().from,
          receiver: uid,
          startedAt: Date.now()
        });

        location.href = `call.html?call=${docu.id}`;
      };

      declineBtn.onclick = async () => {
        await updateDoc(doc(db, "callRequests", docu.id), {
          status: "declined"
        });
        incomingModal.classList.add("hidden");
      };
    });
  });
}

// ================= CALL HISTORY =================
function loadCallHistory(uid) {
  const q = query(
    collection(db, "callHistory"),
    where("participants", "array-contains", uid),
    orderBy("endedAt", "desc")
  );

  onSnapshot(q, async snap => {
    historyDiv.innerHTML = "";

    for (const docu of snap.docs) {
      const c = docu.data();
      const otherUid = c.participants.find(u => u !== uid);
      const userSnap = await getDoc(doc(db, "users", otherUid));

      const name = userSnap.exists() ? userSnap.data().username : "User";

      historyDiv.innerHTML += `
        <div class="history-item"
             onclick="openChatWith('${otherUid}')">
          <strong>${name}</strong><br>
          ⏱ ${Math.floor(c.duration / 60)}m ${c.duration % 60}s
        </div>
      `;
    }
  });
}

// ================= OPEN CHAT FROM HISTORY =================
window.openChatWith = async (otherUid) => {
  const uid = auth.currentUser.uid;
  const chatId = getChatId(uid, otherUid);

  const chatRef = doc(db, "chats", chatId);
  const snap = await getDoc(chatRef);

  if (!snap.exists()) {
    await setDoc(chatRef, {
      users: [uid, otherUid],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastMessage: ""
    });
  }

  location.href = `chat.html?chat=${chatId}&user=${otherUid}`;
};
