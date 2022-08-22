import React from "react";
import { createRoot } from "react-dom/client";
import { v4 } from "uuid";

export type OverlayProps<T extends Record<string, unknown>> = {
  onClose: () => void;
} & T;

const renderOverlay = <T extends Record<string, unknown>>({
  id = v4(),
  Overlay = (props) => React.createElement("div", props),
  props = {} as T,
}: {
  id?: string;
  Overlay?: (props: OverlayProps<T>) => React.ReactElement;
  props?: T;
} = {}) => {
  // I _think_ this might be the ideal flow...
  // logseq.provideModel({
  //   renderOverlay() {
  //     const parent = document.getElementById(id);
  //     if (parent) {
  //       const root = createRoot(parent);
  //       onClose = () => {
  //         root.unmount();
  //         parent.remove();
  //       };
  //       root.render(
  //         React.createElement(Overlay, {
  //           ...props,
  //           onClose,
  //         })
  //       );
  //     }
  //   },
  // });

  // I'm going to leave the data-on-load there, even though it's not supported
  // for divs, to communicate intent during review
  logseq.provideUI({
    key: id,
    path: "body",
    template: `<div id="${id}" data-on-load="renderOverlay"></div>`,
  });

  return new Promise((resolve) => setTimeout(() => {
    const parent = window.parent.document.getElementById(id);
    if (parent) {
      const root = createRoot(parent);
      const onClose = () => {
        root.unmount();
        const {parentElement} = parent;
        if (parentElement) parentElement.remove();
        else parent.remove();
      }
      root.render(
        React.createElement(Overlay, {
          ...props,
          onClose,
        })
      );
      resolve(onClose);
    }
  }));
};

export default renderOverlay;
