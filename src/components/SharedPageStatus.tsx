import {
  Button,
  Classes,
  Dialog,
  InputGroup,
  Intent,
  Label,
  Popover,
  Spinner,
  Tooltip,
} from "@blueprintjs/core";
import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { removeSharedPage } from "../messages/sharePageWithGraph";

type Notebook = {
  workspace: string;
  app: number;
};

type Props = {
  parentUid: string;
};

const ConnectedNotebooks = ({ uid }: { uid: string }) => {
  const [loading, setLoading] = useState(true);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  useEffect(() => {
    apiClient<{ notebooks: Notebook[] }>({
      method: "list-page-notebooks",
      data: { uid },
    })
      .then((r) => setNotebooks(r.notebooks))
      .finally(() => setLoading(false));
  }, [setLoading]);
  return (
    <div className="flex p-4 rounded-md">
      {loading ? (
        <Spinner />
      ) : (
        <ul>
          {notebooks.map((c) => (
            <li key={`${c.app}-${c.workspace}`}>{c.workspace}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

const InviteNotebook = ({
  parentUid,
  loading,
  setLoading,
}: {
  loading: boolean;
  parentUid: string;
  setLoading: (f: boolean) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [innerLoading, setInnerLoading] = useState(false);
  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setLoading(false);
  }, [setIsOpen, setLoading]);
  const [workspace, setWorkspace] = useState("");
  const onSubmit = useCallback(() => {
    setInnerLoading(true);
    return apiClient<{ id: string; created: boolean }>({
      // TODO replace with just a get for the id
      method: "init-shared-page",
      data: {
        uid: parentUid,
      },
    })
      .then((r) => {
        const title = getPageTitleByPageUid(parentUid);
        sendToNotebook({
          graph: workspace,
          operation: "SHARE_PAGE",
          data: {
            id: r.id,
            uid: parentUid,
            title: title || getTextByBlockUid(parentUid),
            isPage: !!title,
          },
        });
        renderToast({
          id: "share-page-success",
          content: `Successfully shared page with ${workspace}! We will now await for them to accept.`,
        });
        closeDialog();
      })
      .finally(() => setInnerLoading(false));
  }, [parentUid, workspace, closeDialog, setInnerLoading]);
  return (
    <>
      <Tooltip content={"Invite Notebook"}>
        <Button
          icon={"plus"}
          minimal
          disabled={loading}
          onClick={() => {
            setIsOpen(true);
            setLoading(true);
          }}
        />
      </Tooltip>
      <Dialog
        isOpen={isOpen}
        title={"Invite Notebook"}
        onClose={closeDialog}
        canOutsideClickClose
        canEscapeKeyClose
        autoFocus={false}
        enforceFocus={false}
      >
        <div className={Classes.DIALOG_BODY}>
          <Label>
            Graph
            <InputGroup
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
            />
          </Label>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button
              text={"Cancel"}
              onClick={closeDialog}
              disabled={innerLoading}
            />
            <Button
              text={"Send"}
              intent={Intent.PRIMARY}
              onClick={onSubmit}
              disabled={innerLoading}
            />
          </div>
        </div>
      </Dialog>
    </>
  );
};

const SharedPageStatus = ({ parentUid }: Props) => {
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  return (
    <span
      className="samepage-shared-page-status flex gap-4 items-center text-lg mb-8"
      ref={containerRef}
    >
      <i>Shared</i>
      <Tooltip content={"Notebooks Connected"}>
        <Popover
          content={<ConnectedNotebooks uid={parentUid} />}
          target={<Button icon={"info-sign"} minimal disabled={loading} />}
        />
      </Tooltip>
      <InviteNotebook
        parentUid={parentUid}
        loading={loading}
        setLoading={setLoading}
      />
      <Tooltip content={"Disconnect Shared Page"}>
        <Button
          disabled={loading}
          icon={"th-disconnect"}
          minimal
          onClick={() => {
            setLoading(true);
            apiClient<{ id: string; created: boolean }>({
              method: "disconnect-shared-page",
              data: { uid: parentUid },
            })
              .then(() => {
                removeSharedPage(parentUid);
                containerRef.current.parentElement.remove();
              })
              .catch(() =>
                renderToast({
                  content: `Successfully disconnected ${parentUid} from being shared.`,
                  id: "disconnect-shared-page",
                })
              )
              .finally(() => setLoading(false));
          }}
        />
      </Tooltip>
    </span>
  );
};

const renderWithUnmount = (el: React.ReactElement, p: HTMLElement): void => {
  ReactDOM.render(el, p);
  const unmountObserver = new MutationObserver((ms) => {
    const parentRemoved = ms
      .flatMap((m) => Array.from(m.removedNodes))
      .some((n) => n === p || n.contains(p));
    if (parentRemoved) {
      unmountObserver.disconnect();
      ReactDOM.unmountComponentAtNode(p);
      document.body.dispatchEvent(
        new CustomEvent(
          `roamjs:${process.env.ROAMJS_EXTENSION_ID}:unregister`,
          {
            detail: {
              reactRoots: [p],
              observers: [unmountObserver],
            },
          }
        )
      );
    }
  });
  unmountObserver.observe(document.body, { childList: true, subtree: true });
  document.body.dispatchEvent(
    new CustomEvent(`roamjs:${process.env.ROAMJS_EXTENSION_ID}:register`, {
      detail: {
        reactRoots: [p],
        observers: [unmountObserver],
      },
    })
  );
};

export const render = (props: Props) => {
  Array.from(
    document.querySelectorAll(`[data-roamjs-shared-${props.parentUid}="true"]`)
  )
    .filter(
      (cp) =>
        cp.getElementsByClassName("samepage-shared-page-status").length === 0
    )
    .forEach((containerParent) => {
      const parent = document.createElement("div");
      const h = containerParent.querySelector("h1.rm-title-display");
      containerParent.insertBefore(
        parent,
        h?.parentElement?.nextElementSibling || null
      );
      renderWithUnmount(<SharedPageStatus {...props} />, parent);
    });
};

export default SharedPageStatus;
