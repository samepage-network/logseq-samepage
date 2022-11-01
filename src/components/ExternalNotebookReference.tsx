import React, { useEffect, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import type { InitialSchema } from "samepage/internal/types";
import apiClient from "samepage/internal/apiClient";
import atJsonToLogseq from "../utils/atJsonToLogseq";

export const references: Record<string, Record<string, InitialSchema>> = {};

const ExternalNotebookReference = ({
  notebookUuid,
  notebookPageId,
}: {
  notebookUuid: string;
  notebookPageId: string;
}) => {
  const [data, setData] = useState<InitialSchema>(
    references[notebookUuid]?.[notebookPageId] || {
      content: `Loading reference from external notebook...`,
      annotations: [],
    }
  );
  const setReferenceData = useCallback(
    (data: InitialSchema) => {
      if (!references[notebookUuid]) references[notebookUuid] = {};
      setData((references[notebookUuid][notebookPageId] = data));
    },
    [notebookPageId, notebookUuid]
  );
  useEffect(() => {
    apiClient<{
      found: boolean;
      data: InitialSchema;
    }>({
      method: "query",
      request: `${notebookUuid}:${notebookPageId}`,
    }).then((e) => {
      const { found, data } = e;
      const newData = found
        ? data
        : { content: "Notebook reference not found", annotations: [] };
      setReferenceData(newData);
    });
    const queryResponseListener = ((e: CustomEvent) => {
      const { request, data } = e.detail as {
        request: string;
        data: InitialSchema;
      };
      if (request === `${notebookUuid}:${notebookPageId}`) {
        setReferenceData(data);
      }
    }) as EventListener;
    window.parent.document.body.addEventListener(
      "samepage:reference:response",
      queryResponseListener
    );
    return () =>
      window.parent.document.body.removeEventListener(
        "samepage:reference:response",
        queryResponseListener
      );
  }, [setReferenceData, notebookUuid, notebookPageId]);
  return (
    <div data-type="default" className="block-ref-wrap inline">
      <div
        data-tooltipped=""
        aria-describedby="tippy-tooltip-24"
        data-original-title="null"
        style={{ display: "inline" }}
      >
        <span className="block-ref">
          <div
            id="block-content-635ad41a-9a67-4d95-8dd3-4c07892b7025"
            // @ts-ignore idk they include it
            blockid="635ad41a-9a67-4d95-8dd3-4c07892b7025"
            data-type="default"
            class="block-content inline"
            style={{ width: "100%" }}
          >
            <div className="flex flex-row justify-between block-content-inner">
              <div className="flex-1 w-full">
                <span className="inline">{atJsonToLogseq(data)}</span>
              </div>
            </div>
          </div>
        </span>
      </div>
    </div>
  );
};

export const render = (s: HTMLSpanElement) => {
  const text = s.innerText.replace(/^\(\(/, "").replace(/\)\)$/, "");
  if (text) {
    const [notebookUuid, notebookPageId] = text.split(":");
    if (notebookPageId) {
      ReactDOM.render(
        <ExternalNotebookReference
          notebookUuid={notebookUuid}
          notebookPageId={notebookPageId}
        />,
        s
      );
    }
  }
};

export default ExternalNotebookReference;
