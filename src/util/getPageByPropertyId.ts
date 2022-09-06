const getPageByPropertyId = (uuid: string) =>
  window.logseq.DB.datascriptQuery(
    `[:find (pull ?p [:block/original-name :block/name]) :where [?b :block/properties ?prop] [[get ?prop :samepage] ?id] [(= ?id "${uuid}")] [?b :block/page ?p]]`
  ).then((b) =>
    b.length
      ? {
          originalName: (b[0][0]?.["original-name"] as string) || "",
          name: (b[0][0]?.["name"] as string) || "",
        }
      : null
  );

export default getPageByPropertyId;
