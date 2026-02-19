/* =========================================================
   QUIZ SCOREBOARD (Public + Quizmaster) + Firebase Buzzer
   Sync: localStorage + storage-event
   ========================================================= */

const STORAGE_KEY = "quiz_scoreboard_state_v5";
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

/* ---------------- Questions (from localStorage) ---------------- */
let QUESTIONS = [];

function defaultQuestions() {
  return [
    { category: "Allgemeinwissen", text: "Beispielfrage: Welches Land hatte als erstes Frauenwahlrecht?", answer: "Neuseeland" }
  ];
}

function loadQuestionsFromStorage() {
  const raw = localStorage.getItem(QUESTIONS_KEY);
  if (!raw) return null;
  const parsed = safeJsonParse(raw);
  return Array.isArray(parsed) ? parsed : null;
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

function questionCount() {
  return Math.max(QUESTIONS.length, 1);
}
function getQuestion(i) {
  if (!QUESTIONS.length) return { category: "Keine Fragen", text: "Bitte Fragen anlegen.", answer: "—" };
  return QUESTIONS[i];
}

/* ---------------- State ---------------- */
function defaultState() {
  return {
    questionIndex: 0,
    publicRevealStage: 0, // 0 = Übergang, 1 = Frage sichtbar
    teams: [
      { name: "Team 1", score: 0 },
      { name: "Team 2", score: 0 },
      { name: "Team 3", score: 0 },
      { name: "Team 4", score: 0 }
    ],
    history: [],
    confettiTick: 0
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();

  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== "object") return defaultState();

  parsed.teams = Array.isArray(parsed.teams) && parsed.teams.length ? parsed.teams : defaultState().teams;
  parsed.history = Array.isArray(parsed.history) ? parsed.history : [];
  parsed.publicRevealStage = parsed.publicRevealStage === 1 ? 1 : 0;
  parsed.confettiTick = Number.isFinite(+parsed.confettiTick) ? Math.trunc(+parsed.confettiTick) : 0;

  // clamp questionIndex after QUESTIONS loaded
  parsed.questionIndex = clampInt(parsed.questionIndex ?? 0, 0, Math.max(0, QUESTIONS.length - 1));

  // normalize teams
  parsed.teams = parsed.teams.map(t => ({
    name: typeof t?.name === "string" && t.name.trim() ? t.name.trim() : "Team",
    score: Number.isFinite(+t?.score) ? Math.trunc(+t.score) : 0
  }));

  return parsed;
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------------- DOM ---------------- */
const el = {
  categoryPill: document.getElementById("categoryPill"),
  qCount: document.getElementById("qCount"),
  qNumber: document.getElementById("qNumber"),

  // public:
  qText: document.getElementById("qText"),

  // teams:
  teams: document.getElementById("teams"),

  // master:
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

  openQuestionsBtn: document.getElementById("openQuestionsBtn"),
  openPublicBtn: document.getElementById("openPublicBtn"),
  logoutBtn: document.getElementById("logoutBtn"),

  resetBuzzerBtn: document.getElementById("resetBuzzerBtn"),

  // public buzzer banner:
  buzzerBanner: document.getElementById("buzzerBanner"),
};

/* ---------------- Render ---------------- */
function renderQuestion() {
  const total = questionCount();
  state.questionIndex = clampInt(state.questionIndex, 0, total - 1);

  const q = getQuestion(state.questionIndex);
  const number = state.questionIndex + 1;

  if (el.categoryPill) el.categoryPill.textContent = q.category || "Kategorie";
  if (el.qCount) el.qCount.textContent = `Frage ${number} / ${total}`;
  if (el.qNumber) el.qNumber.textContent = `Frage ${number}`;

  if (mode === "public" && el.qText) {
    el.qText.textContent = state.publicRevealStage === 1 ? (q.text || "—") : "—";
  }

  if (mode === "master") {
    if (el.qmQuestion) el.qmQuestion.textContent = q.text || "—";
    if (el.qmAnswer) el.qmAnswer.textContent = q.answer || "—";

    if (el.publicStatePill && el.publicHint) {
      if (state.publicRevealStage === 1) {
        el.publicStatePill.textContent = "Public: Frage sichtbar";
        el.publicHint.textContent = "Beamer zeigt aktuell die Frage.";
      } else {
        el.publicStatePill.textContent = "Public: Übergang";
        el.publicHint.textContent = "Beamer zeigt aktuell nur „Frage X“.";
      }
    }
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

/* ---------------- Master controls ---------------- */
function nextQuestion() {
  const total = questionCount();
  if (state.questionIndex >= total - 1) return;
  state.questionIndex++;
  state.publicRevealStage = 0;
  renderAll();
}

function prevQuestion() {
  if (state.questionIndex <= 0) return;
  state.questionIndex--;
  state.publicRevealStage = 0;
  renderAll();
}

function togglePublicReveal() {
  state.publicRevealStage = state.publicRevealStage === 1 ? 0 : 1;
  renderAll();
}

/* ---------------- Scoring ---------------- */
function applyCorrect(teamIndex) {
  state.teams[teamIndex].score += SCORE_CORRECT;
  state.confettiTick = (state.confettiTick || 0) + 1;
  renderAll();
}

function applyWrong(teamIndex) {
  state.teams.forEach((t, i) => {
    if (i !== teamIndex) t.score += SCORE_WRONG_OTHERS;
  });
  renderAll();
}

/* ---------------- Sync between windows/tabs ---------------- */
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY) {
    state = loadState();
    renderQuestion();
    renderTeams();
  }

  if (e.key === QUESTIONS_KEY) {
    const fresh = loadQuestionsFromStorage();
    if (fresh && fresh.length) {
      QUESTIONS = fresh;
      state.questionIndex = clampInt(state.questionIndex, 0, Math.max(0, QUESTIONS.length - 1));
      renderAll();
    }
  }
});

/* ---------------- Firebase Buzzer (Public display + Master reset) ---------------- */
if (mode === "public" && el.buzzerBanner && window.BuzzerRealtime) {
  window.BuzzerRealtime.ensureStateExists?.();
  window.BuzzerRealtime.listenBuzzer((s) => {
    // Public: neutral -> nur Name anzeigen
    if (s.phase === "locked" && s.winner) {
      el.buzzerBanner.style.display = "block";
      el.buzzerBanner.textContent = s.winner;
    } else {
      el.buzzerBanner.style.display = "none";
      el.buzzerBanner.textContent = "";
    }
  });

  // Auto-open nach Countdown (falls nötig)
  setInterval(() => window.BuzzerRealtime.maybeAutoOpen?.(), 300);
}

if (mode === "master" && window.BuzzerRealtime) {
  el.resetBuzzerBtn?.addEventListener("click", async () => {
    await window.BuzzerRealtime.startCountdownAndRelease();
  });
}

/* ---------------- Wire events (master only) ---------------- */
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
    if (state.teams.length <= 1) return;
    state.teams.pop();
    renderAll();
  });

  el.openQuestionsBtn?.addEventListener("click", () => {
    window.location.href = "questions.html";
  });

  el.openPublicBtn?.addEventListener("click", () => {
    window.open("index.html", "_blank");
  });

  el.logoutBtn?.addEventListener("click", () => {
    window.QuizAuth?.logout();
  });
}

/* ---------------- Initial render ---------------- */
renderAll();
