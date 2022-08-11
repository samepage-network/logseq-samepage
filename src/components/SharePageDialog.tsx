import { Notebook } from "@samepage/client/types";
import React, { useCallback, useState } from "react";
import ReactDOM from "react-dom";
import {
  Button,
  Classes,
  Dialog,
  Label,
  InputGroup,
  Intent,
} from "@blueprintjs/core";

type OnSubmitProps = {
  notebookPageId: string;
} & Notebook;

type Props = {
  onSubmit: (p: OnSubmitProps) => void;
  notebookPageId: string;
};

const SharePageDialog = ({
  onClose,
  onSubmit,
  notebookPageId,
}: {
  onClose: () => void;
} & Props) => {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [currentworkspace, setCurrentWorkspace] = useState("");
  const [loading, setLoading] = useState(false);
  const onClick = useCallback(() => {
    setLoading(true);
    Promise.all(
      Array.from(notebooks).map((n) => onSubmit({ ...n, notebookPageId }))
    )
      .then(onClose)
      .catch(() => setLoading(false));
  }, [onSubmit, onClose, notebooks]);
  return (
    <Dialog
      isOpen={true}
      title={`Share Page with Notebook`}
      onClose={onClose}
      canOutsideClickClose
      canEscapeKeyClose
      isCloseButtonShown={false}
      autoFocus={false}
    >
      <div
        className={Classes.DIALOG_BODY}
        //   onKeyDown={onKeyDown}
      >
        <p>
          Sharing this page means that all notebooks with access to it will be
          able to edit its child blocks.
        </p>
        {notebooks.map((g, i) => (
          <div className="flex gap-4 items-center">
            <span className={"flex-grow"}>
              {g.app} - {g.workspace}
            </span>
            <Button
              minimal
              icon={"trash"}
              onClick={() => setNotebooks(notebooks.filter((_, j) => j !== i))}
            />
          </div>
        ))}
        <Label>
          Notebook
          <InputGroup
            rightElement={
              <Button
                minimal
                icon={"plus"}
                onClick={() => {
                  setNotebooks([
                    ...notebooks,
                    { workspace: currentworkspace, app: 2 },
                  ]);
                  setCurrentWorkspace("");
                }}
              />
            }
            value={currentworkspace}
            onChange={(e) => setCurrentWorkspace(e.target.value)}
          />
        </Label>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button text={"Cancel"} onClick={onClose} disabled={loading} />
          <Button
            text={"Send"}
            intent={Intent.PRIMARY}
            onClick={onClick}
            disabled={loading || !notebooks.length}
          />
        </div>
      </div>
    </Dialog>
  );
};

export const render = (props: Props) => {
  const parent = document.createElement("div");
  parent.id = "samepage-share-page-dialog";
  document.body.appendChild(parent);

  const onClose = () => {
    ReactDOM.unmountComponentAtNode(parent);
    parent.remove();
    logseq.hideMainUI();
  };
  ReactDOM.render(
    React.createElement(SharePageDialog, {
      ...props,
      onClose,
    }),
    parent
  );
  logseq.showMainUI();
  return onClose;
};

export default SharePageDialog;
