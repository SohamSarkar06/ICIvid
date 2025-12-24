import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, getDoc, doc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyBjPo05IXrOkzUVXsnx8wNaJwiRsXE2Onk",
  authDomain: "icivid.firebaseapp.com",
  projectId: "icivid"
});

const auth = getAuth(app);
const db = getFirestore(app);
const historyList = document.getElementById("historyList");

function chatId(a,b){ return [a,b].sort().join("_"); }

onAuthStateChanged(auth, user => {
  if (!user) location.href="index.html";

  const q = query(
    collection(db,"callHistory"),
    where("participants","array-contains",user.uid),
    orderBy("endedAt","desc")
  );

  onSnapshot(q, async snap => {
    historyList.innerHTML="";
    for(const d of snap.docs){
      const h = d.data();
      const other = h.participants.find(u=>u!==user.uid);
      const uSnap = await getDoc(doc(db,"users",other));
      historyList.innerHTML+=`
        <div class="history-item"
             onclick="location.href='chat.html?chat=${chatId(user.uid,other)}&user=${other}'">
          <strong>${uSnap.data().username}</strong>
          <small>${Math.floor(h.duration/60)}m ${h.duration%60}s</small>
        </div>`;
    }
  });
});
