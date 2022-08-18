import React from "react";
import { Intent, Toaster, ToasterPosition } from "@blueprintjs/core";

type ToastBaseProps = {
  content?: string;
  timeout?: number;
  intent?: Intent;
};

type ToastProps = {
  id: string;
  position?: ToasterPosition;
} & ToastBaseProps;

export const render = ({
  position = "top",
  ...props
}: ToastProps): (() => void) => {
  const className = `roamjs-toast-${position}`;
  const toasterRoot = document.querySelector(
    `.bp3-toast-container.${className}`
  );
  if (toasterRoot) {
    toasterRoot.dispatchEvent(
      new CustomEvent("roamjs-toast", { detail: props })
    );
    return () => toasterRoot.remove();
  } else {
    const toaster = Toaster.create({
      position,
      className,
    });

    const Toast = ({
      content = "RoamJS Notification",
      intent = Intent.PRIMARY,
      timeout = 5000,
    }: ToastBaseProps) => {
      return {
        message: (
          <>
            <style>{`.${className} p { margin-bottom: 0; }`}</style>
            <div>{content}</div>
          </>
        ),
        intent,
        timeout,
      };
    };
    toaster.show(Toast(props), props.id);
    setTimeout(() => {
      const toasterRoot = document.querySelector<HTMLDivElement>(
        `.bp3-toast-container.${className}`
      );
      if (toasterRoot)
        toasterRoot.addEventListener("roamjs-toast", ((e: CustomEvent) => {
          const {
            detail: { id, ...props },
          } = e;
          toaster.show(Toast(props), id);
        }) as EventListener);
    }, 1);
    return () => toaster.dismiss(props.id);
  }
};

export default render;
