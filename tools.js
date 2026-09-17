// SafeSteps — interactive tool logic (Safety Plan, Digital Checkup, What Would You Do)
// Everything here stores data ONLY in localStorage on the visitor's own device.

document.addEventListener("DOMContentLoaded", () => {
  initSafetyPlan();
  initDigitalCheckup();
  initScenarioTool();
});

/* ============================= SAFETY PLAN ============================= */
function initSafetyPlan() {
  const form = document.getElementById("safety-plan-form");
  if (!form) return;

  const STORAGE_KEY = "safesteps_safety_plan";

  // Load saved data
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    Object.entries(saved).forEach(([name, value]) => {
      const field = form.elements[name];
      if (field) field.value = value;
    });
  } catch (e) {
    /* ignore malformed local storage */
  }

  const statusEl = document.getElementById("plan-save-status");

  form.addEventListener("submit", (e) => e.preventDefault());

  document.getElementById("save-plan-btn").addEventListener("click", () => {
    const data = {};
    Array.from(form.elements).forEach((el) => {
      if (el.name) data[el.name] = el.value;
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      if (statusEl) {
        statusEl.textContent = "Saved to this browser only — not sent anywhere.";
        statusEl.style.color = "var(--color-teal-dark)";
      }
    } catch (e) {
      if (statusEl) statusEl.textContent = "Could not save (private browsing mode may block this).";
    }
  });

  document.getElementById("print-plan-btn").addEventListener("click", () => window.print());

  document.getElementById("clear-plan-btn").addEventListener("click", () => {
    if (!confirm("Clear all saved safety plan data from this browser?")) return;
    localStorage.removeItem(STORAGE_KEY);
    form.reset();
    if (statusEl) {
      statusEl.textContent = "Cleared.";
      statusEl.style.color = "var(--color-ink-soft)";
    }
  });
}

/* ========================= DIGITAL SAFETY CHECKUP ======================= */
function initDigitalCheckup() {
  const list = document.getElementById("checkup-list");
  if (!list) return;

  const checkboxes = Array.from(list.querySelectorAll('input[type="checkbox"]'));
  const fill = document.getElementById("checkup-progress-fill");
  const label = document.getElementById("checkup-progress-label");
  const STORAGE_KEY = "safesteps_digital_checkup";

  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (e) {}

  checkboxes.forEach((cb) => {
    if (saved[cb.id]) cb.checked = true;
    updateItemStyle(cb);
    cb.addEventListener("change", () => {
      updateItemStyle(cb);
      persistAndScore();
    });
  });

  function updateItemStyle(cb) {
    const item = cb.closest(".checklist-item");
    if (item) item.classList.toggle("checked", cb.checked);
  }

  function persistAndScore() {
    const state = {};
    checkboxes.forEach((cb) => (state[cb.id] = cb.checked));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
    scoreChecklist();
  }

  function scoreChecklist() {
    const total = checkboxes.length;
    const done = checkboxes.filter((cb) => cb.checked).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    if (fill) fill.style.width = pct + "%";
    if (label) label.textContent = `${done} of ${total} complete (${pct}%)`;
  }

  scoreChecklist();
}

/* ============================ WHAT WOULD YOU DO ========================== */
const SCENARIOS = [
  {
    prompt: "You're walking home alone and notice someone has been walking at the same pace behind you for several blocks. What's the safest first move?",
    options: [
      { text: "Speed up and hope they turn off somewhere", type: "caution", feedback: "Speeding up can work, but it's more reliable to actively change your route and head somewhere public and lit — a store, a gas station, anywhere with people." },
      { text: "Cross the street or head toward a lit, public place (store, restaurant) and call/text someone your location", type: "good", feedback: "This is a strong response — changing direction toward people and light tests whether you're actually being followed, and looping in someone you trust means help is already on the way if needed." },
      { text: "Turn around and confront them directly", type: "caution", feedback: "Confrontation can escalate a situation before you know their intent. It's safer to first move toward safety (people, light, an open business) and assess from there." },
    ],
  },
  {
    prompt: "A stranger online has been messaging you persistently after you said you weren't interested, and now they've found your Instagram too. What should you do?",
    options: [
      { text: "Reply once more to firmly tell them to stop", type: "caution", feedback: "Engaging again — even to say stop — sometimes gives persistent people the reaction they're looking for. It's usually safer to go straight to blocking and documenting." },
      { text: "Screenshot the messages (with usernames/dates), block them on every platform, and report the account", type: "good", feedback: "Exactly right. Documentation matters if things escalate, and blocking + reporting removes their ability to keep contacting you without you having to engage." },
      { text: "Ignore it and hope it stops on its own", type: "caution", feedback: "Ignoring can sometimes work, but persistent unwanted contact across multiple platforms is a pattern worth documenting and blocking now rather than waiting to see if it escalates." },
    ],
  },
  {
    prompt: "You're at a party and someone hands you a drink you didn't watch being poured. What's the safest choice?",
    options: [
      { text: "Drink it — it's probably fine", type: "caution", feedback: "It's usually fine, but there's no way to know for sure. When you can't verify how a drink was made, it's safest not to risk it." },
      { text: "Politely decline or get a fresh, sealed/self-poured drink instead", type: "good", feedback: "This is the safest option. It's not about distrust of any one person — it's a habit that removes the risk entirely, every time." },
      { text: "Ask a friend to taste-test it first", type: "caution", feedback: "This doesn't reliably detect anything unsafe and puts your friend at risk too. Getting your own drink is a more reliable habit." },
    ],
  },
  {
    prompt: "You matched with someone on a dating app and want to meet in person for the first time. What's the safest way to set it up?",
    options: [
      { text: "Meet at their apartment so it's more private", type: "caution", feedback: "A private location for a first meeting removes your ability to leave easily and makes it harder for others to know where you are. Public first meetings are much safer." },
      { text: "Meet in a public place, tell a friend the details (who, where, when), and arrange your own transportation there and back", type: "good", feedback: "This covers the fundamentals: visibility, a plan someone else knows about, and control over how you get home. Great instinct." },
      { text: "Skip telling anyone — it's just a first date", type: "caution", feedback: "Even a short first meeting is safer when at least one person knows where you'll be and roughly when to expect a check-in." },
    ],
  },
  {
    prompt: "A friend tells you their partner has started controlling who they can see and monitoring their phone. What's the most supportive first response?",
    options: [
      { text: "Tell them to just break up with their partner immediately", type: "caution", feedback: "Leaving a controlling relationship can actually be the most dangerous moment, and pressuring someone to act fast can push them away from confiding in you again. Listening first matters more." },
      { text: "Listen without judgment, believe them, and gently share that support (like a hotline or SafeSteps' safety plan tool) is available whenever they're ready", type: "good", feedback: "This is the right instinct — feeling believed and unpressured makes it far more likely they'll keep talking to you and reach out for help on their own timeline." },
      { text: "Say nothing since it's not your relationship", type: "caution", feedback: "Staying silent can leave a friend feeling alone in exactly the situation where isolation is already part of the problem. Even just checking in gently helps." },
    ],
  },
];

function initScenarioTool() {
  const container = document.getElementById("scenario-container");
  if (!container) return;

  let index = 0;

  const promptEl = document.getElementById("scenario-prompt");
  const optionsEl = document.getElementById("scenario-options");
  const feedbackEl = document.getElementById("scenario-feedback");
  const progressEl = document.getElementById("scenario-progress");
  const nextBtn = document.getElementById("scenario-next-btn");
  const restartBtn = document.getElementById("scenario-restart-btn");

  function render() {
    const scenario = SCENARIOS[index];
    promptEl.textContent = scenario.prompt;
    optionsEl.innerHTML = "";
    feedbackEl.className = "scenario-feedback";
    feedbackEl.textContent = "";
    nextBtn.style.display = "none";
    progressEl.textContent = `Scenario ${index + 1} of ${SCENARIOS.length}`;

    scenario.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "scenario-option";
      btn.type = "button";
      btn.textContent = opt.text;
      btn.addEventListener("click", () => {
        Array.from(optionsEl.children).forEach((c) => (c.disabled = true));
        feedbackEl.textContent = opt.feedback;
        feedbackEl.classList.add("show", opt.type === "good" ? "good" : "caution");
        nextBtn.style.display = index < SCENARIOS.length - 1 ? "inline-flex" : "none";
        if (index === SCENARIOS.length - 1) restartBtn.style.display = "inline-flex";
      });
      optionsEl.appendChild(btn);
    });
  }

  nextBtn.addEventListener("click", () => {
    index = Math.min(index + 1, SCENARIOS.length - 1);
    restartBtn.style.display = "none";
    render();
  });

  restartBtn.addEventListener("click", () => {
    index = 0;
    restartBtn.style.display = "none";
    render();
  });

  render();
}
