import { T, useGT } from "gt-react";
import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowUpRightIcon } from "lucide-react";
import { lazy, Suspense, useRef, useState, type ReactNode } from "react";

import { usePanelTransitionDurationMs } from "../../panelAnimations";
import { useRightPanelStore } from "../../rightPanelStore";
import { Button } from "../ui/button";
import { Dialog, DialogHeader, DialogPopup, DialogTitle } from "../ui/dialog";
import {
  ReferencePeekContext,
  usePeekFilesByDefault,
  type ReferencePeekTarget,
} from "./referencePeek";

const ReferencePeekContent = lazy(() => import("./ReferencePeekContent"));

export function ReferencePeekProvider({ children }: { children: ReactNode }) {
  const gt = useGT();
  const [peekFilesByDefault] = usePeekFilesByDefault();
  const transitionDurationMs = usePanelTransitionDurationMs();
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const router = useRouter();
  const [peek, setPeek] = useState<{ pathname: string; target: ReferencePeekTarget } | null>(null);
  if (peek !== null && peek.pathname !== pathname) setPeek(null);
  const target = peek?.pathname === pathname ? peek.target : null;
  const originRef = useRef<HTMLElement | null>(null);
  const returnRef = useRef<HTMLElement | null>(null);
  const open = (target: ReferencePeekTarget, origin: HTMLElement) => {
    originRef.current = origin;
    returnRef.current = null;
    setPeek({ pathname, target });
  };
  const promote = () => {
    if (!target) return;
    setPeek(null);
    const destination = { to: "/$environmentId/$threadId" as const, params: target.threadRef };
    if (target.kind === "file") {
      useRightPanelStore.getState().openFile(target.threadRef, target.path, target.line);
    }
    if (target.kind === "thread" || router.buildLocation(destination).pathname !== pathname)
      void navigate(destination);
  };
  return (
    <ReferencePeekContext value={{ open, peekFilesByDefault }}>
      {children}
      <Dialog
        open={target !== null}
        onOpenChange={(open, details) => {
          if (open) return;
          if (details.reason === "escape-key") returnRef.current = originRef.current;
          setPeek(null);
        }}
        onOpenChangeComplete={(open) => {
          if (open) return;
          const origin = returnRef.current;
          originRef.current = null;
          returnRef.current = null;
          if (!origin?.isConnected) return;
          const outline = { outline: "2px solid currentColor", outlineOffset: "2px" };
          origin.animate(
            matchMedia("(prefers-reduced-motion: reduce)").matches
              ? [outline, outline]
              : [
                  outline,
                  { ...outline, offset: 0.45 },
                  { ...outline, outlineColor: "transparent" },
                ],
            700,
          );
        }}
      >
        <DialogPopup
          transitionDurationMs={transitionDurationMs}
          className="max-w-4xl"
          bottomStickOnMobile={false}
        >
          {target ? (
            <>
              <DialogHeader>
                <DialogTitle>{gt("Peek: {title}", { title: target.title })}</DialogTitle>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    <T>Escape to return</T>
                  </span>
                  <Button size="sm" variant="outline" onClick={promote}>
                    <ArrowUpRightIcon />
                    {target.kind === "file" ? gt("Open in panel") : gt("Open thread")}
                  </Button>
                </div>
              </DialogHeader>
              <div className="flex h-[min(32rem,65dvh)] min-h-0 flex-col overflow-hidden">
                <Suspense
                  fallback={
                    <p className="p-6 text-sm text-muted-foreground">
                      <T>Loading preview…</T>
                    </p>
                  }
                >
                  <ReferencePeekContent key={JSON.stringify(target)} target={target} />
                </Suspense>
              </div>
            </>
          ) : null}
        </DialogPopup>
      </Dialog>
    </ReferencePeekContext>
  );
}
