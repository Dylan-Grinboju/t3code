import { Schema } from "effect";

import { useLocalStorage } from "../hooks/useLocalStorage";

const YOSI_FEATURES_KEY = "t3code:yosi-features";

// Every feature Yosi adds to this fork goes behind this one switch, and its settings row lists this array.
export const YOSI_FEATURES = [
  {
    title: "Threads grouping",
    description:
      "Right-click a thread and pick Move to group to file it in a named group, or New group to start one. Groups sit below your other active threads. Click a group to open or close it, and right-click it to rename, add or delete groups. Drag a thread into a group, or above the first group to take it out. A thread that starts working moves to the bottom of its group instead of the Working shelf. Deleting a group keeps its threads; they return to the list.",
  },
  {
    title: "Threads order",
    description:
      "Drag active threads to put them in any order, also with the Working shelf on. A thread you placed keeps its spot, also after it finishes working. Threads you never moved stay on top, newest first, as before.",
  },
] as const;

export function useYosiFeatures() {
  return useLocalStorage(YOSI_FEATURES_KEY, false, Schema.Boolean);
}
