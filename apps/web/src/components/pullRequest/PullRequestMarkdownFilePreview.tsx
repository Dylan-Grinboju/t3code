import type { FileDiffContentsLoader } from "@pierre/diffs";
import type { EnvironmentId } from "@t3tools/contracts";
import { maskMarkdownFrontmatter } from "@t3tools/shared/markdownFrontmatter";
import { BookOpenIcon } from "lucide-react";
import { useRef, useState } from "react";

import { isMarkdownPreviewFile } from "../files/filePreviewMode";
import { Button } from "../ui/button";
import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "../ui/dialog";
import { PullRequestMarkdown } from "./PullRequestMarkdown";

type FileDiff = Parameters<FileDiffContentsLoader>[0];

type PreviewState =
  | { readonly _tag: "loading" }
  | { readonly _tag: "ready"; readonly text: string }
  | { readonly _tag: "error" };

export const canPreviewPullRequestMarkdownFile = (fileDiff: FileDiff, path: string): boolean =>
  fileDiff.type !== "deleted" && isMarkdownPreviewFile(path);

export function PullRequestMarkdownFilePreviewButton({
  fileDiff,
  path,
  loadFile,
  cwd,
  environmentId,
}: {
  readonly fileDiff: FileDiff;
  readonly path: string;
  readonly loadFile: FileDiffContentsLoader;
  readonly cwd: string;
  readonly environmentId: EnvironmentId;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PreviewState>({ _tag: "loading" });
  const request = useRef(0);

  const load = () => {
    const id = ++request.current;
    setState({ _tag: "loading" });
    loadFile(fileDiff).then(
      (contents) => {
        if (id === request.current) setState({ _tag: "ready", text: contents.newFile.contents });
      },
      () => {
        if (id === request.current) setState({ _tag: "error" });
      },
    );
  };

  return (
    <>
      <Button
        size="xs"
        variant="ghost-muted"
        aria-label={`Preview ${path}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
          load();
        }}
      >
        <BookOpenIcon />
        <span className="@max-xs:hidden">Preview</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="me-8 break-all">{path}</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            {state._tag === "ready" ? (
              <PullRequestMarkdown
                text={maskMarkdownFrontmatter(state.text)}
                cwd={cwd}
                environmentId={environmentId}
              />
            ) : state._tag === "error" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>This file could not be loaded.</span>
                <Button size="xs" variant="outline" onClick={load}>
                  Retry
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}
