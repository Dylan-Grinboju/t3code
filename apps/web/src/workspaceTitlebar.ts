// A hover-revealed sidebar overlays the page, so the leftmost title bar clears its width.
export const COLLAPSED_SIDEBAR_TITLEBAR_INSET_CLASS =
  "[[data-sidebar-state=collapsed]_&]:pl-[var(--workspace-titlebar-content-left)] max-md:[[data-sidebar-state=expanded]_&]:pl-[var(--workspace-titlebar-content-left)] md:[[data-sidebar-hover-open]_&]:pl-[calc(var(--sidebar-width)-var(--sidebar-hover-gap-width)+var(--workspace-gutter-start))] motion-safe:transition-[padding-left] motion-safe:duration-150 motion-safe:ease-out";
