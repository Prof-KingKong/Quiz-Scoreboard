/* =========================================================
   QUIZ SCOREBOARD (Public + Quizmaster + Firebase Buzzer)
   ========================================================= */

const STORAGE_KEY = "quiz_scoreboard_state_v4";
const QUESTIONS_KEY = "quiz_questions_v1";

const SCORE_CORRECT = 4;
const SCORE_WRONG_OTHERS = 1;

const mode = document.documentElement.dataset.mode || "public";

/* ---------------- Helpers ---------------- */

function clampInt(n, min, max) {
  n = Number.isFinite(+n) ? Math.trunc(+n) : min;
  return Math.max(min, Math.min(max, n));
}

function safeJsonParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

/* ---------------- Questions ---------------- */

let QUESTIONS = [];

function defaultQuestions() {
  return [
    { category: "Allgemeinwissen", text: "Welches Land hatte als erstes Frauenwahlrecht?", answer: "Neuseeland" },
    { category: "Allgemeinwissen", text: "Wie viele Tasten hat ein klassisches Klavier?", answer: "88" }
  ];
}

function loadQuestionsFromStorage() {
  const raw = localStorage.getItem(QUESTIONS_KEY);
  if (!raw) return null;
  const parsed = safeJsonParse(raw);
  if (!Array.isArray(parsed)) return null;
  return parsed;
}

function saveQuestionsToStorage(list) {
  localStorage.setItem(QUESTIONS_KEY, JSON.stringify(list));
}

(function initQuestions() {
  const stored = loadQuestionsFromStorage();
  if (stored && stored.length) {
    QUESTIONS = stored;
  } else {
    QUESTIONS = defaultQuestions();
    saveQuestionsToStorage(QUESTIONS);
  }
})();

/* ---------------- State ---------------- */

function defaultState() {
  return {
    questionIndex: 0,
    publicRevealStage: 0,
    teams: [
      { name: "Team 1", score: 0 },
      { name: "Team 2", score: 0 }
    ],
    history: [],
    confettiTick: 0
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();

  const parsed = safeJsonParse(raw);
  if (!parsed) return defaultState();

  parsed.teams = Array.isArray(parsed.teams) ? parsed.teams : defaultState().teams;
  parsed.history = Array.isArray(parsed.history) ? parsed.history : [];
  parsed.confettiTick = Number.isFinite(+parsed.confettiTick) ? parsed.confettiTick : 0;

  return parsed;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/* ---------------- DOM ---------------- */

const el = {
  categoryPill: document.getElementById("categoryPill"),
  qCount: document.getElementById("qCount"),
  qNumber: document.getElementById("qNumber"),
  qText: document.getElementById("qText"),
  teams: document.getElementById("teams"),
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
  resetBuzzerBtn: document.getElementById("resetBuzzerBtn"),
  openPublicBtn: document.getElementById("openPublicBtn"),
  logoutBtn: document.getElementById("logoutBtn")
};

/* ---------------- Rendering ---------------- */

function renderQuestion() {
  const q = QUESTIONS[state.questionIndex] || {};
  const number = state.questionIndex + 1;

  if (el.categoryPill) el.categoryPill.textContent = q.category || "Kategorie";
  if (el.qCount) el.qCount.textContent = `Frage ${number} / ${QUESTIONS.length}`;
  if (el.qNumber) el.qNumber.textContent = `Frage ${number}`;

  if (mode === "public" && el.qText) {
    el.qText.textContent = state.publicRevealStage ? (q.text || "—") : "—";
  }

  if (mode === "master") {
    if (el.qmQuestion) el.qmQuestion.textContent = q.text || "—";
    if (el.qmAnswer) el.qmAnswer.textContent = q.answer || "—";
  }
}

function renderTeams() {
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

    const score = document.createElement("div");
    score.className = "score";
    score.textContent = t.score;

    top.appendChild(name);
    top.appendChild(score);
    card.appendChild(top);

    if (mode === "master") {
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
}

function renderAll() {
  renderQuestion();
  renderTeams();
  saveState();
}

/* ---------------- Navigation ---------------- */

function nextQuestion() {
  if (state.questionIndex < QUESTIONS.length - 1) {
    state.questionIndex++;
    state.publicRevealStage = 0;
    renderAll();
  }
}

function prevQuestion() {
  if (state.questionIndex > 0) {
    state.questionIndex--;
    state.publicRevealStage = 0;
    renderAll();
  }
}

function togglePublicReveal() {
  state.publicRevealStage = state.publicRevealStage ? 0 : 1;
  renderAll();
}

/* ---------------- Scoring ---------------- */

function applyCorrect(i) {
  state.teams[i].score += SCORE_CORRECT;
  state.confettiTick++;
  renderAll();
}

function applyWrong(i) {
  state.teams.forEach((t, idx) => {
    if (idx !== i) t.score += SCORE_WRONG_OTHERS;
  });
  renderAll();
}

/* ---------------- Firebase Buzzer Integration ---------------- */

if (mode === "public" && window.BuzzerRealtime) {
  const banner = document.getElementById("buzzerBanner");

  window.BuzzerRealtime.ensureStateExists?.();

  window.BuzzerRealtime.listenBuzzer((s) => {
    if (!banner) return;

    if (s.phase === "locked" && s.winner) {
      banner.style.display = "block";
      banner.textContent = s.winner; // nur Name
    } else {
      banner.style.display = "none";
      banner.textContent = "";
    }
  });
}

if (mode === "master" && window.BuzzerRealtime) {
  el.resetBuzzerBtn?.addEventListener("click", async () => {
    await window.BuzzerRealtime.startCountdownAndRelease();
  });
}

/* ---------------- Master Events ---------------- */

if (mode === "master") {
  el.nextQuestionBtn?.addEventListener("click", nextQuestion);
  el.prevQuestionBtn?.addEventListener("click", prevQuestion);
  el.toggleRevealBtn?.addEventListener("click", togglePublicReveal);
  el.resetScoresBtn?.addEventListener("click", () => {
    state.teams.forEach(t => t.score = 0);
    renderAll();
  });
  el.addTeamBtn?.addEventListener("click", () => {
    state.teams.push({ name: `Team ${state.teams.length + 1}`, score: 0 });
    renderAll();
  });
  el.removeTeamBtn?.addEventListener("click", () => {
    if (state.teams.length > 1) {
      state.teams.pop();
      renderAll();
    }
  });
  el.openPublicBtn?.addEventListener("click", () => {
    window.open("index.html", "_blank");
  });
  el.logoutBtn?.addEventListener("click", () => {
    window.QuizAuth?.logout();
  });
}

/* ---------------- Initial Render ---------------- */

renderAll();
