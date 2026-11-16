import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectAnswer } from "../extension/core/inspect.js";

const inspect = input => inspectAnswer(input).findings.map(finding => finding.kind);
const user = text => ({ role: "user", text });

test("flags conflicting trusted fields and values within the same reply", () => {
  assert.deepEqual(inspect({
    answer: "Port: 8080\nPort: 8000",
    evidence: "Port: 3000",
  }), ["conflicting-answer", "evidence-mismatch"]);
  assert.deepEqual(inspect({
    answer: "Port: 8080",
    evidence: "Port: 3000\nPort: 8000",
  }), ["conflicting-evidence"]);
});

test("flags reports of completed work that lack confirmation", () => {
  const answer = "I pushed the changes. Deployment succeeded. All tests passed.";
  assert.deepEqual(inspectAnswer({ answer }).findings.map(f => f.label), ["push", "deploy", "test"]);
  assert.deepEqual(inspect({ answer, verifiedActions: ["push", "deploy", "test"] }), []);
});

test("skips example reports and conditional language", () => {
  assert.deepEqual(inspect({
    answer: "If I pushed the changes, the workflow would start.\n> All tests passed.\n~~~text\nPort: 5000\nI deployed it.\n~~~",
    evidence: "Port: 3000",
  }), []);
});

test("uses the latest user value and flags an omitted phrase", () => {
  const turns = [
    user("Release branch: dev"),
    { role: "assistant", text: "Release branch: staging" },
    user("Release branch: main\nAlways include: rollback plan"),
  ];
  assert.deepEqual(inspect({ answer: "Release branch: dev", turns }), ["context-mismatch", "missing-context"]);
  assert.deepEqual(inspect({ answer: "Release branch: main\nRollback plan: revert the change", turns }), []);
});

test("lets supplied evidence override a prior user value and supports clearing a phrase", () => {
  const turns = [user("Port: 3000\nAlways include: rollback plan"), user("Always include: none")];
  assert.deepEqual(inspect({ answer: "Port: 4000", evidence: "Port: 4000", turns }), []);
});

test("reports no signals for unsupported patterns and rejects blank input", () => {
  assert.equal(inspectAnswer({ answer: "The prototype will probably work." }).status, "no-signals");
  assert.throws(() => inspectAnswer({ answer: " " }), /Enter an AI answer/);
});
