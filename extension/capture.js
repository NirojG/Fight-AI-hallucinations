export async function captureChatGPT() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || new URL(tab.url).origin !== "https://chatgpt.com") {
    throw new Error("Open a ChatGPT conversation or paste an AI reply below.");
  }

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: readConversation,
  });
  if (!injection?.result) throw new Error("The conversation was unavailable. Paste the reply to review it.");
  if (injection.result.error) throw new Error(injection.result.error);
  return injection.result;
}

// Runs in the active tab. Keep dependencies inside this function.
function readConversation() {
  if (location.origin !== "https://chatgpt.com") {
    return { error: "The active tab changed. Open ChatGPT and try again." };
  }
  const thread = document.querySelector("main");
  if (!thread) return { error: "Open a ChatGPT conversation with a finished reply." };
  if (thread.querySelector('[data-testid="stop-button"]')) {
    return { error: "Wait for ChatGPT to finish the reply, then try again." };
  }

  const messages = [...thread.querySelectorAll('[data-message-author-role="user"], [data-message-author-role="assistant"]')]
    .filter(element => element.getClientRects().length);
  const latest = messages.at(-1);
  if (latest?.getAttribute("data-message-author-role") !== "assistant") {
    return { error: "No finished assistant reply was found. Paste the reply to review it." };
  }

  const textOf = element => {
    const body = element.querySelector(".markdown, .whitespace-pre-wrap") ?? element;
    return body.innerText.trim();
  };
  const answer = textOf(latest);
  if (!answer) return { error: "The latest reply has no readable text." };
  if (answer.length > 60000) return { error: "This reply exceeds 60,000 characters. Paste the portion you want to review." };

  const history = messages.slice(0, -1);
  const kept = history.slice(-79);
  const opening = history.find(element => element.getAttribute("data-message-author-role") === "user");
  if (opening && !kept.includes(opening)) kept.unshift(opening);

  let omittedTurns = history.length - kept.length;
  const turns = [];
  for (const element of kept) {
    const text = textOf(element);
    if (!text) continue;
    if (text.length > 16000) omittedTurns++;
    turns.push({ role: element.getAttribute("data-message-author-role"), text: text.slice(0, 16000) });
  }
  return { answer, turns, omittedTurns };
}
