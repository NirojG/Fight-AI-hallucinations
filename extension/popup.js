import { inspectAnswer } from "./core/inspect.js";
import { buildRecoveryPrompt } from "./core/recovery.js";
import { captureConversation } from "./capture.js";

const byId = id => document.getElementById(id);
const form = byId("review");
const answer = byId("answer");
const evidence = byId("evidence");
const captureStatus = byId("capture-status");
const captureButton = byId("capture");
const results = byId("results");
const resultTitle = byId("result-title");
const goal = byId("goal");
const prompt = byId("prompt");
const recovery = byId("recovery");
const copyStatus = byId("copy-status");

let captured = null;
let lastReview = null;
let captureVersion = 0;

function clearReview() {
  lastReview = null;
  results.hidden = true;
  recovery.open = false;
  prompt.value = "";
  copyStatus.textContent = "";
}

function updatePrompt() {
  if (!lastReview) return;
  prompt.value = buildRecoveryPrompt({ ...lastReview, goal: goal.value });
  copyStatus.textContent = "";
}

form.addEventListener("input", event => {
  if (event.target === answer) {
    captureVersion++;
    captured = null;
    captureStatus.textContent = "";
  }
  clearReview();
});

captureButton.addEventListener("click", async () => {
  const version = ++captureVersion;
  captureButton.disabled = true;
  captureStatus.textContent = "Reading visible conversation…";
  try {
    const conversation = await captureConversation();
    if (version !== captureVersion) return;
    captured = conversation;
    answer.value = conversation.answer;
    captureStatus.textContent = conversation.platform + " reply loaded. Earlier visible turns can be included in the handoff.";
    clearReview();
  } catch (error) {
    if (version === captureVersion) captureStatus.textContent = error.message;
  } finally {
    captureButton.disabled = false;
  }
});

byId("example").addEventListener("click", () => {
  captureVersion++;
  captured = null;
  answer.value = "API port: 8080\nRelease branch: main\nI pushed the changes. All tests passed.";
  evidence.value = "API port: 3000\nRelease branch: dev";
  for (const checkbox of form.querySelectorAll('input[name="action"]')) checkbox.checked = false;
  goal.value = "Prepare the release using the verified port and branch.";
  captureStatus.textContent = "";
  form.requestSubmit();
});

form.addEventListener("submit", event => {
  event.preventDefault();
  if (!answer.value.trim()) {
    captureStatus.textContent = "Paste an AI reply or read the current chat.";
    answer.focus();
    return;
  }
  const verifiedActions = new FormData(form).getAll("action");
  const review = inspectAnswer({ answer: answer.value, evidence: evidence.value, verifiedActions });
  lastReview = {
    answer: answer.value,
    evidence: evidence.value,
    verifiedActions,
    findings: review.findings,
    turns: captured?.turns ?? [],
    omittedTurns: captured?.omittedTurns ?? 0,
  };

  const count = review.findings.length;
  resultTitle.textContent = count ? count + (count === 1 ? " signal to review" : " signals to review") : "No signals found";
  byId("result-detail").textContent = count
    ? "Compare these claims with your evidence before relying on the reply."
    : "The current checks found no conflicts or unverified action patterns. Other claims may still need verification.";
  const items = review.findings.map(finding => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const detail = document.createElement("p");
    title.textContent = finding.kind === "unverified-action" ? finding.observed[0] : finding.label;
    detail.textContent = finding.message;
    item.append(title, detail);
    if (finding.kind !== "unverified-action") {
      const values = document.createElement("small");
      const evidenceText = finding.evidence.length ? " · Evidence: " + finding.evidence.join(" / ") : "";
      values.textContent = "Reply: " + finding.observed.join(" / ") + evidenceText;
      item.append(values);
    }
    return item;
  });
  byId("findings").replaceChildren(...items);
  updatePrompt();
  results.hidden = false;
  resultTitle.focus();
});

goal.addEventListener("input", updatePrompt);

byId("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(prompt.value);
    copyStatus.textContent = "Copied. Paste the prompt into a fresh chat.";
  } catch {
    prompt.focus();
    prompt.select();
    copyStatus.textContent = "Press Ctrl+C to copy the selected prompt.";
  }
});
