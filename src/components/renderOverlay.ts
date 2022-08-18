import React from "react";
import ReactDOM from "react-dom";
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
  const parent = document.createElement("div");
  parent.id = "samepage-share-page-dialog";
  document.body.appendChild(parent);

  const onClose = () => {
    ReactDOM.unmountComponentAtNode(parent);
    parent.remove();
  };
  ReactDOM.render(
    React.createElement(Overlay, {
      ...props,
      onClose,
    }),
    parent
  );
  return onClose;
};

export default renderOverlay;
