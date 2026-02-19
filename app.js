/* =========================================================
   QUIZ SCOREBOARD (Public + Quizmaster + Fragen-Editor)
   + Firebase Realtime Buzzer (optional, wenn eingebunden)
   Sync: localStorage + storage-event
   ========================================================= */

const STORAGE_KEY = "quiz_scoreboard_state_v6";
const QUESTIONS_KEY = "quiz_questions_v1";

const SCORE_CORRECT = 4;       // richtig -> nur Team bekommt +4
const SCORE_WRONG_OTHERS = 1;  // falsch -> alle anderen +1

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
    { category: "Allgemeinwissen", text: "Beispielfrage: Welches Land hatte als erstes Frauenwahlrecht?", answer: "Neuseeland" },
    { category: "Disney", text: "Beispielfrage: Wie heißt Mickeys Hund?", answer: "Pluto" },
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
      { name: "Team 4", score: 0 },
    ],
    history: []
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
  parsed.questionIndex = clampInt(parsed.questionIndex ?? 0, 0, Math.max(0, QUESTIONS.length - 1));

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
  // shared question header
  categoryPill: document.getElementById("categoryPill"),
  qCount: document.getElementById("qCount"),
  qNumber: document.getElementById("qNumber"),

  // public question
  qText: document.getElementById("qText"),

  // teams
  teams: document.getElementById("teams"),

  // master question/answer
  qmQuestion: document.getElementById("qmQuestion"),
  qmAnswer: document.getElementById("qmAnswer"),
  publicStatePill: document.getElementById("publicStatePill"),
  publicHint: document.getElementById("publicHint"),

  // master controls
  prevQuestionBtn: document.getElementById("prevQuestionBtn"),
  nextQuestionBtn: document.getElementById("nextQuestionBtn"),
  toggleRevealBtn: document.getElementById("toggleRevealBtn"),

  // master toolbar
  undoBtn: document.getElementById("undoBtn"),
  resetScoresBtn: document.getElementById("resetScoresBtn"),
  addTeamBtn: document.getElementById("addTeamBtn"),
  removeTeamBtn: document.getElementById("removeTeamBtn"),
  resetAllBtn: document.getElementById("resetAllBtn"),
  openQuestionsBtn: document.getElementById("openQuestionsBtn"),
  openPublicBtn: document.getElementById("openPublicBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  resetBuzzerBtn: document.getElementById("resetBuzzerBtn"),

  // public buzzer banner
  buzzerBanner: document.getElementById("buzzerBanner"),

  // editor page
  inCategory: document.getElementById("inCategory"),
  inText: document.getElementById("inText"),
  inAnswer: document.getElementById("inAnswer"),
  list: document.getElementById("list"),
  qMeta: document.getElementById("qMeta"),
  statusHint: document.getElementById("statusHint"),
  addBtn: document.getElementById("addBtn"),
  saveBtn: document.getElementById("saveBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  backBtn: document.getElementById("backBtn"),
};

/* ---------------- Rendering ---------------- */
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

    if (mode === "master") {
      // inline editierbar
      name.contentEditable = "true";
      name.spellcheck = false;
      name.textContent = t.name;
      name.title = "Klicken & tippen (Enter = speichern, Esc = verwerfen)";

      name.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); name.blur(); }
        if (e.key === "Escape") { e.preventDefault(); name.textContent = state.teams[i].name; name.blur(); }
      });

      name.addEventListener("blur", () => {
        const newName = (name.textContent || "").trim();
        const oldName = state.teams[i].name;
        if (!newName) { name.textContent = oldName; return; }
        if (newName !== oldName) {
          state.history.push({ type: "renameTeam", index: i, oldName });
          state.teams[i].name = newName;
          renderAll();
        }
      });
    } else {
      name.textContent = t.name;
    }

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

  if (mode === "master" && el.undoBtn) {
    el.undoBtn.disabled = state.history.length === 0;
    el.undoBtn.style.opacity = el.undoBtn.disabled ? 0.5 : 1;
  }
}

function renderAll() {
  renderQuestion();
  renderTeams();
  saveState();
}

/* ---------------- Quizmaster controls ---------------- */
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
  const deltas = state.teams.map((_, i) => (i === teamIndex ? SCORE_CORRECT : 0));
  deltas.forEach((d, i) => state.teams[i].score += d);
  state.history.push({ type: "score", deltas });
  renderAll();
}
function applyWrong(teamIndex) {
  const deltas = state.teams.map((_, i) => (i === teamIndex ? 0 : SCORE_WRONG_OTHERS));
  deltas.forEach((d, i) => state.teams[i].score += d);
  state.history.push({ type: "score", deltas });
  renderAll();
}

/* ---------------- Undo / reset ---------------- */
function undo() {
  const last = state.history.pop();
  if (!last) return;

  if (last.type === "score") {
    last.deltas.forEach((d, i) => state.teams[i].score -= d);
  }
  if (last.type === "addTeam") {
    state.teams.pop();
  }
  if (last.type === "removeTeam") {
    state.teams.push(last.removedTeam);
  }
  if (last.type === "renameTeam") {
    state.teams[last.index].name = last.oldName;
  }
  if (last.type === "resetScores") {
    last.oldScores.forEach((s, i) => state.teams[i].score = s);
  }

  renderAll();
}

function resetScores() {
  const oldScores = state.teams.map(t => t.score);
  state.teams.forEach(t => t.score = 0);
  state.history.push({ type: "resetScores", oldScores });
  renderAll();
}

function resetAll() {
  const ok = confirm("Wirklich alles zurücksetzen? (Teams + Punkte + Frage)");
  if (!ok) return;
  state = defaultState();
  saveState();
  renderAll();
}

function addTeam() {
  const nextNum = state.teams.length + 1;
  state.teams.push({ name: `Team ${nextNum}`, score: 0 });
  state.history.push({ type: "addTeam" });
  renderAll();
}
function removeTeam() {
  if (state.teams.length <= 1) return;
  const removed = state.teams.pop();
  state.history.push({ type: "removeTeam", removedTeam: removed });
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

/* ---------------- Firebase Buzzer integration ---------------- */
// Public: zeigt nur Teamname (neutral)
if (mode === "public" && el.buzzerBanner && window.BuzzerRealtime) {
  window.BuzzerRealtime.ensureStateExists?.();

  window.BuzzerRealtime.listenBuzzer((s) => {
    if (s.phase === "locked" && s.winner) {
      el.buzzerBanner.style.display = "block";
      el.buzzerBanner.textContent = s.winner; // nur Name
    } else {
      el.buzzerBanner.style.display = "none";
      el.buzzerBanner.textContent = "";
    }
  });

  // Auto-open nach Countdown (falls nötig)
  setInterval(() => window.BuzzerRealtime.maybeAutoOpen?.(), 300);
}

// Master: „Buzzer frei“ startet Countdown & gibt danach frei (neutral)
if (mode === "master" && window.BuzzerRealtime) {

  const statusEl = document.getElementById("buzzerStatusMaster");

  function updateMasterStatus(s) {
    if (!statusEl) return;

    statusEl.classList.remove("open", "locked", "countdown");

    if (s.phase === "open") {
      statusEl.textContent = "🟢 Buzzer frei";
      statusEl.classList.add("open");
    }

    else if (s.phase === "locked") {
      statusEl.textContent = s.winner
        ? `🔴 Gesperrt – ${s.winner}`
        : "🔴 Gesperrt";
      statusEl.classList.add("locked");
    }

    else if (s.phase === "countdown") {
      const ms = (s.unlockAt || 0) - Date.now();
      const sec = Math.max(0, Math.ceil(ms / 1000));
      statusEl.textContent = `🟡 Countdown: ${sec}…`;
      statusEl.classList.add("countdown");
    }
  }

  // Live-Listener
  window.BuzzerRealtime.listenBuzzer((s) => {
    updateMasterStatus(s);
  });

  // Countdown aktualisieren
  setInterval(() => {
    window.BuzzerRealtime.maybeAutoOpen?.();
  }, 300);

  // Reset Button
  el.resetBuzzerBtn?.addEventListener("click", async () => {
    await window.BuzzerRealtime.startCountdownAndRelease();
  });
}


/* ---------------- Wire events (master only) ---------------- */
if (mode === "master") {
  el.nextQuestionBtn?.addEventListener("click", nextQuestion);
  el.prevQuestionBtn?.addEventListener("click", prevQuestion);
  el.toggleRevealBtn?.addEventListener("click", togglePublicReveal);

  el.undoBtn?.addEventListener("click", undo);
  el.resetScoresBtn?.addEventListener("click", resetScores);
  el.addTeamBtn?.addEventListener("click", addTeam);
  el.removeTeamBtn?.addEventListener("click", removeTeam);
  el.resetAllBtn?.addEventListener("click", resetAll);

  el.openQuestionsBtn?.addEventListener("click", () => window.location.href = "questions.html");
  el.openPublicBtn?.addEventListener("click", () => window.open("index.html", "_blank"));
  el.logoutBtn?.addEventListener("click", () => window.QuizAuth?.logout?.());
}

/* =========================================================
   Fragen-Editor (questions.html)
   ========================================================= */
if (mode === "editor") {
  function setStatus(msg) {
    if (el.statusHint) el.statusHint.textContent = msg || "";
  }

  function refreshEditorList() {
    const qs = loadQuestionsFromStorage() || [];
    QUESTIONS = qs;

    if (el.qMeta) el.qMeta.textContent = `${QUESTIONS.length} Fragen`;
    if (!el.list) return;

    el.list.innerHTML = "";

    QUESTIONS.forEach((q, idx) => {
      const row = document.createElement("div");
      row.className = "qRow";

      const top = document.createElement("div");
      top.className = "qRowTop";

      const left = document.createElement("div");
      left.style.flex = "1";

      const title = document.createElement("div");
      title.className = "qRowTitle";
      title.textContent = q.text || "(ohne Text)";

      const meta = document.createElement("div");
      meta.className = "qRowMeta";
      meta.textContent = `#${idx + 1} · ${q.category || "—"} · Antwort: ${q.answer || "—"}`;

      left.appendChild(title);
      left.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "qRowActions";

      const edit = document.createElement("button");
      edit.className = "smallBtn";
      edit.textContent = "Bearbeiten";
      edit.onclick = () => {
        el.inCategory && (el.inCategory.value = q.category || "");
        el.inText && (el.inText.value = q.text || "");
        el.inAnswer && (el.inAnswer.value = q.answer || "");

        if (el.addBtn) {
          el.addBtn.dataset.editIndex = String(idx);
          el.addBtn.textContent = "✓ Änderungen übernehmen";
        }
        setStatus(`Bearbeite Frage #${idx + 1}.`);
      };

      const del = document.createElement("button");
      del.className = "smallBtn danger";
      del.textContent = "Löschen";
      del.onclick = () => {
        const ok = confirm(`Frage #${idx + 1} wirklich löschen?`);
        if (!ok) return;
        QUESTIONS.splice(idx, 1);
        saveQuestionsToStorage(QUESTIONS);
        setStatus("Frage gelöscht ✅");
        refreshEditorList();
      };

      actions.appendChild(edit);
      actions.appendChild(del);

      top.appendChild(left);
      top.appendChild(actions);

      row.appendChild(top);
      el.list.appendChild(row);
    });
  }

  el.addBtn?.addEventListener("click", () => {
    const category = (el.inCategory?.value || "").trim();
    const text = (el.inText?.value || "").trim();
    const answer = (el.inAnswer?.value || "").trim();

    if (!text) {
      setStatus("Bitte mindestens den Fragetext ausfüllen.");
      return;
    }

    const editIndex = el.addBtn.dataset.editIndex;

    if (editIndex !== undefined && editIndex !== "") {
      const idx = Number(editIndex);
      if (Number.isFinite(idx) && QUESTIONS[idx]) {
        QUESTIONS[idx] = { category, text, answer };
        el.addBtn.dataset.editIndex = "";
        el.addBtn.textContent = "+ Frage hinzufügen";
        setStatus(`Frage #${idx + 1} aktualisiert ✅`);
      }
    } else {
      QUESTIONS.push({ category, text, answer });
      setStatus("Neue Frage hinzugefügt ✅");
    }

    saveQuestionsToStorage(QUESTIONS);

    if (el.inText) el.inText.value = "";
    if (el.inAnswer) el.inAnswer.value = "";

    refreshEditorList();
  });

  el.saveBtn?.addEventListener("click", () => {
    saveQuestionsToStorage(QUESTIONS);
    setStatus("Gespeichert ✅");
    refreshEditorList();
  });

  el.exportBtn?.addEventListener("click", () => {
    const data = JSON.stringify(loadQuestionsFromStorage() || [], null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "questions.json";
    a.click();
    setStatus("Export erstellt (questions.json).");
  });

  el.importBtn?.addEventListener("click", async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const parsed = safeJsonParse(text);
      if (!Array.isArray(parsed)) {
        setStatus("Import fehlgeschlagen: JSON ist kein Array.");
        return;
      }
      saveQuestionsToStorage(parsed);
      QUESTIONS = parsed;
      setStatus("Import erfolgreich ✅");
      refreshEditorList();
    };
    input.click();
  });

  el.backBtn?.addEventListener("click", () => {
    window.location.href = "quizmaster.html";
  });

  // Ensure questions exist
  if (!loadQuestionsFromStorage()?.length) {
    saveQuestionsToStorage(defaultQuestions());
  }

  refreshEditorList();
} else {
  /* ---------------- Initial render (public/master) ---------------- */
  renderAll();
}
