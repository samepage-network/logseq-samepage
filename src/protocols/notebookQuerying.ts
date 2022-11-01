import atJsonParser from "samepage/utils/atJsonParser";
import blockGrammar from "../util/blockGrammar";
import setupNotebookQuerying from "samepage/protocols/notebookQuerying";
import createHTMLObserver from "samepage/utils/createHTMLObserver";

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
  const refObserver = createHTMLObserver({
    selector: "div.content-block",
    callback: (el) => {
      const realContentContainer = (el as HTMLDivElement).querySelector("span");
      
    },
  });
  return () => {
    unload();
    refObserver.disconnect();
  };
};

export default setup;
