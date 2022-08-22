import type { Notebook, AppId, Apps } from "@samepage/shared";
import React, { useCallback, useMemo, useState } from "react";
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
  notebooks: Notebook[];
};

type Props = {
  onSubmit: (p: OnSubmitProps) => void;
  notebookPageId: string;
  apps: Apps;
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
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [currentApp, setCurrentApp] = useState<number>(2);
  const [currentworkspace, setCurrentWorkspace] = useState("");
  const [loading, setLoading] = useState(false);
  const onClick = useCallback(() => {
    setLoading(true);
    Promise.resolve(onSubmit({ notebooks, notebookPageId }))
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
      portalContainer={window.parent.document.body}
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
              items={Object.keys(apps).map((a) => Number(a))}
              activeItem={currentApp}
              onItemSelect={(e) => setCurrentApp(e)}
              itemRenderer={(item, { modifiers, handleClick }) => (
                <MenuItem
                  key={item}
                  text={apps[item].name}
                  active={modifiers.active}
                  onClick={handleClick}
                />
              )}
              filterable={false}
              popoverProps={{
                minimal: true,
                captureDismiss: true,
                portalContainer: window.parent.document.body,
              }}
            >
              <Button
                text={apps[currentApp].name}
                rightIcon="double-caret-vertical"
              />
            </AppSelect>
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
                  { workspace: currentworkspace, app: currentApp as AppId },
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

export default SharePageDialog;
