import type { PageEntity } from "@logseq/libs/dist/LSPlugin.user";

const addIdProperty = (page: PageEntity | null) =>
  (page
    ? window.logseq.Editor.getPageBlocksTree(page.name).then((tree) => ({
        tree,
        uuid: page.uuid,
      }))
    : Promise.resolve({ tree: [], uuid: "" })
  ).then(({ tree, uuid }) =>
    (tree.length
      ? Promise.resolve(tree[0].uuid)
      : window.logseq.Editor.appendBlockInPage(uuid, ``).then((b) => b?.uuid)
    )
      .then((blockUuid) =>
        blockUuid
          ? window.logseq.Editor.upsertBlockProperty(
              blockUuid,
              "samepage",
              uuid
            )
          : Promise.resolve()
      )
      .then(() => uuid)
  );

export default addIdProperty;
