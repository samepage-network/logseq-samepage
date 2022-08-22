import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, Spinner } from "@blueprintjs/core";
import type { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";
import { v4 } from "uuid";

const NOTIFICATION_EVENT = "roamjs:samepage:notification";

type Notification = {
  uuid: string;
  title: string;
  description: string;
  actions: {
    label: string;
    method: string;
    args: Record<string, string>;
  }[];
};

const toFlexRegex = (key: string): RegExp =>
  new RegExp(`^\\s*${key.replace(/([()])/g, "\\$1")}\\s*$`, "i");

const getSettingValueFromTree = ({
  tree,
  key,
}: {
  tree: BlockEntity[];
  key: string;
}): string => {
  const node = tree.find((s) => toFlexRegex(key).test(s.content.trim()));
  const value = node?.children?.[0]
    ? (node?.children?.[0] as BlockEntity).content
    : "";
  return value;
};

const getSubTree = ({
  key,
  tree = [],
}: {
  key: string;
  tree?: BlockEntity[];
}): BlockEntity => {
  const node = tree.find((s) => toFlexRegex(key).test(s.content.trim()));
  if (node) return node;
  return {
    uuid: "",
    id: 0,
    left: { id: 0 },
    format: "markdown",
    page: { id: 0 },
    parent: { id: 0 },
    unordered: false,
    content: "",
    children: [],
  };
};

const ActionButtons = ({
  actions,
  onSuccess,
}: {
  actions: {
    label: string;
    callback: () => Promise<void>;
  }[];
  onSuccess: () => Promise<void>;
}) => {
  const [loading, setLoading] = useState(false);

  return (
    <>
      <div className={"flex gap-8"}>
        {actions.map((action) => (
          <Button
            key={action.label}
            text={action.label}
            onClick={() => {
              setLoading(true);
              action
                .callback()
                .then(onSuccess)
                .catch((e) => {
                  console.error("Failed to process notification:", e);
                  window.logseq.UI.showMsg(
                    `Failed to process notification: ${e.message || e}`,
                    "error"
                  );
                })
                .finally(() => setLoading(false));
            }}
            style={{ marginRight: "8px", textTransform: "capitalize" }}
            disabled={loading}
          />
        ))}
      </div>
      {loading && <Spinner size={12} />}
    </>
  );
};

type Props = {
  actions: Record<string, (args: Record<string, string>) => Promise<void>>;
};

const NotificationContainer = ({ actions }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, _setNotificatons] = useState<Notification[]>([]);
  const notificationsRef = useRef<Notification[]>(notifications);
  useEffect(() => {
    window.logseq.DB.datascriptQuery(
      `[:find (pull ?b [:block/name]) :where [?b :block/name ?title] [(clojure.string/starts-with? ?title  "samepage/notifications/")]]`
    )
      .then((pages: [{ name: string }][]) => {
        return Promise.all(
          pages.map((block) =>
            window.logseq.Editor.getPageBlocksTree(block[0].name).then(
              (tree) => ({
                tree,
                uuid: block[0].name.replace(/^samepage\/notifications/, ""),
              })
            )
          )
        );
      })
      .then((trees) =>
        trees.map(({ tree, uuid }) => {
          return {
            title: getSettingValueFromTree({
              tree,
              key: "Title",
            }),
            uuid,
            description: getSettingValueFromTree({
              tree,
              key: "Description",
            }),
            actions: (
              getSubTree({
                tree,
                key: "Actions",
              }).children || []
            ).map((act) => ({
              label: (act as BlockEntity).content,
              method: getSettingValueFromTree({
                tree: ((act as BlockEntity).children || []).map(
                  (b) => b as BlockEntity
                ),
                key: "Method",
              }),
              args: Object.fromEntries(
                (
                  getSubTree({
                    key: "Args",
                    tree: ((act as BlockEntity).children || []).map(
                      (b) => b as BlockEntity
                    ),
                  })?.children || []
                ).map((arg) => [
                  (arg as BlockEntity).content,
                  ((arg as BlockEntity).children || []).map(
                    (b) => b as BlockEntity
                  )[0]?.content,
                ])
              ),
            })),
          };
        })
      )
      .then((nots) => {
        notificationsRef.current = nots;
        _setNotificatons(nots);
      });
  }, []);
  const addNotificaton = useCallback(
    (not: Notification) => {
      window.logseq.Editor.createPage(
        `samepage/notifications/${not.uuid}`,
        {},
        { redirect: false, createFirstBlock: false }
      )
        .then(
          (newPage) =>
            newPage &&
            Promise.all([
              window.logseq.Editor.appendBlockInPage(
                newPage.uuid,
                "Title"
              ).then(
                (block) =>
                  block &&
                  window.logseq.Editor.appendBlockInPage(block.uuid, not.title)
              ),
              window.logseq.Editor.appendBlockInPage(
                newPage.uuid,
                "Description"
              ).then(
                (block) =>
                  block &&
                  window.logseq.Editor.appendBlockInPage(
                    block.uuid,
                    not.description
                  )
              ),
              window.logseq.Editor.appendBlockInPage(
                newPage.uuid,
                "Actions"
              ).then(
                (block) =>
                  block &&
                  Promise.all(
                    not.actions.map((a) =>
                      window.logseq.Editor.appendBlockInPage(
                        block.uuid,
                        a.label
                      ).then(
                        (block) =>
                          block &&
                          Promise.all([
                            window.logseq.Editor.appendBlockInPage(
                              block.uuid,
                              "Method"
                            ).then(
                              (block) =>
                                block &&
                                window.logseq.Editor.appendBlockInPage(
                                  block.uuid,
                                  a.method
                                )
                            ),
                            window.logseq.Editor.appendBlockInPage(
                              block.uuid,
                              "Args"
                            ).then(
                              (block) =>
                                block &&
                                Promise.all(
                                  Object.entries(a.args).map((arg) =>
                                    window.logseq.Editor.appendBlockInPage(
                                      block.uuid,
                                      arg[0]
                                    ).then(
                                      (block) =>
                                        block &&
                                        window.logseq.Editor.appendBlockInPage(
                                          block.uuid,
                                          arg[1]
                                        )
                                    )
                                  )
                                )
                            ),
                          ])
                      )
                    )
                  )
              ),
            ])
        )
        .then(() => {
          notificationsRef.current.push(not);
          _setNotificatons([...notificationsRef.current]);
        });
    },
    [_setNotificatons, notificationsRef]
  );
  const removeNotificaton = useCallback(
    (not: Notification) => {
      return window.logseq.Editor.deletePage(
        `samepage/notifications/${not.uuid}`
      ).then(() => {
        notificationsRef.current = notificationsRef.current.filter(
          (n) => n.uuid !== not.uuid
        );
        _setNotificatons(notificationsRef.current);
      });
    },
    [_setNotificatons, notificationsRef]
  );
  useEffect(() => {
    document.body.addEventListener(NOTIFICATION_EVENT, ((e: CustomEvent) => {
      addNotificaton(e.detail);
    }) as EventListener);
  }, [addNotificaton]);
  return notifications.length ? (
    <div
      style={{
        position: "absolute",
        bottom: 8,
        right: 8,
        zIndex: 1000,
        boxShadow: "0px 0px 8px #00000080",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 8,
          width: 8,
          background: "red",
          borderRadius: "50%",
        }}
      />
      {isOpen ? (
        <div style={{ background: "white", width: 280 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 8,
              background: "#eeeeee80",
              borderBottom: "1px solid black",
            }}
          >
            <h4>Notifications</h4>
            <Button onClick={() => setIsOpen(false)} icon={"cross"} minimal />
          </div>
          <div>
            {notifications.map((not) => (
              <div key={not.uuid} style={{ padding: "0 16px 4px" }}>
                <h5>{not.title}</h5>
                <p>{not.description}</p>
                <div style={{ gap: 8 }} className={"flex"}>
                  <ActionButtons
                    actions={not.actions.map((a) => ({
                      label: a.label,
                      callback: () => {
                        const action = actions[a.method];
                        if (action) return action(a.args);
                        return Promise.resolve();
                      },
                    }))}
                    onSuccess={() => removeNotificaton(not)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <img
          onClick={() => setIsOpen(true)}
          src={"https://samepage.network/images/logo.png"}
          style={{
            borderRadius: "50%",
            height: 24,
            width: 24,
            cursor: "pointer",
          }}
        />
      )}
    </div>
  ) : (
    <></>
  );
};

export const notify = (detail: Omit<Notification, "uuid">) =>
  document.body.dispatchEvent(
    new CustomEvent(NOTIFICATION_EVENT, {
      detail: { ...detail, uuid: v4() },
    })
  );

export default NotificationContainer;
