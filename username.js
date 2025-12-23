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

const firebaseConfig = {
  apiKey: "AIzaSyBjPo05IXrOkzUVXsnx8wNaJwiRsXE2Onk",
  authDomain: "icivid.firebaseapp.com",
  projectId: "icivid",
  appId: "1:2684424094:web:2d63b2cb5cf98615b8108f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const usernameInput = document.getElementById("username");
const saveBtn = document.getElementById("saveUsername");
const error = document.getElementById("error");

// 🔒 Protect page
onAuthStateChanged(auth, (user) => {
  if (!user || !user.emailVerified) {
    location.href = "index.html";
  }
});

// ✅ Save username
saveBtn.addEventListener("click", async () => {
  const uname = usernameInput.value.trim().toLowerCase();

  if (!uname) {
    error.textContent = "Username cannot be empty";
    return;
  }

  try {
    // 🔍 Check uniqueness
    const taken = await getDoc(doc(db, "usernames", uname));
    if (taken.exists()) {
      error.textContent = "Username already taken";
      return;
    }

    const uid = auth.currentUser.uid;

    // ✅ Reserve username
    await setDoc(doc(db, "usernames", uname), { uid });

    // ✅ Save to user profile
    await setDoc(
      doc(db, "users", uid),
      { username: uname },
      { merge: true }
    );

    // ✅ FORCE REDIRECT (CRITICAL)
    location.href = "dashboard.html";

  } catch (err) {
    error.textContent = err.message;
  }
});
