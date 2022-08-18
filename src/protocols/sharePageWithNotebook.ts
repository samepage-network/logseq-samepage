import loadSharePageWithNotebook from "@samepage/client/protocols/sharePageWithNotebook";
import SharePageDialog from "../components/SharePageDialog";
import renderOverlay from "../components/renderOverlay";
import { render as renderViewPages } from "../components/SharedPagesDashboard";
import Automerge from "automerge";
import { Apps } from "@samepage/shared";
import { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";
import { openDB, IDBPDatabase } from "idb";

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
const saveUid = (logseq: string, samepage: string) =>
  openIdb().then((db) =>
    Promise.all([
      db.put("logseq-to-samepage", samepage, logseq),
      db.put("samepage-to-logseq", logseq, samepage),
    ])
  );
const removeUid = (logseq: string, samepage: string) =>
  openIdb().then((db) =>
    Promise.all([
      db.delete("logseq-to-samepage", logseq),
      db.delete("samepage-to-logseq", samepage),
    ])
  );
const removeLogseqUid = (logseq: string) =>
  logseqToSamepage(logseq).then((samepage) => removeUid(logseq, samepage));
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

const flattenTree = <T extends { children?: T[]; uuid?: string }>(
  tree: T[],
  parentUuid: string
): (Omit<T, "children"> & { order: number; parentUuid: string })[] =>
  tree.flatMap(({ children = [], ...t }, order) => [
    { ...t, order, parentUuid },
    ...flattenTree(children, t.uuid || ""),
  ]);

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
        (p) => p?.uuid || ""
      );
      renderOverlay({
        Overlay: SharePageDialog,
        props: { notebookPageId, ...args },
      });
    },
    renderViewPages,

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
              ? window.logseq.Editor.getBlock(notebookPageId)
              : window.logseq.Editor.getPage(notebookPageId)
          ).then((node) => {
            if (node) {
              const existingTitle = node.name || (node as BlockEntity).content;
              if (existingTitle !== title) {
                if (parentUid) {
                  return window.logseq.Editor.updateBlock(
                    notebookPageId,
                    title
                  );
                } else {
                  return window.logseq.Editor.renamePage(existingTitle, title);
                }
              }
            } else {
              throw new Error(`Missing page with uuid: ${notebookPageId}`);
            }
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
        flattenTree(expectedTree, notebookPageId).map(({ uuid, ...n }) => [
          uuid,
          n,
        ])
      );
      const actualTreeMapping = await window.logseq.Editor.getPageBlocksTree(
        notebookPageId
      )
        .then((tree) =>
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
        Object.values(expectedSamepageToLogseq).filter((r) => !r)
      );
      const uuidsToDelete = Object.keys(actualTreeMapping).filter((k) =>
        expectedUuids.has(k)
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
            uuidsToDelete.map((uid) =>
              window.logseq.Editor.removeBlock(uid).then(() =>
                removeLogseqUid(uid)
              )
            )
          )
          .concat(
            uuidsToCreate.map(([samepageUuid]) => {
              const { parentUuid, order, ...node } =
                expectedTreeMapping[samepageUuid];
              return window.logseq.Editor.insertBlock(
                expectedSamepageToLogseq[parentUuid],
                node.content,
                { properties: { samepage: samepageUuid } }
              ).then((block) => saveUid(block?.uuid || "", samepageUuid));
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
                ).then(() => "");
              } else if (actual.content !== node.content) {
                return window.logseq.Editor.updateBlock(
                  logseqUuid,
                  node.content
                );
              } else {
                return Promise.resolve("");
              }
            })
          )
      );
    },
    calculateState: async (notebookPageId: string) => ({
      content: new Automerge.Text(notebookPageId),
      annotations: [],
    }),
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
  return () => {
    unload();
  };
};

export default setupSharePageWithNotebook;
