import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ================= INIT =================
const app = initializeApp({
  apiKey:"AIzaSyBjPo05IXrOkzUVXsnx8wNaJwiRsXE2Onk",
  authDomain:"icivid.firebaseapp.com",
  projectId:"icivid"
});

const auth = getAuth(app);
const db = getFirestore(app);

// ================= DOM =================
const results = document.getElementById("results");
const recent = document.getElementById("recentChats");
const input = document.getElementById("searchUser");

// ================= HELPERS =================
const chatId = (a,b)=>[a,b].sort().join("_");

// ================= AUTH =================
onAuthStateChanged(auth, u=>{
  if(!u) location.href="index.html";
  loadRecent(u.uid);
});

// ================= SEARCH USERS =================
input.oninput = async () => {
  const v = input.value.toLowerCase().trim();
  results.innerHTML = "";

  if (!v) {
    results.style.display = "none";
    recent.style.display = "block";
    return;
  }

  recent.style.display = "none";
  results.style.display = "block";

  const snap = await getDocs(collection(db,"users"));

  snap.forEach(d=>{
    if(d.id === auth.currentUser.uid) return;
    if(!d.data().username) return;

    if(d.data().username.toLowerCase().includes(v)){
      results.innerHTML += `
        <div class="user-row" data-uid="${d.id}">
          <strong>${d.data().username}</strong>
        </div>`;
    }
  });
};

// ================= CLICK HANDLER (SHARED) =================
function handleUserClick(container){
  container.addEventListener("click", e=>{
    const row = e.target.closest(".user-row");
    if (!row) return;

    document.querySelectorAll(".user-row.selected")
      .forEach(el=>el.classList.remove("selected"));

    row.classList.add("selected");

    setTimeout(()=>{
      openChat(row.dataset.uid);
    },180);
  });
}

handleUserClick(results);
handleUserClick(recent);

// ================= OPEN CHAT =================
window.openChat = async (other) => {
  const id = chatId(auth.currentUser.uid, other);
  const ref = doc(db,"chats",id);

  if(!(await getDoc(ref)).exists()){
    await setDoc(ref,{
      users:[auth.currentUser.uid,other],
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp(),
      lastMessage:""
    });
  }

  location.href=`chat.html?chat=${id}&user=${other}`;
};

// ================= RECENT CHATS =================
function loadRecent(uid){
  const q = query(
    collection(db,"chats"),
    where("users","array-contains",uid),
    orderBy("updatedAt","desc")
  );

  onSnapshot(q, async snap=>{
    recent.innerHTML = "";

    if (snap.empty) {
      recent.innerHTML = `<p style="opacity:.6">No recent chats</p>`;
      return;
    }

    for(const d of snap.docs){
      const c = d.data();
      const other = c.users.find(u=>u!==uid);

      const uSnap = await getDoc(doc(db,"users",other));
      const name = uSnap.exists()?uSnap.data().username:"User";

      recent.innerHTML += `
        <div class="user-row" data-uid="${other}">
          <strong>${name}</strong>
          <div class="last-msg">${c.lastMessage || "Start chatting"}</div>
        </div>`;
    }
  });
}
