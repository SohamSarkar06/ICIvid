import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth,onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore,collection,getDocs,doc,setDoc,getDoc,serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app=initializeApp({
 apiKey:"AIzaSyBjPo05IXrOkzUVXsnx8wNaJwiRsXE2Onk",
 authDomain:"icivid.firebaseapp.com",
 projectId:"icivid"
});

const auth=getAuth(app);
const db=getFirestore(app);
const results=document.getElementById("results");
const input=document.getElementById("searchUser");

const chatId=(a,b)=>[a,b].sort().join("_");

onAuthStateChanged(auth,u=>{
 if(!u) location.href="index.html";
});

input.oninput=async()=>{
 const v=input.value.toLowerCase();
 results.innerHTML="";
 if(!v) return;

 const snap=await getDocs(collection(db,"users"));
 snap.forEach(d=>{
  if(d.id===auth.currentUser.uid) return;
  if(d.data().username.toLowerCase().includes(v)){
    results.innerHTML+=`
      <div class="user-row"
        onclick="openChat('${d.id}')">${d.data().username}</div>`;
  }
 });
};

window.openChat=async(other)=>{
 const id=chatId(auth.currentUser.uid,other);
 const ref=doc(db,"chats",id);
 if(!(await getDoc(ref)).exists()){
   await setDoc(ref,{
     users:[auth.currentUser.uid,other],
     createdAt:serverTimestamp()
   });
 }
 location.href=`chat.html?chat=${id}&user=${other}`;
};
