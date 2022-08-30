import loadSharePageWithNotebook from "@samepage/client/protocols/sharePageWithNotebook";
import renderOverlay from "../components/renderOverlay";
import SharedPagesDashboard from "../components/SharedPagesDashboard";
import SharedPageStatus, {
  Props as SharedPageStatusProps,
} from "@samepage/client/components/SharedPageStatus";
import NotificationContainer from "@samepage/client/components/NotificationContainer";
import Automerge from "automerge";
import { Apps, AppId, Schema } from "@samepage/shared";
import { BlockEntity, BlockUUIDTuple } from "@logseq/libs/dist/LSPlugin.user";
import { openDB, IDBPDatabase } from "idb";
import { v4 } from "uuid";
import getPageByPropertyId from "../util/getPageByPropertyId";
import addIdProperty from "../util/addIdProperty";
import React from "react";
import { createRoot } from "react-dom/client";
import dateFormat from "date-fns/format";

type InputTextNode = {
  content: string;
  uuid: string;
  children: InputTextNode[];
  viewType: "bullet" | "numbered" | "document";
};
const unmountCallbacks = new Set<() => void>();

const renderStatus = (props: SharedPageStatusProps) => {
  const id = v4();
  window.logseq.provideUI({
    path: `div[data-logseq-shared-${props.notebookPageId}=true]`,
    key: `status-${props.notebookPageId}`,
    template: `<div id="${id}"></div>`,
  });
  return new Promise<() => void>((resolve) =>
    setTimeout(() => {
      const parent = window.parent.document.getElementById(id);
      if (parent) {
        const root = createRoot(parent);
        root.render(React.createElement(SharedPageStatus, props));
        const unmount = () => {
          unmountCallbacks.delete(unmount);
          root.unmount();
          const { parentElement } = parent;
          if (parentElement)
            parentElement.removeAttribute(
              `data-logseq-shared-${props.notebookPageId}`
            );
          parent.remove();
        };
        unmountCallbacks.add(unmount);
        resolve(unmount);
      }
    })
  );
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

const logseqToSamepage = (s: string) =>
  openIdb()
    .then((db) => db.get("logseq-to-samepage", s))
    .then((v) => (v as string) || "");
const samepageToLogseq = (s: string) =>
  openIdb()
    .then((db) => db.get("samepage-to-logseq", s))
    .then((v) => (v as string) || "");
const saveIdMap = (logseq: string, samepage: string) =>
  openIdb().then((db) =>
    Promise.all([
      db.put("logseq-to-samepage", samepage, logseq),
      db.put("samepage-to-logseq", logseq, samepage),
    ])
  );
const removeIdMap = (logseq: string, samepage: string) =>
  openIdb().then((db) =>
    Promise.all([
      db.delete("logseq-to-samepage", logseq),
      db.delete("samepage-to-logseq", samepage),
    ])
  );
const removeLogseqUuid = (logseq: string) =>
  logseqToSamepage(logseq).then((samepage) => removeIdMap(logseq, samepage));
let db: IDBPDatabase;
const openIdb = async () =>
  db ||
  (db = await openDB("samepage", 2, {
    upgrade(db) {
      db.createObjectStore("pages");
      db.createObjectStore("logseq-to-samepage");
      db.createObjectStore("samepage-to-logseq");
    },
  }));

const toAtJson = async ({
  nodes = [],
  level = 0,
  startIndex = 0,
  viewType = "bullet",
}: {
  nodes?: BlockEntity[];
  level?: number;
  startIndex?: number;
  viewType?: InputTextNode["viewType"];
}): Promise<Omit<Schema, "contentType">> => {
  return nodes
    .map(
      (n) => (index: number) =>
        logseqToSamepage(n.uuid)
          .then(
            (identifier) =>
              identifier ||
              Promise.resolve(v4()).then((samepageUuid) =>
                saveIdMap(n.uuid, samepageUuid).then(() => samepageUuid)
              )
          )
          .then(async (identifier) => {
            const content = n.content
              .replace(new RegExp(`\\nid:: ${n.uuid}`), "")
              .replace(new RegExp(`\\ntitle:: [^\\n]+`), "")
              .replace(
                new RegExp(
                  `\\nsamepage:: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`
                ),
                ""
              );
            const end = content.length + index;
            const annotations: Schema["annotations"] = [
              {
                start: index,
                end,
                attributes: {
                  identifier,
                  level: level,
                  viewType: viewType,
                },
                type: "block",
              },
            ];
            const {
              content: childrenContent,
              annotations: childrenAnnotations,
            } = await toAtJson({
              nodes: (n.children || []).filter(
                (b): b is BlockEntity => !Array.isArray(b)
              ),
              level: level + 1,
              viewType: n.viewType || viewType,
              startIndex: end,
            });
            return {
              content: new Automerge.Text(`${content}${childrenContent}`),
              annotations: annotations.concat(childrenAnnotations),
            };
          })
    )
    .reduce(
      (p, c) =>
        p.then(({ content: pc, annotations: pa }) =>
          c(startIndex + pc.length).then(
            ({ content: cc, annotations: ca }) => ({
              content: new Automerge.Text(`${pc}${cc}`),
              annotations: pa.concat(ca),
            })
          )
        ),
      Promise.resolve({
        content: new Automerge.Text(""),
        annotations: [] as Schema["annotations"],
      })
    );
};

const flattenTree = <
  T extends { children?: (T | BlockUUIDTuple)[]; uuid?: string }
>(
  tree: T[],
  parentUuid: string
): (Omit<T, "children"> & { order: number; parentUuid: string })[] =>
  tree.flatMap(({ children = [], ...t }, order) => [
    { ...t, order, parentUuid },
    ...flattenTree(
      children.filter((c): c is T => typeof c === "object"),
      t.uuid || ""
    ),
  ]);

// const PROPERTIES_REGEX = /^()+$/s
const isContentBlock = (b: BlockEntity) => {
  const props = (b.propertiesOrder as string[]) || [];
  return (
    !b.content ||
    !!props.reduce(
      (p, c) => p.replace(new RegExp(`${c}:: [^\\n]+\\n?`), ""),
      b.content
    )
  );
};

const createHTMLObserver = <T extends HTMLElement>({
  callback,
  tag,
  className,
}: {
  callback: (el: T) => void;
  tag: string;
  className: string;
}) => {
  const getChildren = (d: Node) =>
    Array.from((d as HTMLElement).getElementsByClassName(className)).filter(
      (d) => d.nodeName === tag
    ) as T[];
  const isNode = (d: Node): d is T =>
    d.nodeName === tag &&
    Array.from((d as HTMLElement).classList).includes(className);
  const getNodes = (nodes: NodeList) =>
    Array.from(nodes)
      .filter((d: Node) => isNode(d) || d.hasChildNodes())
      .flatMap((d) => (isNode(d) ? [d] : getChildren(d)));

  getChildren(window.parent.document.body).forEach(callback);
  const observer = new MutationObserver((records) => {
    records.flatMap((m) => getNodes(m.addedNodes)).forEach(callback);
  });
  observer.observe(window.parent.document.body, {
    childList: true,
    subtree: true,
  });
  return observer;
};

const calculateState = async (notebookPageId: string) => {
  const page = await getPageByPropertyId(notebookPageId);
  const nodes = (
    page ? await window.logseq.Editor.getPageBlocksTree(page.originalName) : []
  ).filter(isContentBlock);
  const parentUuid = await window.logseq.Editor.getBlock(notebookPageId).then(
    (b) =>
      window.logseq.Editor.getBlock(b?.parent.id || 0).then(
        (parent) =>
          parent?.uuid ||
          window.logseq.Editor.getPage(b?.parent.id || 0).then(
            (p) => p?.uuid || ""
          )
      )
  );

  const title: string = page
    ? page.originalName
    : await window.logseq.Editor.getBlock(notebookPageId).then(
        (block) => block?.content || ""
      );
  const startIndex = title.length;
  const doc = await toAtJson({
    nodes,
    viewType: "bullet",
    startIndex,
  });
  return {
    content: new Automerge.Text(`${title}${doc.content}`),
    annotations: (
      [
        {
          start: 0,
          end: startIndex,
          type: "metadata",
          attributes: {
            title,
            parent: parentUuid,
          },
        },
      ] as Schema["annotations"]
    ).concat(doc.annotations),
  };
};

export const STATUS_EVENT_NAME = "logseq:samepage:status";
export const notebookIds = new Set<string>();
const setupSharePageWithNotebook = (apps: Apps) => {
  const {
    unload,
    updatePage,
    disconnectPage,
    joinPage,
    rejectPage,
    forcePushPage,
    listConnectedNotebooks,
    getLocalHistory,
  } = loadSharePageWithNotebook({
    renderViewPages: (props) =>
      renderOverlay({ Overlay: SharedPagesDashboard, props }),

    getCurrentNotebookPageId: () =>
      logseq.Editor.getCurrentPage().then((p) =>
        p && !("page" in p) ? addIdProperty(p).then(() => p.uuid) : ""
      ),
    applyState: async (notebookPageId, state) => {
      const expectedTree: InputTextNode[] = [];
      const mapping: Record<string, InputTextNode> = {};
      const parents: Record<string, string> = {};
      let expectedPageViewType = "bullet";
      let currentBlock: InputTextNode;
      let initialPromise = () => Promise.resolve<unknown>("");
      const insertAtLevel = (
        nodes: InputTextNode[],
        level: number,
        parentUuid: string
      ) => {
        if (level === 0 || nodes.length === 0) {
          nodes.push(currentBlock);
          parents[currentBlock.uuid] = parentUuid;
        } else {
          const parentNode = nodes[nodes.length - 1];
          insertAtLevel(parentNode.children, level - 1, parentNode.uuid);
        }
      };
      state.annotations.forEach((anno) => {
        if (anno.type === "block") {
          currentBlock = {
            content: state.content.slice(anno.start, anno.end).join(""),
            children: [],
            uuid: anno.attributes["identifier"],
            viewType: "bullet",
          };
          mapping[currentBlock.uuid] = currentBlock;
          insertAtLevel(expectedTree, anno.attributes["level"], notebookPageId);
          const parentUuid = parents[currentBlock.uuid];
          const viewType = anno.attributes["viewType"];
          if (parentUuid === notebookPageId) {
            expectedPageViewType = viewType;
          } else mapping[parentUuid].viewType = viewType;
        } else if (anno.type === "metadata") {
          const { title, parent } = anno.attributes;
          initialPromise = () =>
            (parent
              ? window.logseq.Editor.getBlock(notebookPageId)
              : getPageByPropertyId(notebookPageId)
            )
              .then(async (node) => {
                if (node) {
                  const existingTitle =
                    node.originalName || (node as BlockEntity).content;
                  if (existingTitle !== title) {
                    if (parent) {
                      return window.logseq.Editor.getBlock(notebookPageId).then(
                        (block) =>
                          block &&
                          window.logseq.Editor.updateBlock(block.uuid, title)
                      );
                    } else {
                      return window.logseq.Editor.renamePage(
                        existingTitle,
                        title
                      );
                    }
                  }
                } else {
                  throw new Error(`Missing page with id: ${notebookPageId}`);
                }
              })
              .catch((e) => {
                return Promise.reject(
                  new Error(`Failed to initialize page metadata: ${e.message}`)
                );
              });
        }
      });
      // TODO viewType
      //
      // const actualPageViewType = (
      //   window.logseqAlphaAPI.pull("[:children/view-type]", [
      //     ":block/uid",
      //     notebookPageId,
      //   ])?.[":children/view-type"] || ":bullet"
      // ).slice(1);
      // const viewTypePromise =
      //   expectedPageViewType !== actualPageViewType
      //     ? () =>
      //         window.logseqAlphaAPI.updateBlock({
      //           block: {
      //             uid: notebookPageId,
      //             "children-view-type": expectedPageViewType,
      //           },
      //         })
      //     : Promise.resolve("");
      const expectedTreeMapping = Object.fromEntries(
        flattenTree(expectedTree, notebookPageId)
          .filter((n) => !!n.uuid)
          .map(({ uuid, ...n }) => [uuid, n])
      );
      const actualTreeMapping = await getPageByPropertyId(notebookPageId)
        .then((page) =>
          page
            ? window.logseq.Editor.getPageBlocksTree(page.originalName).then(
                (tree) => tree || []
              )
            : []
        )
        .then((tree = []) =>
          Object.fromEntries(
            flattenTree(tree.filter(isContentBlock), notebookPageId).map(
              ({ uuid, ...n }) => [uuid, n]
            )
          )
        )
        .then((a) => a as Record<string, BlockEntity>);
      const expectedSamepageToLogseq = await Promise.all(
        Object.keys(expectedTreeMapping).map((k) =>
          samepageToLogseq(k).then((r) => [k, r] as const)
        )
      )
        .then((keys) => Object.fromEntries(keys))
        .then((a) => a as Record<string, string>);

      const uuidsToCreate = Object.entries(expectedSamepageToLogseq).filter(
        ([, k]) => !k || !actualTreeMapping[k]
      );
      const expectedUuids = new Set(
        Object.values(expectedSamepageToLogseq).filter((r) => !!r)
      );
      const uuidsToDelete = Object.keys(actualTreeMapping).filter(
        (k) => !expectedUuids.has(k)
      );
      const uuidsToUpdate = Object.entries(expectedSamepageToLogseq).filter(
        ([, k]) => !!actualTreeMapping[k]
      );
      const promises = (
        [
          initialPromise,
          //viewTypePromise
        ] as (() => Promise<unknown>)[]
      )
        .concat(
          uuidsToDelete.map(
            (uuid) => () =>
              window.logseq.Editor.removeBlock(uuid)
                .then(() => removeLogseqUuid(uuid))
                .catch((e) => {
                  return Promise.reject(
                    new Error(`Failed to remove block ${uuid}: ${e.message}`)
                  );
                })
          )
        )
        .concat(
          uuidsToCreate.map(([samepageUuid]) => async () => {
            const { parentUuid, order, ...node } =
              expectedTreeMapping[samepageUuid];
            return (
              parentUuid === notebookPageId
                ? getPageByPropertyId(notebookPageId).then((p) =>
                    !p
                      ? Promise.reject(
                          new Error(`Failed to find page ${notebookPageId}`)
                        )
                      : window.logseq.Editor.getPageBlocksTree(
                          p.originalName
                        ).then((tree) =>
                          // minus 1 because of the persistent id hack -.-
                          (order < tree.length - 1
                            ? window.logseq.Editor.insertBlock(
                                tree[order + 1].uuid,
                                node.content,
                                { before: true }
                              )
                            : window.logseq.Editor.appendBlockInPage(
                                p?.originalName,
                                node.content
                              )
                          ).then(
                            (block) =>
                              block &&
                              window.logseq.Editor.upsertBlockProperty(
                                block.uuid,
                                "id",
                                block.uuid
                              ).then(() => block.uuid)
                          )
                        )
                  )
                : window.logseq.Editor.getBlock(
                    expectedSamepageToLogseq[parentUuid],
                    { includeChildren: true }
                  )
                    .then((block) =>
                      !block
                        ? Promise.reject(
                            new Error(
                              `Referencing parent ${parentUuid} but none exists`
                            )
                          )
                        : order < (block?.children?.length || 0)
                        ? window.logseq.Editor.insertBlock(
                            (block?.children?.[order] as BlockEntity).uuid,
                            node.content
                          )
                        : window.logseq.Editor.appendBlockInPage(
                            expectedSamepageToLogseq[parentUuid],
                            node.content
                          )
                    )
                    .then(
                      (block) =>
                        block &&
                        window.logseq.Editor.upsertBlockProperty(
                          block.uuid,
                          "id",
                          block.uuid
                        ).then(() => block.uuid)
                    )
            )
              .then((uuid) =>
                uuid
                  ? saveIdMap(uuid, samepageUuid).then(
                      () => (expectedSamepageToLogseq[samepageUuid] = uuid)
                    )
                  : Promise.reject(new Error(`null block uuid created`))
              )
              .catch((e) => {
                return Promise.reject(
                  new Error(
                    `Failed to insert block ${samepageUuid}: ${e.message}`
                  )
                );
              });
          })
        )
        .concat(
          uuidsToUpdate.map(([samepageUuid, logseqUuid]) => () => {
            const {
              parentUuid: samepageParentUuid,
              order,
              ...node
            } = expectedTreeMapping[samepageUuid];
            const parentUuid =
              samepageParentUuid === notebookPageId
                ? samepageParentUuid
                : expectedSamepageToLogseq[samepageParentUuid];
            const actual = actualTreeMapping[logseqUuid];
            // it's possible we may need to await from above and repull
            if (actual.parentUuid !== parentUuid || actual.order !== order) {
              return window.logseq.Editor.moveBlock(
                logseqUuid,
                parentUuid
                // use order to determine `before` or `children`
              ).catch((e) => {
                return Promise.reject(
                  new Error(
                    `Failed to move block ${samepageUuid}: ${e.message}`
                  )
                );
              });
            } else if (actual.content !== node.content) {
              return window.logseq.Editor.updateBlock(
                logseqUuid,
                node.content
              ).catch((e) => {
                return Promise.reject(
                  new Error(
                    `Failed to update block ${samepageUuid}: ${e.message}`
                  )
                );
              });
            } else {
              return Promise.resolve("");
            }
          })
        );
      return promises.reduce((p, c) => p.then(c), Promise.resolve<unknown>(""));
    },
    calculateState,
    loadState: async (notebookPageId) =>
      window.logseq.App.getCurrentGraph().then((graph) =>
        openIdb().then((db) =>
          db.get("pages", `${graph?.name || "null"}/${notebookPageId}`)
        )
      ),
    saveState: async (notebookPageId, state) =>
      window.logseq.App.getCurrentGraph().then((graph) =>
        openIdb().then((db) =>
          db.put("pages", state, `${graph?.name || "null"}/${notebookPageId}`)
        )
      ),
    removeState: async (notebookPageId) =>
      window.logseq.App.getCurrentGraph().then((graph) =>
        openIdb().then((db) =>
          db.delete("pages", `${graph?.name || "null"}/${notebookPageId}`)
        )
      ),
  });
  renderOverlay({
    Overlay: NotificationContainer,
    props: {
      actions: {
        accept: ({ app, workspace, pageUuid }) =>
          // TODO support block or page tree as a user action
          window.logseq.Editor.createPage(
            `samepage/page/${pageUuid}`,
            {},
            { redirect: false }
          ).then((page) =>
            addIdProperty(page)
              .then((notebookPageId) =>
                joinPage({
                  pageUuid,
                  notebookPageId,
                  source: { app: Number(app) as AppId, workspace },
                }).then(() => getPageByPropertyId(notebookPageId))
              )
              .then((title) => {
                const todayName = dateFormat(new Date(), "MMM do, yyyy");
                return window.logseq.Editor.appendBlockInPage(
                  todayName,
                  `Accepted page [[${title?.originalName}]] from ${
                    apps[Number(app)].name
                  } / ${workspace}`
                );
              })
              .then(() => Promise.resolve())
              .catch((e) => {
                window.logseq.Editor.deletePage(`samepage/page/${pageUuid}`);
                console.error(e);
                return Promise.reject(e);
              })
          ),
        reject: async ({ workspace, app, pageUuid }) =>
          rejectPage({
            source: { app: Number(app) as AppId, workspace },
            pageUuid,
          }),
      },
      api: {
        deleteNotification: (uuid) =>
          window.logseq.Editor.deletePage(`samepage/notifications/${uuid}`),
        addNotification: (not) =>
          window.logseq.Editor.createPage(
            `samepage/notifications/${not.uuid}`,
            {},
            { redirect: false, createFirstBlock: false }
          ).then(
            (newPage) =>
              newPage &&
              Promise.all([
                window.logseq.Editor.appendBlockInPage(
                  newPage.uuid,
                  "Title"
                ).then(
                  (block) =>
                    block &&
                    window.logseq.Editor.appendBlockInPage(
                      block.uuid,
                      not.title
                    )
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
                  "Buttons"
                ).then(
                  (block) =>
                    block &&
                    Promise.all(
                      not.buttons.map((a) =>
                        window.logseq.Editor.appendBlockInPage(block.uuid, a)
                      )
                    )
                ),
                window.logseq.Editor.appendBlockInPage(
                  newPage.uuid,
                  "Data"
                ).then(
                  (block) =>
                    block &&
                    Promise.all(
                      Object.entries(not.data).map((arg) =>
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
          ),
        getNotifications: () =>
          window.logseq.DB.datascriptQuery(
            `[:find (pull ?b [:block/name]) :where [?b :block/name ?title] [(clojure.string/starts-with? ?title  "samepage/notifications/")]]`
          )
            .then((pages: [{ name: string }][]) => {
              return Promise.all(
                pages.map((block) =>
                  window.logseq.Editor.getPageBlocksTree(block[0].name).then(
                    (tree) => ({
                      tree,
                      uuid: block[0].name.replace(
                        /^samepage\/notifications\//,
                        ""
                      ),
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
                  buttons: (
                    getSubTree({
                      tree,
                      key: "Buttons",
                    }).children || []
                  ).map((act) => (act as BlockEntity).content),
                  data: Object.fromEntries(
                    (
                      getSubTree({
                        tree,
                        key: "Data",
                      }).children || []
                    ).map((act) => [
                      (act as BlockEntity).content,
                      ((act as BlockEntity).children || []).map(
                        (b) => b as BlockEntity
                      )[0]?.content,
                    ])
                  ),
                };
              })
            ),
      },
    },
  });

  const renderStatusUnderHeading = async (
    isTargeted: (uid: string) => boolean,
    h: HTMLHeadingElement
  ) => {
    const title = h.textContent || "";
    const notebookPageId = await window.logseq.DB.datascriptQuery(
      `[:find ?id :where [?p :block/name "${title.toLowerCase()}"] [?b :block/page ?p] [?b :block/properties ?prop] [[get ?prop :samepage] ?id]]`
    ).then((b) => b[0]?.[0] as string);
    if (!notebookPageId) return;
    if (!isTargeted(notebookPageId)) return;
    const attribute = `data-logseq-shared-${notebookPageId}`;
    const containerParent = h.parentElement?.parentElement;
    if (containerParent && !containerParent.hasAttribute(attribute)) {
      if (notebookIds.has(notebookPageId)) {
        containerParent.setAttribute(attribute, "true");
        const unmount = await renderStatus({
          notebookPageId,
          disconnectPage: (id) =>
            disconnectPage(id).then(() => {
              notebookIds.delete(id);
              unmount();
            }),
          forcePushPage,
          listConnectedNotebooks,
          getLocalHistory,
          portalContainer: window.parent.document.body,
        });
      }
    }
  };

  const titleObserver = createHTMLObserver({
    tag: "H1",
    className: "title",
    callback: (h: HTMLHeadingElement) =>
      renderStatusUnderHeading(() => true, h),
  });
  const idObserver = createHTMLObserver({
    tag: "A",
    className: "page-property-key",
    callback: (a: HTMLAnchorElement) => {
      const dataRef = a.getAttribute("data-ref");
      if (dataRef === "samepage") {
        const blockContent = a.closest<HTMLDivElement>("div.block-content");
        if (!blockContent) return;
        const innerContent = blockContent.querySelector<HTMLDivElement>(
          ".block-content-inner"
        );
        if (!innerContent) return;
        if (innerContent.innerText) {
          const blockProperties =
            blockContent.querySelector<HTMLDivElement>(".block-properties");
          if (blockProperties) {
            blockProperties.style.display = "none";
          }
        } else {
          const block = blockContent.closest<HTMLDivElement>("div.ls-block");
          if (block) block.style.display = "none";
        }
      }
    },
  });

  const statusListener = ((e: CustomEvent) => {
    const id = e.detail as string;
    Array.from(
      window.parent.document.querySelectorAll<HTMLHeadingElement>("h1.title")
    ).forEach((header) => {
      renderStatusUnderHeading((u) => u === id, header);
    });
  }) as EventListener;
  document.body.addEventListener(STATUS_EVENT_NAME, statusListener);
  let updateTimeout = 0;
  const bodyListener = async (e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (el.tagName === "TEXTAREA" && el.classList.contains("normal-block")) {
      const blockUuid =
        el.id.match(
          /^edit-block-\d+-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/
        )?.[1] || "";
      const notebookPage = await window.logseq.Editor.getBlock(blockUuid).then(
        (block) => block && window.logseq.Editor.getPage(block.page.id)
      );
      const notebookPageId = await window.logseq.DB.datascriptQuery(
        `[:find ?id :where [?p :block/original-name "${notebookPage?.originalName}"] [?b :block/page ?p] [?b :block/properties ?prop] [[get ?prop :samepage] ?id]]`
      ).then((b) => b[0]?.[0] as string);
      if (notebookIds.has(notebookPageId)) {
        window.clearTimeout(updateTimeout);
        updateTimeout = window.setTimeout(async () => {
          const doc = await calculateState(notebookPageId);
          updatePage({
            notebookPageId,
            label: `keydown-${e.key}`,
            callback: (oldDoc) => {
              oldDoc.content = doc.content;
              if (!oldDoc.annotations) oldDoc.annotations = [];
              oldDoc.annotations.splice(0, oldDoc.annotations.length);
              doc.annotations.forEach((a) => oldDoc.annotations.push(a));
            },
          });
          // if (e.key === "Enter") {
          //   // createBlock
          // } else if (e.key === "Backspace") {
          //   // check for deleteBlock, other wise update block
          // } else if (e.key === "Tab") {
          //   // moveBlock
          // } else {
          //   // updateBlock
          // }
        }, 1000);
      }
    }
  };
  window.parent.document.body.addEventListener("keydown", bodyListener);

  return () => {
    window.clearTimeout(updateTimeout);
    Array.from(unmountCallbacks).forEach((c) => c());
    window.parent.document.body.removeEventListener("keydown", bodyListener);
    document.body.removeEventListener(STATUS_EVENT_NAME, statusListener);
    titleObserver.disconnect();
    idObserver.disconnect();
    unload();
  };
};

export default setupSharePageWithNotebook;
