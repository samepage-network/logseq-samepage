import type { InitialSchema, Schema } from "samepage/types";
import loadSharePageWithNotebook from "samepage/protocols/sharePageWithNotebook";
import atJsonParser from "samepage/utils/atJsonParser";
import createHTMLObserver from "samepage/utils/createHTMLObserver";
import type {
  BlockEntity,
  BlockUUIDTuple,
} from "@logseq/libs/dist/LSPlugin.user";
import Automerge from "automerge";
//@ts-ignore Fix later, already compiles
import blockGrammar from "../util/blockGrammar.ne";
import renderAtJson from "samepage/utils/renderAtJson";
import { v4 } from "uuid";

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

const toAtJson = ({ nodes = [] }: { nodes?: BlockEntity[] }): InitialSchema => {
  return flattenTree(nodes)
    .map((n) => (index: number) => {
      const { content: _content, annotations } = atJsonParser(
        blockGrammar,
        n.content
      );
      const content = `${
        _content.length ? _content : String.fromCharCode(0)
      }\n`;
      const end = content.length + index;
      const blockAnnotations: Schema["annotations"] = [
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
        annotations: [] as Schema["annotations"],
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

const isContentBlock = (b: BlockEntity) => {
  return !b.content || b.content.replace(/[a-z]+:: [^\n]+\n?/g, "");
};

const calculateState = async (notebookPageId: string) => {
  const nodes = (
    await window.logseq.Editor.getPageBlocksTree(notebookPageId)
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
    annotations: Schema["annotations"];
  };
};

const applyState = async (notebookPageId: string, state: Schema) => {
  const rootPageUuid = await window.logseq.Editor.getPage(notebookPageId).then(
    (p) => p?.uuid || ""
  );
  const expectedTree: SamepageNode[] = [];
  state.annotations.forEach((anno) => {
    if (anno.type === "block") {
      const currentBlock = {
        content: state.content
          .slice(anno.start, anno.end)
          .join("")
          .replace(/\n$/, ""),
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
    block.content = renderAtJson({
      state: {
        content: block.content,
        annotations: normalizedAnnotations,
      },
      applyAnnotation: {
        bold: {
          prefix: "**",
          suffix: `**`,
        },
        highlighting: {
          prefix: "^^",
          suffix: `^^`,
        },
        italics: {
          prefix: "_",
          suffix: `_`,
        },
        strikethrough: {
          prefix: "~~",
          suffix: `~~`,
        },
        link: ({ href }) => ({
          prefix: "[",
          suffix: `](${href})`,
        }),
        image: ({ src }) => ({
          prefix: "![",
          suffix: `](${src})`,
        }),
      },
    });
  });
  const actualTree = await window.logseq.Editor.getPageBlocksTree(
    notebookPageId
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
        };
      };
      if (actualTree.length > order) {
        const actualNode = actualTree[order] as BlockEntity;
        const blockUuid = actualNode.uuid;
        return window.logseq.Editor.updateBlock(blockUuid, expectedNode.content)
          .catch((e) => Promise.reject(`Failed to update block: ${e.message}`))
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
                  Promise.reject(`Failed to move block: ${e.message}`)
                );
            }
            actualNode.content = expectedNode.content;
            return Promise.resolve();
          });
      } else {
        const { parent } = getParent();

        return window.logseq.Editor.appendBlockInPage(
          parent,
          expectedNode.content
        )
          .then(() => Promise.resolve())
          .catch((e) => Promise.reject(`Failed to append block: ${e.message}`));
      }
    })
    .concat(
      actualTree
        .slice(expectedTree.length)
        .map(
          (a) => () =>
            window.logseq.Editor.removeBlock(a.uuid).catch((e) =>
              Promise.reject(`Failed to remove block: ${e.message}`)
            )
        )
    );

  return promises.reduce((p, c) => p.then(c), Promise.resolve<unknown>(""));
};

export let granularChanges = { enabled: false };

const setupSharePageWithNotebook = () => {
  const {
    unload,
    updatePage,
    joinPage,
    rejectPage,
    isShared,
    insertContent,
    deleteContent,
  } = loadSharePageWithNotebook({
    getCurrentNotebookPageId: () =>
      logseq.Editor.getCurrentPage().then((p) =>
        p && !("page" in p) ? p.originalName : ""
      ),
    applyState,
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
      notificationContainerProps: {
        actions: {
          accept: ({ title }) =>
            window.logseq.Editor.createPage(title, {}, { redirect: false })
              .then((page) =>
                page
                  ? joinPage({
                      notebookPageId: title,
                    }).then(() => {
                      // as usual, logseq is givin trouble...
                      return setTimeout(
                        () =>
                          (window.parent.location.hash = `#/page/${encodeURIComponent(
                            title.toLowerCase()
                          )}`),
                        1000
                      );
                    })
                  : Promise.reject(
                      `Failed to create a page with title ${title}`
                    )
              )

              .then(() => Promise.resolve())
              .catch((e) => {
                window.logseq.Editor.deletePage(title);
                return Promise.reject(e);
              }),
          reject: async ({ title }) =>
            rejectPage({
              notebookPageId: title,
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
      sharedPageStatusProps: {
        onCopy: (s) => window.parent.navigator.clipboard.writeText(s),
        getHtmlElement: async (notebookPageId) => {
          return Array.from(
            window.parent.document.querySelectorAll<HTMLHeadingElement>(
              "h1.title"
            )
          ).find(
            (h) => h.textContent?.toLowerCase() === notebookPageId.toLowerCase()
          );
        },
        selector: "h1.title",
        getNotebookPageId: async (h) => {
          return window.logseq.Editor.getPage(
            h.textContent?.toLowerCase() || ""
          ).then((p) => p?.originalName || "");
        },
        getPath: (heading) => {
          const parent =
            heading?.parentElement?.parentElement?.parentElement || null;
          if (parent) {
            const sel = v4();
            parent.setAttribute("data-samepage-shared", sel);
            return `div[data-samepage-shared="${sel}"]::before(1)`;
          }
          return null;
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
  const refreshState = ({
    blockUuid,
    notebookPageId,
    changeMethod,
  }: {
    blockUuid: string;
    notebookPageId: string;
    changeMethod: (callback: () => {}) => () => void;
  }) => {
    refreshRef = changeMethod(async () => {
      const doc = await calculateState(notebookPageId);
      updatePage({
        notebookPageId,
        label: `Refresh`,
        callback: (oldDoc) => {
          clearRefreshRef();
          oldDoc.content.deleteAt?.(0, oldDoc.content.length);
          oldDoc.content.insertAt?.(0, ...new Automerge.Text(doc.content));
          if (!oldDoc.annotations) oldDoc.annotations = [];
          oldDoc.annotations.splice(0, oldDoc.annotations.length);
          doc.annotations.forEach((a) => oldDoc.annotations.push(a));
        },
      });
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
      const notebookPage = await window.logseq.Editor.getBlock(blockUuid).then(
        (block) => block && window.logseq.Editor.getPage(block.page.id)
      );
      const notebookPageId = notebookPage?.originalName || "";
      if (isShared(notebookPageId)) {
        const { selectionStart, selectionEnd } = el as HTMLTextAreaElement;
        clearRefreshRef();
        calculateState(notebookPageId).then(({ nodes, annotations }) => {
          const getBlockAnnotationStart = () => {
            const index = nodes.map((n) => n.uuid).indexOf(blockUuid);
            return index >= 0
              ? annotations.filter((b) => b.type === "block")[index]?.start || 0
              : 0;
          };

          if (granularChanges.enabled && /^[a-zA-Z0-9 ]$/.test(e.key)) {
            const index =
              Math.min(selectionStart, selectionEnd) +
              getBlockAnnotationStart();
            (selectionStart !== selectionEnd
              ? deleteContent({
                  notebookPageId,
                  index,
                  count: Math.abs(selectionEnd - selectionStart),
                })
              : Promise.resolve()
            ).then(() =>
              insertContent({
                notebookPageId,
                content: e.key,
                index,
              })
            );
          } else if (granularChanges.enabled && /^Backspace$/.test(e.key)) {
            const index =
              Math.min(selectionStart, selectionEnd) +
              getBlockAnnotationStart();
            deleteContent({
              notebookPageId,
              index: selectionEnd === selectionStart ? index - 1 : index,
              count:
                selectionEnd === selectionStart
                  ? 1
                  : Math.abs(selectionEnd - selectionStart),
            });
          } else {
            refreshRef = window.logseq.DB.onBlockChanged(
              blockUuid,
              async () => {
                const doc = await calculateState(notebookPageId);
                updatePage({
                  notebookPageId,
                  label: `Refresh`,
                  callback: (oldDoc) => {
                    clearRefreshRef();
                    oldDoc.content.deleteAt?.(0, oldDoc.content.length);
                    oldDoc.content.insertAt?.(
                      0,
                      ...new Automerge.Text(doc.content)
                    );
                    if (!oldDoc.annotations) oldDoc.annotations = [];
                    oldDoc.annotations.splice(0, oldDoc.annotations.length);
                    doc.annotations.forEach((a) => oldDoc.annotations.push(a));
                  },
                });
              }
            );
          }
        });
      }
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
      const notebookPage = await window.logseq.Editor.getBlock(blockUuid).then(
        (block) => block && window.logseq.Editor.getPage(block.page.id)
      );
      const notebookPageId = notebookPage?.originalName || "";
      if (isShared(notebookPageId)) {
        clearRefreshRef();
        refreshState({
          notebookPageId,
          blockUuid,
          changeMethod: (c) => window.logseq.DB.onBlockChanged(blockUuid, c),
        });
      }
    }
  };
  window.parent.document.body.addEventListener("paste", bodyPasteListener);

  const dragEndListener = async (e: DragEvent) => {
    const el = e.target as HTMLElement;
    if (el.tagName === "SPAN" && el.hasAttribute("blockid")) {
      const blockUuid = el.getAttribute("blockid");
      if (blockUuid) {
        const notebookPage = await window.logseq.Editor.getBlock(
          blockUuid
        ).then((block) => block && window.logseq.Editor.getPage(block.page.id));
        const notebookPageId = notebookPage?.originalName || "";
        if (isShared(notebookPageId)) {
          clearRefreshRef();
          refreshState({
            blockUuid,
            notebookPageId,
            changeMethod: (c) =>
              window.logseq.DB.onChanged(({ blocks }) => {
                if (blocks.some((b) => b.uuid === blockUuid)) {
                  c();
                }
              }),
          });
        }
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
