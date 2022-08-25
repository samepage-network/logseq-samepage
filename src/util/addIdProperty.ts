const addIdProperty = (notebookPageId: string) =>
  window.logseq.Editor.upsertBlockProperty(
    notebookPageId,
    "id",
    notebookPageId
  );

export default addIdProperty;
