// realtime-buzzer.js
// Realtime Buzzer via Firebase Realtime Database (compat)

function initFirebase() {
  if (window._fbInitialized) return;
  if (!window.FIREBASE_CONFIG) {
    console.error("FIREBASE_CONFIG fehlt. Bitte firebase-config.js prüfen.");
    return;
  }
  firebase.initializeApp(window.FIREBASE_CONFIG);
  window._fbInitialized = true;
}

function roomPath() {
  const room = window.QUIZ_ROOM || "default";
  return `rooms/${room}/buzzer`;
}

function buzzerRef() {
  initFirebase();
  return firebase.database().ref(roomPath());
}

// DB State:
// phase: "open" | "locked" | "countdown"
// winner: string|null
// unlockAt: number|null (ms timestamp)
function normalizeState(v) {
  return v || { phase: "open", winner: null, unlockAt: null };
}

async function ensureStateExists() {
  initFirebase();
  const ref = buzzerRef();
  const snap = await ref.get();
  if (!snap.exists()) {
    await ref.set({ phase: "open", winner: null, unlockAt: null });
  }
}

async function tryBuzz(teamName) {
  initFirebase();
  const ref = buzzerRef();

  const result = await ref.transaction((curr) => {
    curr = normalizeState(curr);

    // Buzz nur wenn offen
    if (curr.phase !== "open") return;

    return {
      phase: "locked",
      winner: teamName,
      unlockAt: null
    };
  });

  return !!result.committed;
}

async function startCountdownAndRelease() {
  initFirebase();
  const ref = buzzerRef();
  const seconds = Number(window.BUZZER_COUNTDOWN_SECONDS || 3);
  const unlockAt = Date.now() + seconds * 1000;

  await ref.set({
    phase: "countdown",
    winner: null,
    unlockAt
  });
}

// Damit es ohne Cloud Function automatisch wieder "open" wird.
async function maybeAutoOpen() {
  initFirebase();
  const ref = buzzerRef();

  await ref.transaction((curr) => {
    curr = normalizeState(curr);
    if (curr.phase !== "countdown") return;
    if (!curr.unlockAt) return;
    if (Date.now() >= curr.unlockAt) {
      return { phase: "open", winner: null, unlockAt: null };
    }
    return;
  });
}

function listenBuzzer(onChange) {
  initFirebase();
  const ref = buzzerRef();
  ref.on("value", (snap) => onChange(normalizeState(snap.val())));
}

window.BuzzerRealtime = {
  ensureStateExists,
  tryBuzz,
  startCountdownAndRelease,
  maybeAutoOpen,
  listenBuzzer
};
