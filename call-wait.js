// ================= IMPORTS =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  onSnapshot,
  updateDoc
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

// ================= REQUEST =================
const reqId = new URLSearchParams(location.search).get("req");
const reqRef = doc(db, "callRequests", reqId);

// ================= WAIT FOR AUTH =================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }

  // ================= AUTO-EXPIRE =================
  const expireTimer = setTimeout(async () => {
    await updateDoc(reqRef, { status: "expired" });
  }, 5 * 60 * 1000);

  // ================= LISTEN FOR STATUS =================
  onSnapshot(reqRef, snap => {
    if (!snap.exists()) return;

    const { status } = snap.data();

    if (status === "accepted") {
      clearTimeout(expireTimer);
      location.href = `call.html?call=${reqId}`;
    }

    if (status === "declined" || status === "expired") {
      clearTimeout(expireTimer);
      alert("Call not answered");
      location.href = "dashboard.html";
    }
  });
});
