import atJsonParser from "samepage/utils/atJsonParser";
import blockGrammar from "../util/blockGrammar";
import setupNotebookQuerying from "samepage/protocols/notebookQuerying";

const setup = () => {
  const { unload, query } = setupNotebookQuerying({
    onQuery: async (notebookPageId) => {
      const content = await logseq.Editor.getBlock(notebookPageId).then(
        (b) => b?.content || null
      );
      return atJsonParser(blockGrammar, content || "");
    },
    onQueryResponse: async ({ data, request }) => {
      document.body.dispatchEvent(
        new CustomEvent("samepage:reference", {
          detail: {
            request,
            data,
          },
        })
      );
    },
  });
  // how to show it?
  return () => {
    unload();
  };
};

export default setup;
