import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ================= INIT =================
const app = initializeApp({
  apiKey: "AIzaSyBjPo05IXrOkzUVXsnx8wNaJwiRsXE2Onk",
  authDomain: "icivid.firebaseapp.com",
  projectId: "icivid"
});

const auth = getAuth(app);
const db = getFirestore(app);

const historyList = document.getElementById("historyList");

// Helper
const chatId = (a, b) => [a, b].sort().join("_");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }

  const q = query(
    collection(db, "callHistory"),
    where("participants", "array-contains", user.uid),
    orderBy("endedAt", "desc")
  );

  onSnapshot(q, async (snap) => {
    historyList.innerHTML = "";

    if (snap.empty) {
      historyList.innerHTML = "<p>No call history yet</p>";
      return;
    }

    for (const d of snap.docs) {
      const h = d.data();
      const otherUid = h.participants.find(u => u !== user.uid);

      const userSnap = await getDoc(doc(db, "users", otherUid));
      const name = userSnap.exists()
        ? userSnap.data().username
        : "User";

      const mins = Math.floor(h.duration / 60);
      const secs = h.duration % 60;

      historyList.innerHTML += `
        <div class="history-item"
             onclick="location.href='chat.html?chat=${chatId(user.uid, otherUid)}&user=${otherUid}'">
          <strong>${name}</strong><br>
          <small>⏱ ${mins}m ${secs}s</small>
        </div>
      `;
    }
  });
});
