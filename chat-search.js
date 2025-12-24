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

// ================= CLICK HANDLER =================
function bindClick(container){
  container.addEventListener("click", e=>{
    const row = e.target.closest(".user-row");
    if(!row) return;

    document.querySelectorAll(".user-row.selected")
      .forEach(el=>el.classList.remove("selected"));

    row.classList.add("selected");

    setTimeout(()=>{
      openChat(row.dataset.uid);
    },150);
  });
}

bindClick(results);
bindClick(recent);

// ================= OPEN CHAT =================
async function openChat(other){
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
}

// ================= RECENT CHATS (FIXED) =================
function loadRecent(uid){
  const q = query(
    collection(db,"chats"),
    where("users","array-contains",uid)
  );

  onSnapshot(q, async snap=>{
    recent.innerHTML = "";

    if(snap.empty){
      recent.innerHTML = `<p style="opacity:.6">No recent chats</p>`;
      return;
    }

    // 🔥 SORT BY updatedAt (fallback safe)
    const chats = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b)=>{
        const ta = a.updatedAt?.toMillis?.() || 0;
        const tb = b.updatedAt?.toMillis?.() || 0;
        return tb - ta;
      });

    for(const c of chats){
      const otherUid = c.users.find(u=>u!==uid);
      const uSnap = await getDoc(doc(db,"users",otherUid));
      const name = uSnap.exists() ? uSnap.data().username : "User";

      const lastSeen = c[`lastSeen_${uid}`] || 0;
      const updatedAt = c.updatedAt?.toMillis?.() || 0;

      const unread = updatedAt > lastSeen;

      recent.innerHTML += `
        <div class="user-row" data-uid="${otherUid}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong>${name}</strong>
            ${unread ? `<span style="
              width:8px;
              height:8px;
              background:#3b82f6;
              border-radius:50%;
              display:inline-block;"></span>` : ""}
          </div>
          <small style="opacity:.6">${c.lastMessage || "Start chatting"}</small>
        </div>`;
    }
  });
}
