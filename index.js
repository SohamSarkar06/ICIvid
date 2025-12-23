// ================= IMPORTS =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ================= FIREBASE INIT =================
const firebaseConfig = {
  apiKey: "AIzaSyBjPo05IXrOkzUVXsnx8wNaJwiRsXE2Onk",
  authDomain: "icivid.firebaseapp.com",
  projectId: "icivid",
  appId: "1:2684424094:web:2d63b2cb5cf98615b8108f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= PERSIST LOGIN =================
setPersistence(auth, browserLocalPersistence);

// ================= DOM ELEMENTS =================
const email = document.getElementById("email");
const password = document.getElementById("password");
const signupBtn = document.getElementById("signup");
const loginBtn = document.getElementById("login");
const forgotPass = document.getElementById("forgotPass");
const togglePass = document.getElementById("togglePass");

// ================= SHOW / HIDE PASSWORD =================
togglePass.addEventListener("click", () => {
  password.type = password.type === "password" ? "text" : "password";
});

// ================= AUTH STATE HANDLER =================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  if (!user.emailVerified) {
    location.href = "verify.html";
    return;
  }

  // ⚠️ DO NOT redirect if already on username page
  if (location.pathname.includes("username")) return;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || !snap.data().username) {
    location.href = "username.html";
  } else {
    location.href = "dashboard.html";
  }
});



// ================= SIGN UP =================
signupBtn.addEventListener("click", async () => {
  if (!email.value || !password.value) {
    alert("Enter email and password");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      email.value,
      password.value
    );

    // ✅ SEND VERIFICATION FIRST
    await sendEmailVerification(cred.user);

    // ✅ CREATE USER DOC
    await setDoc(doc(db, "users", cred.user.uid), {
      email: cred.user.email,
      createdAt: Date.now()
    });

    alert("Verification email sent. Check your inbox.");

    // ✅ MANUAL REDIRECT (NOT onAuthStateChanged)
    location.href = "verify.html";
  } catch (err) {
    alert(err.message);
  }
});


// ================= LOGIN =================
loginBtn.addEventListener("click", async () => {
  try {
    const cred = await signInWithEmailAndPassword(
      auth,
      email.value,
      password.value
    );

    if (!cred.user.emailVerified) {
      alert("Verify your email first");
      location.href = "verify.html";
      return;
    }

    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (!snap.data().username) {
      location.href = "username.html";
    } else {
      location.href = "dashboard.html";
    }
  } catch (err) {
    alert(err.message);
  }
});

// ================= FORGOT PASSWORD =================
forgotPass.addEventListener("click", async () => {
  const emailValue = email.value.trim();
  if (!emailValue) {
    alert("Enter your email first");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, emailValue);
    alert("Password reset email sent. Check Gmail.");
  } catch (err) {
  switch (err.code) {
    case "auth/wrong-password":
      alert("❌ Incorrect password. Please try again.");
      break;

    case "auth/user-not-found":
      alert("❌ No account found with this email.");
      break;

    case "auth/invalid-email":
      alert("❌ Invalid email format.");
      break;

    case "auth/too-many-requests":
      alert("⚠️ Too many failed attempts. Try again later.");
      break;

    default:
      alert("❌ Login failed: " + err.message);
  }
}

});
