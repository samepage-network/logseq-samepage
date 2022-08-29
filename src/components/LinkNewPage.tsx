import React, { useCallback, useState } from "react";
import type { OverlayProps } from "./renderOverlay";
import { Button, Classes, Dialog, InputGroup, Label } from "@blueprintjs/core";
import apiClient from "@samepage/client/internal/apiClient";
import addIdProperty from "../util/addIdProperty";

const LinkNewPage = ({ onClose, uuid }: OverlayProps<{ uuid: string }>) => {
  const [name, setName] = useState("");
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
        <p>Migrate linked page from {uuid} to:</p>
        <Label>
          Title
          <InputGroup
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={"Enter page name..."}
          />
        </Label>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={onClose} text={"Cancel"} />
          <Button
            onClick={() => {
              window.logseq.Editor.getPage(name)
                .then(
                  (page) =>
                    page ||
                    window.logseq.Editor.createPage(
                      name,
                      {},
                      { redirect: false }
                    )
                )
                .then((page) => {
                  if (!page) {
                    window.logseq.UI.showMsg(
                      `Unable to link page: ${name}`,
                      "error"
                    );
                    return;
                  }
                  apiClient({
                    oldNotebookPageId: uuid,
                    newNotebookPageId: page.uuid,
                    method: "link-different-page",
                  })
                    .then(() => addIdProperty(page))
                    .then(() => {
                      window.logseq.UI.showMsg(
                        `Successfully linked ${name} to shared page!`
                      );
                      onClose();
                    });
                });
            }}
            text={"Submit"}
            intent={"primary"}
          />
        </div>
      </div>
    </Dialog>
  );
};

export default LinkNewPage;
