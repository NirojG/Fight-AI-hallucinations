export async function captureConversation() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https:\/\/(chatgpt\.com|claude\.ai|gemini\.google\.com)\//.test(tab.url)) {
    throw new Error("Open ChatGPT, Claude, or Gemini, or paste a reply below.");
  }

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: readConversation,
  });
  if (!injection?.result) throw new Error("The conversation was unavailable. Paste the reply to review it.");
  if (injection.result.error) throw new Error(injection.result.error);
  return injection.result;
}

// Chrome serializes this function before running it in the active tab.
export function readConversation() {
  const providers = {
    "https://chatgpt.com": {
      name: "ChatGPT",
      root: "main",
      user: '[data-message-author-role="user"]',
      assistant: '[data-message-author-role="assistant"]',
      text: ".markdown, .whitespace-pre-wrap",
      stop: '[data-testid="stop-button"]',
    },
    "https://claude.ai": {
      name: "Claude",
      root: "body",
      user: '[data-testid="user-message"], [data-testid="user_message"], .font-user-message',
      assistant: '[data-testid="assistant-message"], .font-claude-message',
      text: '[data-testid="user-message"], .font-user-message, .font-claude-message',
      stop: '[data-testid="stop-button"], button[aria-label="Stop Response"]',
    },
    "https://gemini.google.com": {
      name: "Gemini",
      root: "#chat-history, main, body",
      user: "user-query",
      assistant: "model-response",
      text: ".query-text, message-content",
      stop: 'button[aria-label="Stop response"], [data-test-id="stop-button"]',
    },
  };

  const provider = providers[location.origin];
  if (!provider) return { error: "The active tab changed. Open a supported chat and try again." };

  const root = document.querySelector(provider.root);
  if (!root) return { error: "Open a conversation with a finished reply." };
  if (root.querySelector(provider.stop)) {
    return { error: "Wait for the reply to finish, then try again." };
  }

  const selector = provider.user + ", " + provider.assistant;
  const messages = [...root.querySelectorAll(selector)].filter(element =>
    element.getClientRects().length && !element.parentElement?.closest(selector),
  );
  const roleOf = element => element.matches(provider.user) ? "user" : "assistant";
  const latest = messages.at(-1);
  if (!latest || roleOf(latest) !== "assistant") {
    return { error: "No finished assistant reply was found. Paste the reply to review it." };
  }

  function textOf(element) {
    const body = element.querySelector(provider.text) ?? element;
    return body.innerText.trim();
  }

  const answer = textOf(latest);
  if (!answer) return { error: "The latest reply has no readable text." };
  if (answer.length > 60000) return { error: "This reply exceeds 60,000 characters. Paste the portion you want to review." };

  const history = messages.slice(0, -1);
  const kept = history.slice(-79);
  const opening = history.find(element => roleOf(element) === "user");
  if (opening && !kept.includes(opening)) kept.unshift(opening);

  let omittedTurns = history.length - kept.length;
  const turns = [];
  for (const element of kept) {
    const text = textOf(element);
    if (!text) continue;
    if (text.length > 16000) omittedTurns++;
    turns.push({ role: roleOf(element), text: text.slice(0, 16000) });
  }
  return { platform: provider.name, answer, turns, omittedTurns };
}
