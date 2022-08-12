import { Notebook } from "@samepage/client/types";
import React, { useCallback, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import {
  Button,
  Classes,
  Dialog,
  Label,
  InputGroup,
  Intent,
  MenuItem,
} from "@blueprintjs/core";
import { Select } from "@blueprintjs/select";

type OnSubmitProps = {
  notebookPageId: string;
} & Notebook;

type Props = {
  onSubmit: (p: OnSubmitProps) => void;
  notebookPageId: string;
  apps: { id: number; name: string }[];
};

const AppSelect = Select.ofType<number>();

const SharePageDialog = ({
  onClose,
  onSubmit,
  notebookPageId,
  apps,
}: {
  onClose: () => void;
} & Props) => {
  const appNameById = useMemo(
    () => Object.fromEntries(apps.map((a) => [a.id, a.name])),
    []
  );
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [currentApp, setCurrentApp] = useState<number>(apps[0].id);
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
      <div className={Classes.DIALOG_BODY}>
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
        <div style={{ display: "flex", gap: "16px" }}>
          <Label style={{ maxWidth: "120px", width: "100%" }}>
            App
            <AppSelect
              items={apps.map((a) => a.id)}
              activeItem={currentApp}
              onItemSelect={(e) => setCurrentApp(e)}
              itemRenderer={(item, { modifiers, handleClick }) => (
                <MenuItem
                  key={item}
                  text={appNameById[item]}
                  active={modifiers.active}
                  onClick={handleClick}
                />
              )}
              filterable={false}
              popoverProps={{
                minimal: true,
                captureDismiss: true,
              }}
            >
              <Button
                text={appNameById[currentApp]}
                rightIcon="double-caret-vertical"
              />
            </AppSelect>
            {apps.map((app) => (
              <option value={app.id}>{app.name}</option>
            ))}
          </Label>
          <Label style={{ flexGrow: 1 }}>
            Workspace
            <InputGroup
              value={currentworkspace}
              onChange={(e) => setCurrentWorkspace(e.target.value)}
            />
          </Label>
          <Button
            minimal
            icon={"plus"}
            disabled={!currentApp || !currentworkspace}
            onClick={() => {
              if (currentApp && currentworkspace) {
                setNotebooks([
                  ...notebooks,
                  { workspace: currentworkspace, app: currentApp },
                ]);
                setCurrentWorkspace("");
              }
            }}
          />
        </div>
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
