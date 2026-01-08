/* =========================
   QUIZ SCOREBOARD
   ========================= */

/** Fragen hier pflegen: */
const QUESTIONS = [
  // Beispiel – ersetze/erweitere nach Bedarf
  { category: "Allgemeinwissen", text: "Welches Land hatte als erstes Frauenwahlrecht?" },
  { category: "Allgemeinwissen", text: "Welches Land besitzt die meisten Zeitzonen (inkl. Überseegebiete)?" },
  { category: "Allgemeinwissen", text: "Wie viele Tasten hat ein klassisches Klavier?" },
  { category: "Allgemeinwissen", text: "Wie heißt die Hauptstadt von Montenegro?" },
  { category: "Allgemeinwissen", text: "Welche Blutgruppe gilt als Universalspender?" },

  // Fülle bis 50 auf (oder lass weniger – zählt dann automatisch)
];

const SCORE_CORRECT = 4;
const SCORE_WRONG_OTHERS = 1;

const STORAGE_KEY = "quiz_scoreboard_state_v1";

const els = {
  categoryPill: document.getElementById("categoryPill"),
  qCount: document.getElementById("qCount"),
  qNumber: document.getElementById("qNumber"),
  qText: document.getElementById("qText"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  teams: document.getElementById("teams"),
  undoBtn: document.getElementById("undoBtn"),
  addTeamBtn: document.getElementById("addTeamBtn"),
  removeTeamBtn: document.getElementById("removeTeamBtn"),
  resetBtn: document.getElementById("resetBtn"),
};

const defaultState = () => ({
  // questionIndex: welche Frage (0-basiert)
  questionIndex: 0,

  // revealStage: 0 = nur "Frage X" (Überleitung), 1 = Text sichtbar
  revealStage: 0,

  teams: [
    { name: "Team 1", score: 0 },
    { name: "Team 2", score: 0 },
    { name: "Team 3", score: 0 },
    { name: "Team 4", score: 0 },
  ],

  // Undo-Stack: Actions
  history: [],
});

let state = loadState();

/* ---------- Storage ---------- */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);

    // Fallbacks
    if (!Array.isArray(parsed.teams) || parsed.teams.length === 0) return defaultState();
    parsed.history = Array.isArray(parsed.history) ? parsed.history : [];
    parsed.questionIndex = clampInt(parsed.questionIndex ?? 0, 0, Math.max(0, QUESTIONS.length - 1));
    parsed.revealStage = parsed.revealStage === 1 ? 1 : 0;
    return parsed;
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- Helpers ---------- */
function clampInt(n, min, max){
  n = Number.isFinite(+n) ? Math.trunc(+n) : min;
  return Math.max(min, Math.min(max, n));
}

function questionCount(){
  return Math.max(QUESTIONS.length, 1);
}

function getQuestion(i){
  if (QUESTIONS.length === 0) {
    return { category: "Keine Fragen", text: "Trage Fragen in app.js ein (QUESTIONS)." };
  }
  return QUESTIONS[i];
}

/* ---------- Rendering ---------- */
function renderQuestion(){
  const total = questionCount();
  const idx = clampInt(state.questionIndex, 0, total - 1);
  state.questionIndex = idx;

  const q = getQuestion(idx);
  const number = idx + 1;

  els.categoryPill.textContent = q.category || "Kategorie";
  els.qCount.textContent = `Frage ${number} / ${total}`;
  els.qNumber.textContent = `Frage ${number}`;

  // Übergang: erst nur Frage X, dann Text
  els.qText.textContent = (state.revealStage === 1) ? (q.text || "—") : "—";

  // Buttons deaktivieren wenn nötig
  els.prevBtn.disabled = (idx === 0 && state.revealStage === 0);
  els.nextBtn.disabled = (idx === total - 1 && state.revealStage === 1);

  els.prevBtn.style.opacity = els.prevBtn.disabled ? 0.5 : 1;
  els.nextBtn.style.opacity = els.nextBtn.disabled ? 0.5 : 1;
}

function renderTeams(){
  els.teams.innerHTML = "";

  state.teams.forEach((t, i) => {
    const card = document.createElement("div");
    card.className = "card teamCard";

    const top = document.createElement("div");
    top.className = "teamTop";

    const name = document.createElement("div");
    name.className = "teamName";
    name.textContent = t.name;

    // Name editierbar per Doppelklick
    name.title = "Doppelklick zum Umbenennen";
    name.ondblclick = () => renameTeam(i);

    const score = document.createElement("div");
    score.className = "score";
    score.textContent = t.score;

    top.appendChild(name);
    top.appendChild(score);

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

    card.appendChild(top);
    card.appendChild(actions);

    els.teams.appendChild(card);
  });

  els.removeTeamBtn.disabled = state.teams.length <= 1;
  els.removeTeamBtn.style.opacity = els.removeTeamBtn.disabled ? 0.5 : 1;
}

function renderAll(){
  renderQuestion();
  renderTeams();
  els.undoBtn.disabled = state.history.length === 0;
  els.undoBtn.style.opacity = els.undoBtn.disabled ? 0.5 : 1;
  saveState();
}

/* ---------- Question navigation (mit Übergang) ---------- */
function goNext(){
  const total = questionCount();
  const idx = state.questionIndex;

  if (state.revealStage === 0){
    // erst Text zeigen
    state.revealStage = 1;
  } else {
    // nächste Frage (und wieder Übergang)
    if (idx < total - 1){
      state.questionIndex++;
      state.revealStage = 0;
    }
  }
  renderAll();
}

function goPrev(){
  const total = questionCount();
  const idx = state.questionIndex;

  if (state.revealStage === 1){
    // Text wieder ausblenden => zurück zur Übergangsfolie
    state.revealStage = 0;
  } else {
    // vorherige Frage => Text erstmal ausblenden
    if (idx > 0){
      state.questionIndex--;
      state.revealStage = 0;
    }
  }
  renderAll();
}

/* ---------- Scoring ---------- */
function applyCorrect(teamIndex){
  // Aktion merken fürs Undo
  const deltas = state.teams.map((_, i) => (i === teamIndex ? SCORE_CORRECT : 0));
  applyScoreDeltas(deltas, { type: "score", label: `Richtig: ${state.teams[teamIndex].name}`, deltas });
}

function applyWrong(teamIndex){
  // alle anderen +1
  const deltas = state.teams.map((_, i) => (i === teamIndex ? 0 : SCORE_WRONG_OTHERS));
  applyScoreDeltas(deltas, { type: "score", label: `Falsch: ${state.teams[teamIndex].name}`, deltas });
}

function applyScoreDeltas(deltas, action){
  deltas.forEach((d, i) => {
    state.teams[i].score += d;
  });
  state.history.push(action);
  renderAll();
}

/* ---------- Undo ---------- */
function undo(){
  const last = state.history.pop();
  if (!last) return;

  if (last.type === "score"){
    // deltas rückgängig (negieren)
    last.deltas.forEach((d, i) => {
      state.teams[i].score -= d;
    });
  }

  if (last.type === "addTeam"){
    // Team entfernen
    state.teams.pop();
  }

  if (last.type === "removeTeam"){
    // Team wieder hinzufügen (inkl. Punkte)
    state.teams.push(last.removedTeam);
  }

  if (last.type === "renameTeam"){
    state.teams[last.index].name = last.oldName;
  }

  renderAll();
}

/* ---------- Teams add/remove/rename ---------- */
function addTeam(){
  const nextNum = state.teams.length + 1;
  const newTeam = { name: `Team ${nextNum}`, score: 0 };
  state.teams.push(newTeam);
  state.history.push({ type: "addTeam", label: `Team hinzugefügt: ${newTeam.name}` });
  renderAll();
}

function removeTeam(){
  if (state.teams.length <= 1) return;
  const removed = state.teams.pop();
  state.history.push({ type: "removeTeam", label: `Team entfernt: ${removed.name}`, removedTeam: removed });
  renderAll();
}

function renameTeam(i){
  const current = state.teams[i].name;
  const newName = prompt("Neuer Teamname:", current);
  if (!newName || !newName.trim()) return;

  state.history.push({ type: "renameTeam", label: `Team umbenannt`, index: i, oldName: current });
  state.teams[i].name = newName.trim();
  renderAll();
}

/* ---------- Reset ---------- */
function resetAll(){
  const ok = confirm("Wirklich alles zurücksetzen? (Punkte, Teams, Position)");
  if (!ok) return;
  state = defaultState();
  saveState();
  renderAll();
}

/* ---------- Events ---------- */
els.nextBtn.addEventListener("click", goNext);
els.prevBtn.addEventListener("click", goPrev);
els.undoBtn.addEventListener("click", undo);
els.addTeamBtn.addEventListener("click", addTeam);
els.removeTeamBtn.addEventListener("click", removeTeam);
els.resetBtn.addEventListener("click", resetAll);

// Tastatur: Pfeile links/rechts
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") goNext();
  if (e.key === "ArrowLeft") goPrev();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") undo();
});

renderAll();
