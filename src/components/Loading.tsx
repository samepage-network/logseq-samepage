import { Spinner, SpinnerSize } from "@blueprintjs/core";
import React from "react";
import { createRoot } from "react-dom/client";

const Loading = () => {
  return <Spinner size={SpinnerSize.SMALL} />;
};

export const renderLoading = () => {
  const id = "loading-root";
  logseq.provideUI({
    key: id,
    path: "body",
    template: `<div id="${id}" style="position:absolute;bottom:16px;right:16px"></div>`,
  });
  return new Promise<() => void>((resolve) =>
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
        root.render(<Loading />);
        resolve(onClose);
      }
    })
  );
};

export default Loading;
