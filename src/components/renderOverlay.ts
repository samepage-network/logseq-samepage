import React from "react";
import { createRoot } from "react-dom/client";
import { v4 } from "uuid";
import type { RenderOverlay } from "samepage/types";

let unmount: () => void;

const renderOverlay: RenderOverlay = ({
  id = v4(),
  Overlay = (props) => React.createElement("div", props),
  props = {},
  path = "body",
}) => {
  if (path) {
    if (typeof path === "string") {
      if (
        !window.parent.document.querySelector(path)?.querySelector(`#${id}`)
      ) {
        logseq.provideUI({
          key: id,
          path,
          template: `<div id="${id}"></div>`,
        });
      } else {
        return () => {};
      }
    } else {
      if (!path.querySelector(`#${id}`)) {
        const renderId = v4();
        path.setAttribute(`data-render`, renderId);
        logseq.provideUI({
          key: id,
          path: `${path.tagName.toLowerCase()}[data-render=${renderId}]`,
          template: `<div id="${id}"></div>`,
        });
      } else {
        return () => {};
      }
    }

    setTimeout(() => {
      const parent = window.parent.document.getElementById(id);
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
