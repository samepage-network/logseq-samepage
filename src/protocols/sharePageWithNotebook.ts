import loadSharePageWithNotebook from "@samepage/client/protocols/sharePageWithNotebook";
import SharePageDialog from "../components/SharePageDialog";
import renderOverlay from "../components/renderOverlay";
import SharedPagesDashboard from "../components/SharedPagesDashboard";
import { render as renderStatus } from "../components/SharedPageStatus";
import NotificationContainer from "../components/NotificationContainer";
import Automerge from "automerge";
import { Apps, AppId, Schema } from "@samepage/shared";
import { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";
import { openDB, IDBPDatabase } from "idb";
import { v4 } from "uuid";

type InputTextNode = {
  content: string;
  uuid: string;
  children: InputTextNode[];
  viewType: "bullet" | "numbered" | "document";
};

const logseqToSamepage = (s: string) =>
  openIdb()
    .then((db) => db.get("logseq-to-samepage", s))
    .then((v) => v as string);
const samepageToLogseq = (s: string) =>
  openIdb()
    .then((db) => db.get("samepage-to-logseq", s))
    .then((v) => v as string);
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
  nodes,
  level = 0,
  startIndex = 0,
  viewType = "bullet",
}: {
  nodes: BlockEntity[];
  level?: number;
  startIndex?: number;
  viewType?: InputTextNode["viewType"];
}) => {
  const annotations: Schema["annotations"] = [];
  let index = startIndex;
  const content: string = await Promise.all(
    nodes.map((n) =>
      logseqToSamepage(n.uid)
        .then(
          (identifier) =>
            identifier ||
            Promise.resolve(v4()).then((samepageUuid) =>
              saveIdMap(n.uid, samepageUuid).then(() => samepageUuid)
            )
        )
        .then(async (identifier) => {
          const end = n.content.length + index;
          annotations.push({
            start: index,
            end,
            attributes: {
              identifier,
              level: level,
              viewType: viewType,
            },
            type: "block",
          });
          const { content: childrenContent, annotations: childrenAnnotations } =
            await toAtJson({
              nodes: (n.children || []).filter(
                (b): b is BlockEntity => !Array.isArray(b)
              ),
              level: level + 1,
              viewType: n.viewType || viewType,
              startIndex: end,
            });
          const nodeContent = `${n.content}${childrenContent}`;
          annotations.push(...childrenAnnotations);
          index += nodeContent.length;
          return nodeContent;
        })
    )
  ).then((nodes) => nodes.join(""));
  return {
    content,
    annotations,
  };
};

const flattenTree = <T extends { children?: T[]; uuid?: string }>(
  tree: T[],
  parentUuid: string
): (Omit<T, "children"> & { order: number; parentUuid: string })[] =>
  tree.flatMap(({ children = [], ...t }, order) => [
    { ...t, order, parentUuid },
    ...flattenTree(children, t.uuid || ""),
  ]);

const calculateState = async (notebookPageId: string) => {
  const nodes = await window.logseq.Editor.getPage(Number(notebookPageId)).then(
    (page) => (page ? window.logseq.Editor.getPageBlocksTree(page.uuid) : [])
  );
  const parentUuid = await window.logseq.Editor.getBlock(Number(notebookPageId))
    .then((b) => window.logseq.Editor.getBlock(b?.parent.id || 0))
    .then((p) => p?.uuid || "");
  const title = await window.logseq.Editor.getPage(Number(notebookPageId)).then(
    (page) =>
      page?.name ||
      window.logseq.Editor.getBlock(Number(notebookPageId)).then(
        (block) => block?.uuid || ""
      )
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
export const notebookDbIds = new Set<number>();
const setupSharePageWithNotebook = (apps: Apps) => {
  const {
    unload,
    updatePage,
    disconnectPage,
    sharePage,
    joinPage,
    rejectPage,
    forcePushPage,
    listConnectedNotebooks,
  } = loadSharePageWithNotebook({
    renderInitPage: async (args) => {
      const notebookPageId = await logseq.Editor.getCurrentPage().then(
        (p) => p?.id.toString() || ""
      );
      renderOverlay({
        Overlay: SharePageDialog,
        props: { notebookPageId, ...args },
      });
    },
    renderViewPages: (props) =>
      renderOverlay({ Overlay: SharedPagesDashboard, props }),

    applyState: async (notebookPageId, state) => {
      const expectedTree: InputTextNode[] = [];
      const mapping: Record<string, InputTextNode> = {};
      const parents: Record<string, string> = {};
      let expectedPageViewType = "bullet";
      let currentBlock: InputTextNode;
      let initialPromise = Promise.resolve<unknown>("");
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
          const parentUid = parents[currentBlock.uuid];
          const viewType = anno.attributes["viewType"];
          if (parentUid === notebookPageId) {
            expectedPageViewType = viewType;
          } else mapping[parentUid].viewType = viewType;
        } else if (anno.type === "metadata") {
          const title = anno.attributes.title;
          const parentUid = anno.attributes.parent;
          initialPromise = (
            parentUid
              ? window.logseq.Editor.getBlock(Number(notebookPageId))
              : window.logseq.Editor.getPage(Number(notebookPageId))
          )
            .then((node) => {
              if (node) {
                const existingTitle =
                  node.name || (node as BlockEntity).content;
                if (existingTitle !== title) {
                  if (parentUid) {
                    return window.logseq.Editor.getBlock(
                      Number(notebookPageId)
                    ).then(
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
      const actualTreeMapping = await window.logseq.Editor.getPage(
        Number(notebookPageId)
      )
        .then((page) =>
          page
            ? window.logseq.Editor.getPageBlocksTree(page.originalName).then(
                (tree) => tree || []
              )
            : []
        )
        .then((tree = []) =>
          Object.fromEntries(
            //@ts-ignore guaranteed BlockEntity tree
            flattenTree(tree, notebookPageId).map(({ uuid, ...n }) => [uuid, n])
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
      return Promise.all(
        (
          [
            initialPromise,
            //viewTypePromise
          ] as Promise<unknown>[]
        )
          .concat(
            uuidsToDelete.map((uuid) =>
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
            uuidsToCreate.map(([samepageUuid]) => {
              const { parentUuid, order, ...node } =
                expectedTreeMapping[samepageUuid];
              return (
                parentUuid === notebookPageId
                  ? window.logseq.Editor.getPage(Number(notebookPageId)).then(
                      (page) =>
                        page &&
                        window.logseq.Editor.insertBlock(
                          page.uuid,
                          node.content
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
                  : window.logseq.Editor.insertBlock(
                      expectedSamepageToLogseq[samepageUuid],
                      node.content
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
                .then((uuid) => saveIdMap(uuid || "", samepageUuid))
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
            uuidsToUpdate.map(([samepageUuid, logseqUuid]) => {
              const { parentUuid, order, ...node } =
                expectedTreeMapping[samepageUuid];
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
          )
      );
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
            { createFirstBlock: false }
          )
            // .then((page) =>
            //   window.logseq.Editor.upsertBlockProperty(
            //     page?.uuid || "",
            //     "id",
            //     page?.uuid || ""
            //   ).then(() => page)
            // )
            .then((page) =>
              joinPage({
                pageUuid,
                notebookPageId: page?.id.toString() || "",
                source: { app: Number(app) as AppId, workspace },
              }).catch((e) => {
                window.logseq.Editor.deletePage(`samepage/page/${pageUuid}`);
                return Promise.reject(e);
              })
            ),
        reject: async ({ workspace, app }) =>
          rejectPage({ source: { app: Number(app) as AppId, workspace } }),
      },
    },
  });

  const renderStatusUnderHeading = async (
    isTargeted: (uid: string) => boolean,
    h: HTMLHeadingElement
  ) => {
    const title = h.textContent || "";
    const page = await window.logseq.Editor.getPage(title);
    if (!page) return;
    const { id: dbId } = page;
    if (!isTargeted(dbId.toString())) return;
    const attribute = `data-logseq-shared-${dbId}`;
    const containerParent = h.parentElement;
    if (containerParent && !containerParent.hasAttribute(attribute)) {
      if (notebookDbIds.has(dbId)) {
        containerParent.setAttribute(attribute, "true");
        renderStatus({
          parentUuid: dbId.toString(),
          sharePage,
          disconnectPage,
          forcePushPage,
          listConnectedNotebooks,
          apps,
        });
      }
    }
  };

  const callback = (h: HTMLHeadingElement) =>
    renderStatusUnderHeading(() => true, h);
  const getChildren = (d: Node) =>
    Array.from((d as HTMLElement).getElementsByClassName("title")).filter(
      (d) => d.nodeName === "H1"
    ) as HTMLHeadingElement[];
  getChildren(document).forEach(callback);
  const titleObserver = new MutationObserver((records) => {
    const isNode = (d: Node) =>
      d.nodeName === "H1" &&
      Array.from((d as HTMLElement).classList).includes("title");
    const getNodes = (nodes: NodeList) =>
      Array.from(nodes)
        .filter((d: Node) => isNode(d) || d.hasChildNodes())
        .flatMap((d) => (isNode(d) ? [d] : getChildren(d)));
    records
      .flatMap((m) =>
        getNodes(m.addedNodes).map((node) => node as HTMLHeadingElement)
      )
      .forEach(callback);
  });
  titleObserver.observe(window.parent.document.body, {
    childList: true,
    subtree: true,
  });
  const statusListener = ((e: CustomEvent) => {
    const id = e.detail as string;
    Array.from(
      document.querySelectorAll<HTMLHeadingElement>("h1.rm-title-display")
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
      if (notebookPage && notebookDbIds.has(notebookPage.id)) {
        window.clearTimeout(updateTimeout);
        updateTimeout = window.setTimeout(async () => {
          const notebookPageId = notebookPage.id.toString();
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
    window.parent.document.body.removeEventListener("keydown", bodyListener);
    document.body.removeEventListener(STATUS_EVENT_NAME, statusListener);
    titleObserver.disconnect();
    unload();
  };
};

export default setupSharePageWithNotebook;
