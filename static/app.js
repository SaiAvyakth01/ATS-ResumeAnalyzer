// ---------- Tabs ----------
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ---------- ATS Analyzer (client-side) ----------
const resumeText = document.getElementById("resumeText");
const jdText = document.getElementById("jdText");
const sampleJdBtn = document.getElementById("sampleJdBtn");
const runAtsBtn = document.getElementById("runAtsBtn");
const resetAtsBtn = document.getElementById("resetAtsBtn");

const atsResults = document.getElementById("atsResults");
const atsScore = document.getElementById("atsScore");
const atsFill = document.getElementById("atsFill");
const atsNote = document.getElementById("atsNote");

const matchedList = document.getElementById("matchedList");
const missingList = document.getElementById("missingList");
const suggestions = document.getElementById("suggestions");
const copyMissingBtn = document.getElementById("copyMissingBtn");

const SAMPLE_JD = `Looking for a Software Engineer with experience in:
JavaScript, React, HTML, CSS
REST APIs, API Testing, Postman
SQL, Git, Agile/Scrum
Nice to have: Docker, AWS, CI/CD, Unit Testing`;

const STOPWORDS = new Set(["a","an","the","and","or","of","to","in","on","for","with","is","are","was","were","be","been","being"]);

function norm(s){
  return (s||"").toLowerCase().replace(/[^\w\s\+\#\/\.\-]/g," ").replace(/\s+/g," ").trim();
}
function extractKeywords(jd){
  const tokens = norm(jd).split(" ").filter(t => t && !STOPWORDS.has(t) && t.length >= 3);
  return [...new Set(tokens)];
}
function analyzeATS(resume, jd){
  const r = norm(resume);
  const kws = extractKeywords(jd);
  const matched = [];
  const missing = [];
  kws.forEach(k => (r.includes(k) ? matched : missing).push(k));
  const score = Math.round((matched.length / Math.max(1,kws.length))*100);

  const tips = [
    "Use exact JD keywords inside Experience bullets (not only Skills).",
    "Avoid tables/graphics; use single-column format for ATS parsing.",
    "Use standard headings: Experience, Skills, Education."
  ];
  if(score < 50) tips.push("Low match — add more relevant skills + job title terms you truly have.");
  else if(score < 70) tips.push("Close — add 3–6 missing keywords naturally and re-check.");
  else tips.push("Strong match — now add measurable outcomes (numbers) to stand out.");

  return {score, matched: matched.sort(), missing: missing.sort(), tips};
}

function renderChips(el, arr, cls){
  el.innerHTML = "";
  if(arr.length === 0){
    const span = document.createElement("div");
    span.className = "chip " + cls;
    span.textContent = "—";
    el.appendChild(span);
    return;
  }
  arr.forEach(x => {
    const span = document.createElement("div");
    span.className = "chip " + cls;
    span.textContent = x;
    el.appendChild(span);
  });
}

sampleJdBtn.addEventListener("click", () => jdText.value = SAMPLE_JD);

resetAtsBtn.addEventListener("click", () => {
  resumeText.value = "";
  jdText.value = "";
  atsResults.style.display = "none";
});

runAtsBtn.addEventListener("click", () => {
  if(!resumeText.value.trim()) return alert("Paste resume text first.");
  if(!jdText.value.trim()) return alert("Paste job description first.");

  const out = analyzeATS(resumeText.value, jdText.value);

  atsScore.textContent = out.score + "%";
  atsFill.style.width = out.score + "%";

  atsResults.style.display = "block";
  atsNote.textContent = out.score >= 70 ? "Strong match 🎉" : (out.score >= 50 ? "Medium match" : "Low match");

  renderChips(matchedList, out.matched, "good");
  renderChips(missingList, out.missing, "bad");

  suggestions.innerHTML = "";
  out.tips.forEach(t => {
    const li = document.createElement("li");
    li.textContent = t;
    suggestions.appendChild(li);
  });
});

copyMissingBtn.addEventListener("click", async () => {
  const chips = [...missingList.querySelectorAll(".chip")].map(x => x.textContent).filter(Boolean);
  const text = chips.join(", ");
  if(!text || text === "—") return alert("No missing keywords to copy yet.");
  try{
    await navigator.clipboard.writeText(text);
    alert("Missing keywords copied ✅");
  }catch{
    prompt("Copy missing keywords:", text);
  }
});

// ---------- Voice Recording + Upload ----------
const startRecBtn = document.getElementById("startRecBtn");
const stopRecBtn = document.getElementById("stopRecBtn");
const uploadRecBtn = document.getElementById("uploadRecBtn");
const previewAudio = document.getElementById("previewAudio");
const refreshVoicesBtn = document.getElementById("refreshVoicesBtn");
const voiceList = document.getElementById("voiceList");

let mediaRecorder;
let audioChunks = [];
let recordedBlob;

startRecBtn.addEventListener("click", async () => {
  recordedBlob = null;
  audioChunks = [];
  previewAudio.src = "";

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
  mediaRecorder.onstop = () => {
    recordedBlob = new Blob(audioChunks, { type: audioChunks[0]?.type || "audio/webm" });
    previewAudio.src = URL.createObjectURL(recordedBlob);
    uploadRecBtn.disabled = false;
  };

  mediaRecorder.start();
  startRecBtn.disabled = true;
  stopRecBtn.disabled = false;
});

stopRecBtn.addEventListener("click", () => {
  if(mediaRecorder && mediaRecorder.state !== "inactive"){
    mediaRecorder.stop();
  }
  startRecBtn.disabled = false;
  stopRecBtn.disabled = true;
});

uploadRecBtn.addEventListener("click", async () => {
  if(!recordedBlob) return alert("Record something first.");

  const ext = recordedBlob.type.includes("ogg") ? "ogg" :
              recordedBlob.type.includes("wav") ? "wav" :
              recordedBlob.type.includes("mp3") ? "mp3" :
              recordedBlob.type.includes("m4a") ? "m4a" : "webm";

  const fd = new FormData();
  fd.append("file", recordedBlob, `my_voice_${Date.now()}.${ext}`);

  const res = await fetch("/api/voice/upload", { method:"POST", body: fd });
  const json = await res.json();
  if(!res.ok) return alert(json.error || "Upload failed");

  alert("Saved ✅ " + json.savedAs);
  uploadRecBtn.disabled = true;
  await loadVoiceList();
});

async function loadVoiceList(){
  const res = await fetch("/api/voice/list");
  const json = await res.json();
  voiceList.innerHTML = "";

  (json.voices || []).forEach(fn => {
    const row = document.createElement("div");
    row.className = "listItem";
    row.innerHTML = `<div>${fn}</div>
      <div class="row">
        <audio controls src="/speakers/${encodeURIComponent(fn)}"></audio>
      </div>`;
    voiceList.appendChild(row);
  });

  if((json.voices||[]).length === 0){
    const empty = document.createElement("div");
    empty.className = "mini";
    empty.textContent = "No saved samples yet.";
    voiceList.appendChild(empty);
  }
}

refreshVoicesBtn.addEventListener("click", loadVoiceList);
loadVoiceList();

// ---------- Browser TTS (safe, no cloning) ----------
const ttsText = document.getElementById("ttsText");
const voiceSelect = document.getElementById("voiceSelect");
const speakBtn = document.getElementById("speakBtn");
const stopSpeakBtn = document.getElementById("stopSpeakBtn");

function loadVoices(){
  const voices = window.speechSynthesis.getVoices();
  voiceSelect.innerHTML = "";
  voices.forEach((v, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${v.name} (${v.lang})`;
    voiceSelect.appendChild(opt);
  });
}
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

speakBtn.addEventListener("click", () => {
  const text = ttsText.value.trim();
  if(!text) return alert("Type text to speak first.");

  const voices = window.speechSynthesis.getVoices();
  const idx = Number(voiceSelect.value || 0);
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voices[idx] || null;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
});
stopSpeakBtn.addEventListener("click", () => window.speechSynthesis.cancel());

// ---------- AI Call Agent Chat (connect to your Worker) ----------
const agentBaseUrl = document.getElementById("agentBaseUrl");
const checkAgentBtn = document.getElementById("checkAgentBtn");
const agentHealth = document.getElementById("agentHealth");

const chatLog = document.getElementById("chatLog");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");

function addMsg(role, text){
  const div = document.createElement("div");
  div.className = "msg " + (role === "user" ? "user" : "bot");
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

checkAgentBtn.addEventListener("click", async () => {
  const base = agentBaseUrl.value.trim().replace(/\/+$/,"");
  if(!base) return alert("Paste your deployed agent base URL first.");
  try{
    const res = await fetch(`${base}/api/health`);
    const json = await res.json();
    agentHealth.textContent = json.ok ? `✅ Health OK — ${json.time}` : "Health not ok";
  }catch(e){
    agentHealth.textContent = "❌ Could not reach agent. Check URL / deployment.";
  }
});

sendChatBtn.addEventListener("click", async () => {
  const base = agentBaseUrl.value.trim().replace(/\/+$/,"");
  const text = chatInput.value.trim();
  if(!base) return alert("Paste your deployed agent base URL first.");
  if(!text) return;

  addMsg("user", text);
  chatInput.value = "";

  try{
    // Your worker supports POST /api/chat and returns { reply } 【2-8c2683】
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ messages: [{ role:"user", content:text }] })
    });
    const json = await res.json();
    addMsg("bot", json.reply || "(no reply)");
  }catch{
    addMsg("bot", "❌ Failed to call agent. Check URL and CORS.");
  }
});