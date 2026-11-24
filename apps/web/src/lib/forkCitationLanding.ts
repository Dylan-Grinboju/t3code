import type { AssistantCitationSourceAnchor } from "./assistantTextSelection";

export function animateCitationLanding(
  chip: HTMLElement | null,
  source: AssistantCitationSourceAnchor | undefined,
) {
  if (
    !chip ||
    !source?.source.isConnected ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const from = source.range.getBoundingClientRect();
  const to = chip.getBoundingClientRect();
  const viewport = source.viewport.getBoundingClientRect();
  if (
    !from.width ||
    !to.width ||
    from.bottom <= viewport.top ||
    from.top >= viewport.bottom ||
    to.bottom <= 0 ||
    to.top >= window.innerHeight
  )
    return;

  const flight = document.createElement("span");
  flight.ariaHidden = "true";
  flight.inert = true;
  flight.className =
    "pointer-events-none fixed z-50 max-w-48 select-none truncate rounded-sm bg-popover px-1 text-xs text-(--context-chip-citation) shadow-sm";
  flight.textContent = source.range.toString();
  flight.style.left = `${to.left}px`;
  flight.style.top = `${to.top}px`;
  document.body.append(flight);
  const dx = Math.max(viewport.left, from.left) - to.left;
  const dy = Math.max(viewport.top, from.top) - to.top;
  const motion = flight.animate(
    [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)", opacity: 0.2 }],
    { duration: 240, easing: "cubic-bezier(.22,.7,.28,1)" },
  );
  motion.onfinish = () => flight.remove();
  return () => {
    motion.cancel();
    flight.remove();
  };
}
