const fieldPattern = /^(?:[-*] )?([\p{L}][\p{L}\p{N} ._/-]{0,59}):[ \t]+(.{1,240})$/u;
const actionPatterns = [
  ["push", /\b(?:I (?:have )?pushed|(?:git )?push (?:succeeded|(?:is )?complete[d]?)|(?:changes|commits) (?:were |are )?pushed)\b/i],
  ["deploy", /\b(?:I (?:have )?deployed|deployment (?:succeeded|(?:is )?complete[d]?))\b/i],
  ["test", /\b(?:all tests passed|test suite passed|I (?:have )?ran (?:all )?(?:the )?tests successfully)\b/i],
];

function fieldsFrom(text) {
  const fields = new Map();
  let fence = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const marker = /^(\x60{3,}|~{3,})/.exec(line)?.[0];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length && line === marker) fence = null;
      continue;
    }
    if (fence) continue;

    const match = fieldPattern.exec(line);
    if (!match) continue;
    const [, label, rawValue] = match;
    const value = rawValue.trim().replace(/\s+/g, " ");
    if (!value) continue;
    const key = label.toLowerCase().trim().replace(/\s+/g, " ");
    if (!fields.has(key)) fields.set(key, { label, values: new Set() });
    fields.get(key).values.add(value);
  }
  return fields;
}

function findingsForFields(answer, evidence) {
  const findings = [];
  for (const [key, { label, values }] of fieldsFrom(answer)) {
    const verified = fieldsFromEvidence(evidence, key);
    if (verified.length > 1) {
      findings.push({
        kind: "conflicting-evidence", label, observed: [...values], evidence: verified,
        message: "The supplied evidence gives multiple values for this field.",
      });
    }
    if (values.size > 1) {
      findings.push({
        kind: "conflicting-answer", label, observed: [...values], evidence: verified,
        message: "The answer gives multiple values for this field.",
      });
    }
    if (verified.length !== 1) continue;
    const mismatches = [...values].filter(value => value !== verified[0]);
    if (mismatches.length) {
      findings.push({
        kind: "evidence-mismatch", label, observed: mismatches, evidence: verified,
        message: "The answer differs from the supplied value. Check whether the wording or value changed.",
      });
    }
  }
  return findings;
}

function fieldsFromEvidence(evidence, key) {
  return [...(evidence.get(key)?.values ?? [])];
}

function findingsForActions(answer, verifiedActions) {
  // Ignore quoted Markdown lines and fenced code examples.
  const prose = [];
  let fence = null;
  for (const line of answer.split(/\r?\n/)) {
    const trimmed = line.trim();
    const marker = /^(\x60{3,}|~{3,})/.exec(trimmed)?.[0];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length && trimmed === marker) fence = null;
    } else if (!fence && !trimmed.startsWith(">")) {
      prose.push(trimmed);
    }
  }
  return actionPatterns.flatMap(([action, pattern]) => {
    if (verifiedActions.includes(action)) return [];
    const match = pattern.exec(prose.join("\n"));
    if (!match) return [];
    return [{
      kind: "unverified-action", label: action, observed: [match[0]], evidence: [],
      message: "The answer reports a completed action. Confirm it against a tool result before relying on it.",
    }];
  });
}

/**
 * Compare the latest answer with trusted field/value lines and caller-confirmed actions.
 * A finding is a review signal. An empty result means the checks found no matching issue.
 */
export function inspectAnswer({ answer, evidence = "", verifiedActions = [] }) {
  if (typeof answer !== "string" || !answer.trim()) throw new TypeError("Enter an AI answer to check.");
  if (typeof evidence !== "string" || !Array.isArray(verifiedActions)) {
    throw new TypeError("Evidence must be text and verified actions must be an array.");
  }
  const findings = [
    ...findingsForFields(answer, fieldsFrom(evidence)),
    ...findingsForActions(answer, verifiedActions),
  ];
  return { status: findings.length ? "review" : "no-signals", findings };
}
