import type { SuggestionMessage } from "@t3tools/provider-core/server/forkPromptSuggestion";

export const cases: ReadonlyArray<{
  id: string;
  source: string;
  messages: ReadonlyArray<SuggestionMessage>;
  rubric: string;
  silence: boolean;
}> = [
  {
    id: "long-response",
    source: "Synthetic regression: recent user correction followed by many assistant updates",
    messages: [
      { role: "user", text: "Fix the export bug and commit it." },
      { role: "assistant", text: "I will fix the export." },
      { role: "user", text: "Actually don't commit. Just finish the fix and explain the changes." },
      ...Array.from({ length: 12 }, () => ({
        role: "assistant" as const,
        text: "I am reviewing the export change.",
      })),
      {
        role: "assistant",
        text: "The export bug is fixed. The CSV now escapes commas. Nothing has been committed.",
      },
    ],
    rubric: "No suggestion: retain the latest user restriction despite the long assistant reply.",
    silence: true,
  },
  {
    id: "remaining-tests",
    source: "Synthetic unfinished multi-step coding request",
    messages: [
      { role: "user", text: "Fix the empty search crash, then run the search tests." },
      {
        role: "assistant",
        text: "The empty search crash is fixed. I haven't run the search tests yet. Shall I run them?",
      },
    ],
    rubric: "A short request to run the search tests; no unrelated work.",
    silence: false,
  },
  {
    id: "research-only",
    source: "Synthetic explicit research-only boundary",
    messages: [
      {
        role: "user",
        text: "Research ways to add keyboard navigation. Don't implement anything yet.",
      },
      {
        role: "assistant",
        text: "I compared roving tabindex and aria-activedescendant. Both fit; the latter keeps focus in the input. Research is complete. I can implement it next.",
      },
    ],
    rubric: "No suggestion: implementation was explicitly excluded.",
    silence: true,
  },
  {
    id: "ambiguous-choice",
    source: "Synthetic decision requiring user preference",
    messages: [
      { role: "user", text: "Help me choose a database." },
      {
        role: "assistant",
        text: "SQLite is simpler locally; PostgreSQL supports concurrent remote writers. Will this run on one machine or serve multiple users?",
      },
    ],
    rubric: "No suggestion: do not invent a deployment requirement or pick an answer.",
    silence: true,
  },
  {
    id: "finished",
    source: "Synthetic completed request control",
    messages: [
      { role: "user", text: "Rename the button from Submit to Save." },
      { role: "assistant", text: "Renamed the button to Save. Verified the label in the app." },
    ],
    rubric: "No suggestion: no invented commit, deployment, or extra tests.",
    silence: true,
  },
  {
    id: "requested-commit",
    source: "Synthetic explicitly authorized remaining action",
    messages: [
      { role: "user", text: "Fix the bug, run tests, and commit it. Don't push." },
      {
        role: "assistant",
        text: "The fix is complete and all focused tests pass. The changes haven't been committed yet. Ready to commit?",
      },
    ],
    rubric: "Suggest committing the change, without pushing.",
    silence: false,
  },
  {
    id: "error",
    source: "Synthetic failed verification requiring judgment",
    messages: [
      { role: "user", text: "Check whether the new login works." },
      {
        role: "assistant",
        text: "The login failed with an unexpected authentication error. I can't tell whether the credentials or the configuration are wrong.",
      },
    ],
    rubric: "No suggestion: leave diagnosis and correction to the user.",
    silence: true,
  },
  {
    id: "hebrew",
    source: "Synthetic non-English continuation",
    messages: [
      { role: "user", text: "תתקן את הבאג ואז תריץ את הבדיקות" },
      { role: "assistant", text: "תיקנתי את הבאג. עדיין לא הרצתי את הבדיקות. להריץ אותן עכשיו?" },
    ],
    rubric: "A brief Hebrew request to run tests, retaining the user's language.",
    silence: false,
  },
  {
    id: "correction",
    source: "Synthetic later constraint superseding original task",
    messages: [
      { role: "user", text: "Add the new export flow and commit it." },
      { role: "assistant", text: "The export flow is implemented." },
      { role: "user", text: "Actually don't commit. Just show me what changed." },
      {
        role: "assistant",
        text: "Here is the diff: the Export button downloads a CSV. Nothing has been committed.",
      },
    ],
    rubric: "No suggestion: respect the correction and do not propose a commit.",
    silence: true,
  },
];
