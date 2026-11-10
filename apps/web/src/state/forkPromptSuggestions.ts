import { WS_METHODS } from "@t3tools/contracts";
import { createEnvironmentRpcCommand } from "@t3tools/client-runtime/state/runtime";
import { connectionAtomRuntime } from "../connection/runtime";

export const generatePromptSuggestion = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "fork:prompt-suggestion",
  tag: WS_METHODS.forkPromptSuggestion,
});
