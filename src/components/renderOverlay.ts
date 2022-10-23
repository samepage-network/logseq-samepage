import React from "react";
import { createRoot } from "react-dom/client";
import { v4 } from "uuid";
import type { RenderOverlay } from "samepage/internal/types";

let unmount: () => void;

const BEFORE_REGEX = /::before\(([\w.]+)\)$/;

const renderOverlay: RenderOverlay = ({
  id = v4(),
  Overlay = (props) => React.createElement("div", props),
  props = {},
  path = "body",
}) => {
  const parentId = id.replace(/^\d*/, "");
  if (path) {
    if (typeof path === "string") {
      const query = path.replace(BEFORE_REGEX, "");
      if (
        !window.parent.document
          .querySelector(query)
          ?.querySelector(`#${parentId}`)
      ) {
        const before = Number(
          typeof path === "string" ? BEFORE_REGEX.exec(path)?.[1] : undefined
        );

        if (!Number.isNaN(before)) {
          setTimeout(() => {
            const el = window.parent.document.getElementById(parentId);
            if (
              el?.parentElement?.parentElement &&
              before < el.parentElement.parentElement.children.length
            ) {
              el.parentElement.parentElement.insertBefore(
                el.parentElement,
                el.parentElement.parentElement.children[before]
              );
            }
          });
        }
        logseq.provideUI({
          key: parentId,
          path: query,
          template: `<div id="${parentId}"></div>`,
        });
      } else {
        return () => {};
      }
    } else {
      if (!path.querySelector(`#${parentId}`)) {
        const renderId = v4();
        path.setAttribute(`data-render`, renderId);
        logseq.provideUI({
          key: parentId,
          path: `${path.tagName.toLowerCase()}[data-render="${renderId}"]`,
          template: `<div id="${parentId}"></div>`,
        });
      } else {
        return () => {};
      }
    }

    setTimeout(() => {
      const parent = window.parent.document.getElementById(parentId);
      if (parent) {
        const root = createRoot(parent);
        const onClose = () => {
          root.unmount();
          const { parentElement } = parent;
          if (parentElement) parentElement.remove();
          else parent.remove();
        };
        root.render(
          // @ts-ignore This should work...
          React.createElement(Overlay, {
            ...props,
            onClose,
            isOpen: true,
          })
        );
        unmount = onClose;
      }
    });
  }
  return () => {
    unmount?.();
  };
};

export default renderOverlay;
