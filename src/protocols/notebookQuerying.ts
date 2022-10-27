// import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
// import {
//   render as referenceRender,
// } from "../components/CrossGraphReference";
import apiClient from "samepage/internal/apiClient";
import atJsonParser from "samepage/utils/atJsonParser";
import blockGrammar from "../util/blockGrammar";
import { InitialSchema } from "samepage/internal/types";
// import { addCommand } from "samepage/internal/registry";

const setupNotebookQuerying = () => {
  const { addNotebookListener, removeNotebookListener } = window.samepage;
  addNotebookListener({
    operation: "QUERY",
    handler: async (e, source) => {
      const { request } = e as { request: string };
      const [, notebookPageId] = request.split(":");
      const content = await logseq.Editor.getBlock(notebookPageId).then(
        (b) => b?.content || null
      );
      const data = atJsonParser(blockGrammar, content || "");
      apiClient({
        method: "query-response",
        request,
        response: JSON.stringify({
          found: content !== null,
          data,
        }),
        target: source.uuid,
      });
    },
  });
  addNotebookListener({
    operation: "QUERY_RESPONSE",
    handler: (e) => {
      const { found, data, request } = e as {
        found: boolean;
        data: InitialSchema;
        request: string;
      };
      const newData = found
        ? data
        : { content: `Notebook reference not found`, annotations: [] };
      document.body.dispatchEvent(
        new CustomEvent("samepage:reference", {
          detail: {
            request,
            newData,
          },
        })
      );
    },
  });
  // const observer = createHTMLObserver({
  //   callback: (s) => referenceRender(s),
  //   tag: "SPAN",
  //   className: "rm-paren--closed",
  // });
  // addCommand({
  //   label: "Copy Cross Notebook Reference",
  //   callback: () => {
  //     const blockUid = window.roamAlphaAPI.ui.getFocusedBlock()["block-uid"];
  //     window.navigator.clipboard.writeText(
  //       `((${onloadArgs.extensionAPI.settings.get("uuid")}:${blockUid}))`
  //     );
  //   },
  // });
  return () => {
    removeNotebookListener({ operation: "QUERY" });
    removeNotebookListener({ operation: "QUERY_RESPONSE" });
    // window.roamAlphaAPI.ui.commandPalette.removeCommand({
    //   label: "Copy Cross Notebook Reference",
    // });
    // observer?.disconnect();
  };
};

export default setupNotebookQuerying;
