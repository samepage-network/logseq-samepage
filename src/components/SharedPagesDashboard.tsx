import { Classes, Dialog } from "@blueprintjs/core";
import React, { useEffect, useState } from "react";
import type { OverlayProps } from "./renderOverlay";

type Props = { notebookPageIds: string[] };

const PageLink = ({ uuid }: { uuid: string }) => {
  const [title, setTitle] = useState("");
  useEffect(() => {
    logseq.Editor.getPage(uuid).then((p) => setTitle(p?.name || ""));
  }, [uuid]);
  return (
    <a
      className={"rm-page-ref"}
      data-link-title={title}
      onMouseDown={(e) => {
        if (e.shiftKey) {
          logseq.Editor.openInRightSidebar(uuid);
          e.preventDefault();
          e.stopPropagation();
        } else {
          window.location.hash = `#/page/${encodeURIComponent(title)}`;
        }
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {title}
    </a>
  );
};

const SharedPagesDashboard = ({
  onClose,
  notebookPageIds,
}: OverlayProps<Props>) => {
  return (
    <Dialog
      onClose={onClose}
      isOpen={true}
      title={"Shared Pages"}
      autoFocus={false}
      enforceFocus={false}
      portalContainer={window.parent.document.body}
    >
      <div className={Classes.DIALOG_BODY}>
        {notebookPageIds.length ? (
          <ul>
            {notebookPageIds.map((uuid) => (
              <li key={uuid}>
                <PageLink uuid={uuid} />
              </li>
            ))}
          </ul>
        ) : (
          <div>No pages shared yet.</div>
        )}
      </div>
    </Dialog>
  );
};

export default SharedPagesDashboard;
