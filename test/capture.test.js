import { test } from "node:test";
import assert from "node:assert/strict";
import { readConversation } from "../extension/capture.js";

function fixture(t, origin, turns, { streaming = false } = {}) {
  const messages = turns.map(({ selector, text, parent, hidden }) => ({
    matches: selectors => selectors.split(", ").includes(selector),
    getClientRects: () => hidden ? [] : [{}],
    querySelector: () => null,
    innerText: text,
    parentElement: parent ? { closest: () => ({}) } : null,
  }));
  const root = {
    querySelector: () => streaming ? {} : null,
    querySelectorAll: selectors => messages.filter(message => message.matches(selectors)),
  };
  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  globalThis.location = { origin };
  globalThis.document = { querySelector: () => root };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  });
}

for (const [name, origin, user, assistant] of [
  ["ChatGPT", "https://chatgpt.com", '[data-message-author-role="user"]', '[data-message-author-role="assistant"]'],
  ["ChatGPT", "https://chatgpt.com", '[data-user-message-bubble="true"]', '[data-content-search-unit-key$=":assistant"]'],
  ["Claude", "https://claude.ai", '[data-testid="user_message"]', '[data-testid="assistant-message"]'],
  ["Gemini", "https://gemini.google.com", "user-query", "model-response"],
]) {
  test(name + " extracts a reply and earlier turns", t => {
    fixture(t, origin, [
      { selector: user, text: "  Check port 3000. " },
      { selector: assistant, text: "Port: 8000" },
      { selector: assistant, text: "Nested turn", parent: true },
      { selector: assistant, text: "Hidden turn", hidden: true },
    ]);
    assert.deepEqual(readConversation(), {
      platform: name,
      answer: "Port: 8000",
      turns: [{ role: "user", text: "Check port 3000." }],
      omittedTurns: 0,
    });
  });
}

test("skips a conversation while the reply is streaming", t => {
  fixture(t, "https://claude.ai", [], { streaming: true });
  assert.match(readConversation().error, /Wait for the reply/);
});

test("offers paste when the latest turn is a user message", t => {
  fixture(t, "https://gemini.google.com", [{ selector: "user-query", text: "New question" }]);
  assert.match(readConversation().error, /Paste the reply/);
});

test("rejects an unsupported origin", t => {
  fixture(t, "https://example.com", []);
  assert.match(readConversation().error, /Open a supported chat/);
});
