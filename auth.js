// Simple client-side auth (GitHub Pages friendly)
// Hinweis: Kein echter Schutz gegen technisch versierte Nutzer.

const AUTH_KEY = "quizmaster_auth_v1";

// Zugangsdaten (wie gewünscht)
const USERNAME = "Master";
const PASSWORD = "QuizMaster";

function isAuthed() {
  return sessionStorage.getItem(AUTH_KEY) === "1";
}

function requireAuth() {
  if (!isAuthed()) {
    // zurück zum Login
    window.location.replace("login.html");
  }
}

function login(u, p) {
  if (u === USERNAME && p === PASSWORD) {
    sessionStorage.setItem(AUTH_KEY, "1");
    window.location.href = "quizmaster.html";
    return true;
  }
  return false;
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  window.location.href = "login.html";
}

/* ====== Login Page Wiring ====== */
(function initLoginPage() {
  const loginBtn = document.getElementById("loginBtn");
  const openPublicBtn = document.getElementById("openPublicBtn");
  const hint = document.getElementById("loginHint");

  // Wenn Elemente existieren, sind wir auf login.html
  if (!loginBtn) return;

  const userEl = document.getElementById("username");
  const passEl = document.getElementById("password");

  function setHint(msg) {
    if (hint) hint.textContent = msg || "";
  }

  loginBtn.addEventListener("click", () => {
    const u = (userEl?.value || "").trim();
    const p = (passEl?.value || "").trim();
    if (!login(u, p)) setHint("Login fehlgeschlagen. Benutzername/Passwort prüfen.");
  });

  // Enter in Passwortfeld = Login
  passEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loginBtn.click();
  });

  openPublicBtn?.addEventListener("click", () => {
    window.open("buzzer.html", "_blank");
  });

  // Wenn schon eingeloggt, direkt weiter
  if (isAuthed()) window.location.href = "quizmaster.html";
})();

// Export für andere Seiten (quizmaster.html)
window.QuizAuth = { requireAuth, logout, isAuthed };
