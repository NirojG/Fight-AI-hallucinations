# Fight Hallucination

Fight Hallucination is a lightweight Chrome extension for reviewing AI replies and continuing work in a fresh chat. It identifies specific claims worth checking and prepares an editable handoff for ChatGPT, Claude, or Gemini.

## Try it in Chrome

1. Clone this repository or download its ZIP and extract it.
2. Open `chrome://extensions`, enable **Developer mode**, and click **Load unpacked**.
3. Select the repository's `extension` folder.
4. Open the **Fight Hallucination** popup and click **Try an example**. The sample produces four findings.
5. To check a real conversation, wait for the reply to finish and click **Read current chat**. You can also paste a reply directly.
6. Add any verified facts or action confirmations, then click **Check reply**. Open **Prepare a fresh-chat handoff**, review and edit the prompt, then copy it and choose a destination.

[Chrome’s unpacked extension instructions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)

## What it checks

| Signal | Example |
| --- | --- |
| Evidence mismatch | The reply says `API port: 8080` while your verified value is `API port: 3000`. |
| Conflicting values | The reply gives two different values for the same labeled field. |
| Unverified action | The reply says “I pushed” or “All tests passed” before you confirm the action. |
| Possible context loss | The reply changes the latest user-provided labeled value or omits a phrase set with `Always include: rollback plan`. Use `Always include: none` to clear it. |

Use one `Label: value` per line for the strongest comparisons. A result of **No signals found** means the current rules found nothing to flag. General factual verification and live background monitoring are outside this version’s coverage.

Chat capture reads the visible conversation text the provider has already loaded. Long or partially loaded threads can require additional context in the editable handoff. If a provider changes its page layout, paste the reply to continue. All detection and handoff generation run in the popup, in memory. Copying and pasting into a destination chat is a manual step.

## Development

The extension uses Manifest V3 and plain JavaScript. Chrome can load it directly from disk. Node.js 22 or newer runs the tests and sample.

```powershell
npm test
npm run check
node bin/review.js examples/release-review.json --recovery
```

The automated tests use synthetic conversations and provider layouts. Live capture needs a smoke test in each signed-in provider before release.
