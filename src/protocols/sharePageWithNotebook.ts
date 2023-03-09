import type { InitialSchema } from "samepage/internal/types";
import loadSharePageWithNotebook from "samepage/protocols/sharePageWithNotebook";
import atJsonParser from "samepage/utils/atJsonParser";
import createHTMLObserver from "samepage/utils/createHTMLObserver";
import type {
  BlockEntity,
  BlockUUIDTuple,
} from "@logseq/libs/dist/LSPlugin.user";
import blockParser from "../utils/blockParser";
import { v4 } from "uuid";
import datefnsFormat from "date-fns/format";
import atJsonToLogseq from "../utils/atJsonToLogseq";
import { has as isShared } from "samepage/utils/localAutomergeDb";

const UUID_REGEX =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const isBlock = (notebookPageId: string) => UUID_REGEX.test(notebookPageId);

const toAtJson = ({ nodes = [] }: { nodes?: BlockEntity[] }): InitialSchema => {
  return flattenTree(nodes)
    .map((n) => (index: number) => {
      const { content: _content, annotations } = blockParser(n.content);
      const content = `${
        _content.length ? _content : String.fromCharCode(0)
      }\n`;
      const end = content.length + index;
      const blockAnnotations: InitialSchema["annotations"] = [
        {
          start: index,
          end,
          attributes: {
            level: n.level || 0,
            viewType: "bullet",
          },
          type: "block",
        },
      ];
      return {
        content,
        annotations: blockAnnotations.concat(
          annotations.map((a) => ({
            ...a,
            start: a.start + index,
            end: a.end + index,
          }))
        ),
      };
    })
    .reduce(
      (p, c) => {
        const { content: pc, annotations: pa } = p;
        const { content: cc, annotations: ca } = c(pc.length);
        return {
          content: `${pc}${cc}`,
          annotations: pa.concat(ca),
        };
      },
      {
        content: "",
        annotations: [] as InitialSchema["annotations"],
      }
    );
};

const flattenTree = <T extends { children?: (T | BlockUUIDTuple)[] }>(
  tree: T[]
): T[] =>
  tree.flatMap((t) => [
    t,
    ...flattenTree(
      (t.children || []).filter((c): c is T => typeof c === "object")
    ),
  ]);

const updateLevel = (t: BlockEntity, level: number) => {
  t.level = level;
  (t.children || []).forEach(
    (t) => !Array.isArray(t) && updateLevel(t, level + 1)
  );
};

const isContentBlock = (
  b: BlockEntity | null | BlockUUIDTuple
): b is BlockEntity => {
  return (
    !!b &&
    !Array.isArray(b) &&
    (!b.content || !!b.content.replace(/[a-z]+:: [^\n]+\n?/g, ""))
  );
};

const calculateState = async (notebookPageId: string) => {
  const nodes = (
    await (isBlock(notebookPageId)
      ? window.logseq.Editor.getBlock(notebookPageId, {
          includeChildren: true,
        }).then((b) => (b && b.children) || [])
      : window.logseq.Editor.getPageBlocksTree(notebookPageId).then(
          (tree) => tree || []
        ))
  ).filter(isContentBlock);
  return {
    ...toAtJson({
      nodes,
    }),
    nodes,
  };
};

type SamepageNode = {
  content: string;
  level: number;
  annotation: {
    start: number;
    end: number;
    annotations: InitialSchema["annotations"];
  };
};

const applyState = async (notebookPageId: string, state: InitialSchema) => {
  const rootPageUuid = UUID_REGEX.test(notebookPageId)
    ? notebookPageId
    : await window.logseq.Editor.getPage(notebookPageId).then(
        (p) => p?.uuid || ""
      );
  const expectedTree: SamepageNode[] = [];
  state.annotations.forEach((anno) => {
    if (anno.type === "block") {
      const currentBlock = {
        content: state.content.slice(anno.start, anno.end).replace(/\n$/, ""),
        level: anno.attributes.level,
        annotation: {
          start: anno.start,
          end: anno.end,
          annotations: [],
        },
      };
      expectedTree.push(currentBlock);
    } else {
      const block = expectedTree.find(
        (ca) =>
          ca.annotation.start <= anno.start && anno.end <= ca.annotation.end
      );
      if (block) {
        block.annotation.annotations.push(anno);
      }
    }
  });
  expectedTree.forEach((block) => {
    const offset = block.annotation.start;
    const normalizedAnnotations = block.annotation.annotations.map((a) => ({
      ...a,
      start: a.start - offset,
      end: a.end - offset,
    }));
    block.content = atJsonToLogseq({
      content: block.content,
      annotations: normalizedAnnotations,
    });
  });
  const actualTree = await (isBlock(notebookPageId)
    ? window.logseq.Editor.getBlock(notebookPageId, {
        includeChildren: true,
      }).then((b) => b?.children || [])
    : window.logseq.Editor.getPageBlocksTree(notebookPageId)
  ).then((tree = []) => flattenTree(tree.filter(isContentBlock)));

  const promises = expectedTree
    .map((expectedNode, order) => () => {
      const getParent = () => {
        const parentOrder =
          expectedNode.level === 1
            ? -1
            : actualTree
                .slice(0, order)
                .map((node, originalIndex) => ({
                  level: node.level || 1,
                  originalIndex,
                }))
                .reverse()
                .concat([{ level: 0, originalIndex: -1 }])
                .find(({ level }) => level < expectedNode.level)?.originalIndex;
        return {
          parent:
            typeof parentOrder === "undefined" || parentOrder < 0
              ? rootPageUuid
              : actualTree[parentOrder].uuid,
          parentOrder,
          level:
            typeof parentOrder === "undefined" || parentOrder < 0
              ? 0
              : actualTree[parentOrder].level || 0,
        };
      };
      if (actualTree.length > order) {
        const actualNode = actualTree[order] as BlockEntity;
        const blockUuid = actualNode.uuid;
        return window.logseq.Editor.updateBlock(blockUuid, expectedNode.content)
          .catch((e) =>
            Promise.reject(new Error(`Failed to update block: ${e.message}`))
          )
          .then(() => {
            if (actualNode.level !== expectedNode.level) {
              const { parent, parentOrder } = getParent();
              const previousSibling = actualTree
                .slice(
                  typeof parentOrder !== "undefined" && parentOrder >= 0
                    ? parentOrder
                    : 0,
                  order
                )
                .reverse()
                .find((a) => a.level === expectedNode.level);
              (previousSibling
                ? window.logseq.Editor.moveBlock(
                    actualNode.uuid,
                    previousSibling.uuid
                  )
                : window.logseq.Editor.moveBlock(actualNode.uuid, parent, {
                    children: true,
                  })
              )
                .then(() => {
                  updateLevel(actualNode, expectedNode.level);
                })
                .catch((e) =>
                  Promise.reject(
                    new Error(`Failed to move block: ${e.message}`)
                  )
                );
            }
            actualNode.content = expectedNode.content;
            return Promise.resolve();
          });
      } else {
        const { parent, level } = getParent();

        return window.logseq.Editor.appendBlockInPage(
          parent,
          expectedNode.content
        )
          .then(async (b) => {
            // this b has no level
            if (b) {
              if (b) {
                b.level = level + 1;
                actualTree.push(b);
              }
            }
          })
          .catch((e) =>
            Promise.reject(new Error(`Failed to append block: ${e.message}`))
          );
      }
    })
    .concat(
      actualTree
        .slice(expectedTree.length)
        .map(
          (a) => () =>
            window.logseq.Editor.removeBlock(a.uuid).catch((e) =>
              Promise.reject(new Error(`Failed to remove block: ${e.message}`))
            )
        )
    );

  return promises.reduce((p, c) => p.then(c), Promise.resolve<unknown>(""));
};

const setupSharePageWithNotebook = () => {
  const { unload, refreshContent } = loadSharePageWithNotebook({
    getCurrentNotebookPageId: () =>
      logseq.Editor.getCurrentPage().then((p) =>
        p
          ? !("page" in p)
            ? p.originalName
            : logseq.Editor.upsertBlockProperty(p.uuid, "id", p.uuid).then(
                () => p.uuid
              ) || ""
          : datefnsFormat(new Date(), "MMM do, yyyy")
      ),
    applyState,
    createPage: (title) =>
      window.logseq.Editor.createPage(title, {}, { redirect: false }),
    deletePage: (title) => window.logseq.Editor.deletePage(title),
    openPage: (title) => {
      // as usual, logseq is givin trouble...
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          window.parent.location.hash = `#/page/${encodeURIComponent(
            title.toLowerCase()
          )}`;
          resolve();
        }, 1000)
      );
    },
    doesPageExist: (title) =>
      logseq.Editor.getPage(title).then(
        (p) =>
          !!p ||
          (isBlock(title) && logseq.Editor.getBlock(title).then((b) => !!b))
      ),
    calculateState: async (notebookPageId) =>
      calculateState(notebookPageId).then(({ nodes, ...atJson }) => atJson),
    overlayProps: {
      viewSharedPageProps: {
        linkNewPage: (_, title) =>
          window.logseq.Editor.getPage(title)
            .then(
              (page) =>
                page ||
                window.logseq.Editor.createPage(title, {}, { redirect: false })
            )
            .then(() => title),
        onLinkClick: (notebookPageId, e) => {
          if (e.shiftKey) {
            logseq.Editor.openInRightSidebar(notebookPageId);
          } else {
            window.location.hash = `#/page/${encodeURIComponent(
              notebookPageId
            )}`;
          }
        },
      },
      sharedPageStatusProps: {
        onCopy: (s) => window.parent.navigator.clipboard.writeText(s),
        selector: "h1.title, div.breadcrumb.block-parents",
        getNotebookPageId: async (h) => {
          return h.nodeName === "H1"
            ? window.logseq.Editor.getPage(
                h.textContent?.toLowerCase() || ""
              ).then((p) => p?.originalName || "")
            : h.parentElement?.parentElement?.querySelector(
                '.page-blocks-inner > div > div[id*="-"]'
              )?.id || "";
        },
        getPaths: (notebookPageId) => {
          return (
            isBlock(notebookPageId)
              ? Array.from(
                  window.parent.document.querySelectorAll(
                    `.page-blocks-inner div[id="${notebookPageId}"]`
                  )
                )
                  .map((e) =>
                    e
                      .closest("#main-content-container")
                      ?.querySelector<HTMLDivElement>(
                        ".breadcrumb.block-parents"
                      )
                  )
                  .filter((e): e is HTMLDivElement => !!e)
              : Array.from(
                  window.parent.document.querySelectorAll<HTMLHeadingElement>(
                    "h1.title"
                  )
                ).filter(
                  (h) =>
                    h.textContent?.toLowerCase() ===
                    notebookPageId.toLowerCase()
                )
          ).flatMap((heading) => {
            if (heading.nodeName === "H1") {
              const parent =
                heading?.parentElement?.parentElement?.parentElement
                  ?.parentElement || null;
              if (parent) {
                const sel = v4();
                parent.setAttribute("data-samepage-shared", sel);
                return [
                  `div[data-samepage-shared="${sel}"] div.ls-page-title, div[data-samepage-shared="${sel}"] h1.ls-page-title, div[data-samepage-shared="${sel}"] .journal-title h1.title`,
                ];
              }
              return [];
            } else {
              const parent = heading?.parentElement?.parentElement;
              if (parent) {
                const sel = v4();
                parent.setAttribute("data-samepage-shared", sel);
                return [`div[data-samepage-shared="${sel}"]::before(1)`];
              }
              return [];
            }
          });
        },
      },
    },
  });

  const idObserver = createHTMLObserver({
    selector: "a.page-property-key",
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

  const getParents = (id: number | string): Promise<string[]> =>
    window.logseq.Editor.getBlock(id).then((b) => {
      if (b) {
        if (b.page.id === b.parent.id) {
          return window.logseq.Editor.getPage(b.page.id).then((p) =>
            p ? [p.originalName] : []
          );
        } else {
          return getParents(b.parent.id).then((parents) =>
            parents.concat([b.uuid])
          );
        }
      }
      return [];
    });

  const forEachNotebookPageId = async ({
    blockUuid,
    callback,
  }: {
    blockUuid: string;
    callback: (notebookPageId: string) => void;
  }) => {
    const notebookPageIds = await getParents(blockUuid);
    notebookPageIds.forEach((n) => {
      if (isShared(n)) {
        callback(n);
      }
    });
  };

  const refreshState = ({
    blockUuid,
    notebookPageId,
    changeMethod,
    label,
  }: {
    label: string;
    blockUuid: string;
    notebookPageId: string;
    changeMethod: (callback: () => {}) => () => void;
  }) => {
    refreshRef = changeMethod(async () => {
      refreshContent({ notebookPageId, label });
    });
  };

  let refreshRef: (() => void) | undefined;
  const clearRefreshRef = () => {
    if (refreshRef) {
      refreshRef?.();
      refreshRef = undefined;
    }
  };
  const bodyKeydownListener = async (e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (e.metaKey) return;
    if (/^Arrow/.test(e.key)) return;
    if (el.tagName === "TEXTAREA" && el.classList.contains("normal-block")) {
      const blockUuid =
        el.id.match(
          /^edit-block-\d+-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/
        )?.[1] || "";
      forEachNotebookPageId({
        blockUuid,
        callback(notebookPageId) {
          clearRefreshRef();
          refreshState({
            notebookPageId,
            label: `Key Presses - ${e.key}`,
            changeMethod: (c) => window.logseq.DB.onBlockChanged(blockUuid, c),
            blockUuid,
          });
        },
      });
    }
  };
  window.parent.document.body.addEventListener("keydown", bodyKeydownListener);

  const bodyPasteListener = async (e: ClipboardEvent) => {
    const el = e.target as HTMLElement;
    if (el.tagName === "TEXTAREA" && el.classList.contains("normal-block")) {
      const blockUuid =
        el.id.match(
          /^edit-block-\d+-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/
        )?.[1] || "";
      forEachNotebookPageId({
        blockUuid,
        callback(notebookPageId) {
          clearRefreshRef();
          refreshState({
            label: `Paste`,
            notebookPageId,
            blockUuid,
            changeMethod: (c) => window.logseq.DB.onBlockChanged(blockUuid, c),
          });
        },
      });
    }
  };
  window.parent.document.body.addEventListener("paste", bodyPasteListener);

  const dragEndListener = async (e: DragEvent) => {
    const el = e.target as HTMLElement;
    if (el.tagName === "SPAN" && el.hasAttribute("blockid")) {
      const blockUuid = el.getAttribute("blockid");
      if (blockUuid) {
        forEachNotebookPageId({
          blockUuid,
          callback(notebookPageId) {
            clearRefreshRef();
            refreshState({
              label: `Drag Block`,
              blockUuid,
              notebookPageId,
              changeMethod: (c) =>
                window.logseq.DB.onChanged(({ blocks }) => {
                  if (blocks.some((b) => b.uuid === blockUuid)) {
                    c();
                  }
                }),
            });
          },
        });
      }
    }
  };
  // for some reason, dragend doesn't fire sometimes...
  window.parent.document.body.addEventListener("dragstart", dragEndListener);

  return () => {
    clearRefreshRef();
    window.parent.document.body.removeEventListener(
      "keydown",
      bodyKeydownListener
    );
    window.parent.document.body.removeEventListener("paste", bodyPasteListener);
    window.parent.document.body.removeEventListener(
      "dragstart",
      dragEndListener
    );
    idObserver.disconnect();
    unload();
  };
};

export default setupSharePageWithNotebook;
