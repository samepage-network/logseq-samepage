import { Spinner, SpinnerSize } from "@blueprintjs/core";
import React from "react";
import ReactDOM from "react-dom";

const Loading = () => {
  return <Spinner size={SpinnerSize.SMALL} />;
};

export const renderLoading = () => {
  const reactParent = document.createElement("div");
  reactParent.style.position = "absolute";
  reactParent.style.bottom = "16px";
  reactParent.style.right = "16px";
  document.body.appendChild(reactParent);
  ReactDOM.render(<Loading />, reactParent);
  return () => {
    ReactDOM.unmountComponentAtNode(reactParent);
    reactParent.remove();
  };
};

export default Loading;
