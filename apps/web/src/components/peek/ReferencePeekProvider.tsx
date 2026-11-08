import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowUpRightIcon } from "lucide-react";
import { lazy, Suspense, useState, type ReactNode } from "react";

import { useRightPanelStore } from "../../rightPanelStore";
import { Button } from "../ui/button";
import { Dialog, DialogHeader, DialogPopup, DialogTitle } from "../ui/dialog";
import { ReferencePeekContext, type ReferencePeekTarget } from "./referencePeek";

const ReferencePeekContent = lazy(() => import("./ReferencePeekContent"));

export function ReferencePeekProvider({ children }: { children: ReactNode }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const router = useRouter();
  const [peek, setPeek] = useState<{ pathname: string; target: ReferencePeekTarget } | null>(null);
  if (peek !== null && peek.pathname !== pathname) setPeek(null);
  const target = peek?.pathname === pathname ? peek.target : null;
  const open = (target: ReferencePeekTarget) => setPeek({ pathname, target });
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
    <ReferencePeekContext value={open}>
      {children}
      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setPeek(null);
        }}
      >
        <DialogPopup className="max-w-4xl" bottomStickOnMobile={false}>
          {target ? (
            <>
              <DialogHeader>
                <DialogTitle>Peek: {target.title}</DialogTitle>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Escape to return</span>
                  <Button size="sm" variant="outline" onClick={promote}>
                    <ArrowUpRightIcon />
                    {target.kind === "file" ? "Open in panel" : "Open thread"}
                  </Button>
                </div>
              </DialogHeader>
              <div className="flex h-[min(32rem,65dvh)] min-h-0 flex-col overflow-hidden">
                <Suspense
                  fallback={<p className="p-6 text-sm text-muted-foreground">Loading preview…</p>}
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
