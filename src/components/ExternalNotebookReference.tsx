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
  const blockid = `${notebookUuid}:${notebookPageId}`;
  useEffect(() => {
    apiClient<{
      found: boolean;
      data: InitialSchema;
    }>({
      method: "query",
      request: blockid,
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
            id={`block-content-${blockid}`}
            // @ts-ignore idk they include it
            blockid={blockid}
            data-type="default"
            className="block-content inline"
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

export default ExternalNotebookReference;
