/* =========================
   QUIZ SCOREBOARD (Public + Quizmaster)
   Sync: localStorage + storage-event (für 2 Tabs/Fenster)
   ========================= */

const STORAGE_KEY = "quiz_scoreboard_state_v2";

const SCORE_CORRECT = 4;
const SCORE_WRONG_OTHERS = 1;

/** Fragen hier pflegen (jetzt inkl. answer): */
/** Fragen hier pflegen (jetzt inkl. answer): */
const QUESTIONS = [
  { category: "Allgemeinwissen", text: "Welches Land hatte als erstes Frauenwahlrecht?", answer: "Neuseeland" },
  { category: "Allgemeinwissen", text: "Welches Land besitzt die meisten Zeitzonen (inkl. Überseegebiete)?", answer: "Frankreich" },
  { category: "Allgemeinwissen", text: "Wie viele Tasten hat ein klassisches Klavier?", answer: "88" },
  { category: "Allgemeinwissen", text: "Wie heißt die Hauptstadt von Montenegro?", answer: "Podgorica" },
  { category: "Allgemeinwissen", text: "Welche Blutgruppe gilt als Universalspender?", answer: "0 negativ" },
];

const mode = document.documentElement.dataset.mode || "public";

/* ---------- Helpers ---------- */
function clampInt(n, min, max){
  n = Number.isFinite(+n) ? Math.trunc(+n) : min;
  return Math.max(min, Math.min(max, n));
}
function questionCount(){
  return Math.max(QUESTIONS.length, 1);
}
function getQuestion(i){
  if (QUESTIONS.length === 0) return { category: "Keine Fragen", text: "Trage Fragen in app.js ein.", answer: "—" };
  return QUESTIONS[i];
}

/* ---------- State ---------- */
function defaultState(){
  return {
    questionIndex: 0,

    // Was der Beamer zeigt:
    // 0 = nur "Frage X" (Übergang), 1 = Frage sichtbar
    publicRevealStage: 0,

    teams: [
      { name: "Team 1", score: 0 },
      { name: "Team 2", score: 0 },
      { name: "Team 3", score: 0 },
      { name: "Team 4", score: 0 },
    ],

    history: []
  };
}

let state = loadState();

/* ---------- Storage ---------- */
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);

    parsed.teams = Array.isArray(parsed.teams) && parsed.teams.length ? parsed.teams : defaultState().teams;
    parsed.history = Array.isArray(parsed.history) ? parsed.history : [];
    parsed.questionIndex = clampInt(parsed.questionIndex ?? 0, 0, Math.max(0, QUESTIONS.length - 1));
    parsed.publicRevealStage = parsed.publicRevealStage === 1 ? 1 : 0;

    return parsed;
  }catch{
    return defaultState();
  }
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- Elements (shared) ---------- */
const el = {
  categoryPill: document.getElementById("categoryPill"),
  qCount: document.getElementById("qCount"),
  qNumber: document.getElementById("qNumber"),
  qText: document.getElementById("qText"),
  teams: document.getElementById("teams"),

  // Master-only:
  qmQuestion: document.getElementById("qmQuestion"),
  qmAnswer: document.getElementById("qmAnswer"),
  publicStatePill: document.getElementById("publicStatePill"),
  publicHint: document.getElementById("publicHint"),

  prevQuestionBtn: document.getElementById("prevQuestionBtn"),
  nextQuestionBtn: document.getElementById("nextQuestionBtn"),
  toggleRevealBtn: document.getElementById("toggleRevealBtn"),

  undoBtn: document.getElementById("undoBtn"),
  resetScoresBtn: document.getElementById("resetScoresBtn"),
  addTeamBtn: document.getElementById("addTeamBtn"),
  removeTeamBtn: document.getElementById("removeTeamBtn"),
  resetAllBtn: document.getElementById("resetAllBtn"),
};

/* ---------- Render ---------- */
function renderQuestion(){
  const total = questionCount();
  state.questionIndex = clampInt(state.questionIndex, 0, total - 1);

  const q = getQuestion(state.questionIndex);
  const number = state.questionIndex + 1;

  if (el.categoryPill) el.categoryPill.textContent = q.category || "Kategorie";
  if (el.qCount) el.qCount.textContent = `Frage ${number} / ${total}`;
  if (el.qNumber) el.qNumber.textContent = `Frage ${number}`;

  // Public view displays based on publicRevealStage
  if (mode === "public" && el.qText){
    el.qText.textContent = (state.publicRevealStage === 1) ? (q.text || "—") : "—";
  }

  // Master view always sees question + answer
  if (mode === "master"){
    if (el.qmQuestion) el.qmQuestion.textContent = q.text || "—";
    if (el.qmAnswer) el.qmAnswer.textContent = q.answer || "—";

    if (el.publicStatePill && el.publicHint){
      if (state.publicRevealStage === 1){
        el.publicStatePill.textContent = "Public: Frage sichtbar";
        el.publicHint.textContent = "Beamer zeigt aktuell die Frage.";
      } else {
        el.publicStatePill.textContent = "Public: Übergang";
        el.publicHint.textContent = "Beamer zeigt aktuell nur „Frage X“.";
      }
    }
  }
}

function renderTeams(){
  if (!el.teams) return;
  el.teams.innerHTML = "";

  state.teams.forEach((t, i) => {
    const card = document.createElement("div");
    card.className = "card teamCard";

    const top = document.createElement("div");
    top.className = "teamTop";

    const name = document.createElement("div");
    name.className = "teamName";
    name.textContent = t.name;

    // Nur auf Quizmaster editierbar
    if (mode === "master"){
      name.title = "Doppelklick zum Umbenennen";
      name.ondblclick = () => renameTeam(i);
    }

    const score = document.createElement("div");
    score.className = "score";
    score.textContent = t.score;

    top.appendChild(name);
    top.appendChild(score);

    card.appendChild(top);

    // Buttons nur auf Quizmaster
    if (mode === "master"){
      const actions = document.createElement("div");
      actions.className = "teamActions";

      const btnGood = document.createElement("button");
      btnGood.className = "actionBtn good";
      btnGood.textContent = "Richtig";
      btnGood.onclick = () => applyCorrect(i);

      const btnBad = document.createElement("button");
      btnBad.className = "actionBtn bad";
      btnBad.textContent = "Falsch";
      btnBad.onclick = () => applyWrong(i);

      actions.appendChild(btnGood);
      actions.appendChild(btnBad);
      card.appendChild(actions);
    }

    el.teams.appendChild(card);
  });

  if (mode === "master" && el.removeTeamBtn){
    el.removeTeamBtn.disabled = state.teams.length <= 1;
    el.removeTeamBtn.style.opacity = el.removeTeamBtn.disabled ? 0.5 : 1;
  }
}

function renderAll(){
  renderQuestion();
  renderTeams();

  if (mode === "master" && el.undoBtn){
    el.undoBtn.disabled = state.history.length === 0;
    el.undoBtn.style.opacity = el.undoBtn.disabled ? 0.5 : 1;
  }

  saveState();
}

/* ---------- Quizmaster controls ---------- */
function nextQuestion(){
  const total = questionCount();
  if (state.questionIndex >= total - 1) return;

  // neue Frage -> Public wieder auf Übergang setzen
  state.questionIndex++;
  state.publicRevealStage = 0;

  renderAll();
}

function prevQuestion(){
  if (state.questionIndex <= 0) return;

  state.questionIndex--;
  state.publicRevealStage = 0;

  renderAll();
}

function togglePublicReveal(){
  state.publicRevealStage = state.publicRevealStage === 1 ? 0 : 1;
  renderAll();
}

/* ---------- Scoring ---------- */
function applyCorrect(teamIndex){
  const deltas = state.teams.map((_, i) => (i === teamIndex ? SCORE_CORRECT : 0));
  applyScoreDeltas(deltas, { type: "score", deltas });
}

function applyWrong(teamIndex){
  const deltas = state.teams.map((_, i) => (i === teamIndex ? 0 : SCORE_WRONG_OTHERS));
  applyScoreDeltas(deltas, { type: "score", deltas });
}

function applyScoreDeltas(deltas, action){
  deltas.forEach((d, i) => { state.teams[i].score += d; });
  state.history.push(action);
  renderAll();
}

/* ---------- Undo ---------- */
function undo(){
  const last = state.history.pop();
  if(!last) return;

  if (last.type === "score"){
    last.deltas.forEach((d, i) => { state.teams[i].score -= d; });
  }

  if (last.type === "addTeam"){
    state.teams.pop();
  }

  if (last.type === "removeTeam"){
    state.teams.push(last.removedTeam);
  }

  if (last.type === "renameTeam"){
    state.teams[last.index].name = last.oldName;
  }

  if (last.type === "resetScores"){
    last.oldScores.forEach((s, i) => { state.teams[i].score = s; });
  }

  renderAll();
}

/* ---------- Teams ---------- */
function addTeam(){
  const nextNum = state.teams.length + 1;
  const newTeam = { name: `Team ${nextNum}`, score: 0 };
  state.teams.push(newTeam);
  state.history.push({ type: "addTeam" });
  renderAll();
}

function removeTeam(){
  if (state.teams.length <= 1) return;
  const removed = state.teams.pop();
  state.history.push({ type: "removeTeam", removedTeam: removed });
  renderAll();
}

function renameTeam(i){
  const current = state.teams[i].name;
  const newName = prompt("Neuer Teamname:", current);
  if(!newName || !newName.trim()) return;

  state.history.push({ type: "renameTeam", index: i, oldName: current });
  state.teams[i].name = newName.trim();
  renderAll();
}

/* ---------- Reset scores / reset all ---------- */
function resetScores(){
  const oldScores = state.teams.map(t => t.score);
  state.teams.forEach(t => t.score = 0);

  state.history.push({ type: "resetScores", oldScores });
  renderAll();
}

function resetAll(){
  const ok = confirm("Wirklich alles zurücksetzen? (Teams + Punkte + Frage)");
  if(!ok) return;
  state = defaultState();
  renderAll();
}

/* ---------- Sync: Wenn andere Seite speichert ---------- */
window.addEventListener("storage", (e) => {
  if (e.key !== STORAGE_KEY) return;
  state = loadState();
  // Public view soll sofort reagieren:
  renderQuestion();
  renderTeams();
});

/* ---------- Wire events (nur Quizmaster) ---------- */
if (mode === "master"){
  el.nextQuestionBtn?.addEventListener("click", nextQuestion);
  el.prevQuestionBtn?.addEventListener("click", prevQuestion);
  el.toggleRevealBtn?.addEventListener("click", togglePublicReveal);

  el.undoBtn?.addEventListener("click", undo);
  el.resetScoresBtn?.addEventListener("click", resetScores);
  el.addTeamBtn?.addEventListener("click", addTeam);
  el.removeTeamBtn?.addEventListener("click", removeTeam);
  el.resetAllBtn?.addEventListener("click", resetAll);

  // Tastatur: Links/Rechts für Fragen, Space für Public Toggle, Ctrl+Z Undo
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") nextQuestion();
    if (e.key === "ArrowLeft") prevQuestion();
    if (e.key === " ") { e.preventDefault(); togglePublicReveal(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") undo();
  });
}

renderAll();
