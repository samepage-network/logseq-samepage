import atJsonParser from "samepage/utils/atJsonParser";
// @ts-ignore for now
import blockGrammar from "../utils/blockGrammar.ne";
import setupNotebookQuerying from "samepage/protocols/notebookQuerying";
import createHTMLObserver from "samepage/utils/createHTMLObserver";
import ExternalNotebookReference from "../components/ExternalNotebookReference";
import renderOverlay from "../components/renderOverlay";

const setup = () => {
  const unloads = new Set<() => void>();
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
  logseq.App.onMacroRendererSlotted((e) => {
    const { slot, payload } = e;
    const [method, ...rest] = payload.arguments;
    if (method === "samepage-reference") {
      const [notebookUuid, notebookPageId] = rest.join(",").split(":");
      const unmount = renderOverlay({
        Overlay: ExternalNotebookReference,
        props: { notebookPageId, notebookUuid },
        path: `div#${slot}`,
      });
      if (unmount)
        unloads.add(function unmountUnloader() {
          unloads.delete(unmountUnloader);
          unmount();
        });
    }
  });
  return () => {
    unloads.forEach(u => u());
    unload();
  };
};

export default setup;
