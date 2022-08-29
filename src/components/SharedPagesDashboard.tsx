import { Button, Classes, Dialog } from "@blueprintjs/core";
import React, { useEffect, useState } from "react";
import getPageByPropertyId from "../util/getPageByPropertyId";
import LinkNewPage from "./LinkNewPage";
import type { OverlayProps } from "./renderOverlay";
import renderOverlay from "./renderOverlay";

type Props = { notebookPageIds: string[] };

const PageLink = ({ uuid, onClose }: OverlayProps<{ uuid: string }>) => {
  const [title, setTitle] = useState<string | undefined>("");
  useEffect(() => {
    getPageByPropertyId(uuid).then((p) =>
      p
        ? setTitle(p.originalName)
        : logseq.Editor.getBlock(uuid).then((block) =>
            block ? setTitle(block.content) : setTitle(undefined)
          )
    );
  }, [uuid]);
  return typeof title === "undefined" ? (
    <span
      className="flex"
      style={{ justifyContent: "space-between", alignItems: "center" }}
    >
      <i>Page {uuid} was deleted locally. Link another page?</i>{" "}
      <Button
        icon={"link"}
        minimal
        onClick={() => {
          renderOverlay({ Overlay: LinkNewPage, props: { uuid } });
          onClose();
        }}
      />
    </span>
  ) : (
    <a
      data-link-title={title}
      onMouseDown={(e) => {
        if (e.shiftKey) {
          logseq.Editor.openInRightSidebar(uuid);
        } else {
          window.location.hash = `#/page/${encodeURIComponent(title.toLowerCase())}`;
        }
        e.preventDefault();
        e.stopPropagation();
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
                <PageLink uuid={uuid} onClose={onClose} />
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
