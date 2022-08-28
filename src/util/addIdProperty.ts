const addIdProperty = (notebookPageId: string) =>
  window.logseq.Editor.upsertBlockProperty(
    notebookPageId,
    "id",
    notebookPageId
  ).then(() =>
    window.logseq.Editor.appendBlockInPage(
      notebookPageId,
      `id:: ${notebookPageId}`
    )
  );

export default addIdProperty;
