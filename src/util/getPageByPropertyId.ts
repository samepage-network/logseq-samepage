const getPageByPropertyId = (uuid: string) =>
  window.logseq.DB.datascriptQuery(
    `[:find (pull ?b [:block/original-name]) :where [?b :block/file _] [?b :block/properties ?p] [[get ?p :id] ?id] [(= ?id "${uuid}")]]`
  ).then((b) =>
    b.length
      ? { originalName: (b[0][0]?.["original-name"] as string) || "" }
      : null
  );

export default getPageByPropertyId;
