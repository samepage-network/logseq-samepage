import atJsonParser from "samepage/utils/atJsonParser";
// @ts-ignore for now
import blockGrammar from "../utils/blockGrammar.ne";
import setupNotebookQuerying from "samepage/protocols/notebookQuerying";
import createHTMLObserver from "samepage/utils/createHTMLObserver";
import { render as referenceRender } from "../components/ExternalNotebookReference";

const setup = () => {
  const { unload } = setupNotebookQuerying({
    onQuery: async (notebookPageId) => {
      const content = await logseq.Editor.getBlock(notebookPageId).then(
        (b) => b?.content || null
      );
      return atJsonParser(blockGrammar, content || "");
    },
    onQueryResponse: async ({ data, request }) => {
      document.body.dispatchEvent(
        new CustomEvent("samepage:reference:response", {
          detail: {
            request,
            data,
          },
        })
      );
    },
  });
  const refObserver = createHTMLObserver<HTMLSpanElement>({
    selector: `span[title="Block ref invalid"]`,
    callback: referenceRender,
  });
  return () => {
    unload();
    refObserver.disconnect();
  };
};

export default setup;
