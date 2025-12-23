import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
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
const usernameInput = document.getElementById("username");
const saveBtn = document.getElementById("saveUsername");
const error = document.getElementById("error");

// ================= AUTH PROTECTION =================
onAuthStateChanged(auth, (user) => {
  if (!user || !user.emailVerified) {
    location.href = "index.html";
  }
});

// ================= SAVE USERNAME =================
saveBtn.addEventListener("click", async () => {
  const uname = usernameInput.value.trim().toLowerCase();

  if (!uname) {
    error.textContent = "Username cannot be empty";
    return;
  }

  try {
    // 🔍 Check username uniqueness
    const taken = await getDoc(doc(db, "usernames", uname));
    if (taken.exists()) {
      error.textContent = "Username already taken";
      return;
    }

    const uid = auth.currentUser.uid;

    // ✅ Reserve username
    await setDoc(doc(db, "usernames", uname), { uid });

    // ✅ Save user profile WITH peerId (IMPORTANT)
    await setDoc(
      doc(db, "users", uid),
      {
        username: uname,
        peerId: uid,          // 🔥 PeerJS will use UID as peerId
        updatedAt: Date.now()
      },
      { merge: true }
    );

    // ✅ Redirect to dashboard
    location.href = "dashboard.html";

  } catch (err) {
    console.error(err);
    error.textContent = err.message || "Something went wrong";
  }
});
