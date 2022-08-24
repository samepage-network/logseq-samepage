const addIdProperty = (notebookPageId: string) =>
  window.logseq.Editor.getPage(notebookPageId)
    .then((p) => p && window.logseq.Editor.getPageBlocksTree(p.originalName))
    .then(
      (tree) =>
        tree &&
        window.logseq.Editor.insertBlock(
          tree[0].uuid,
          `id:: ${notebookPageId}`,
          {
            before: true,
          }
        )
    );

export default addIdProperty;
