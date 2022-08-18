import React from "react";
import { Classes, Dialog } from "@blueprintjs/core";
import type { OverlayProps } from "./renderOverlay";

type Props = {
  minutes: number;
  messages: number;
  date: string;
};

const UsageChart = ({ onClose, ...stats }: OverlayProps<Props>) => {
  return (
    <Dialog
      onClose={onClose}
      isOpen={true}
      title={"Usage Chart"}
      autoFocus={false}
      enforceFocus={false}
    >
      <div className={Classes.DIALOG_BODY}>
        <div className={"flex justify-between items-center"}>
          <b>Description</b>
          <span>
            <b style={{ minWidth: 80, display: "inline-block" }}>Price</b>
            <b style={{ minWidth: 80, display: "inline-block" }}>Qty</b>
            <b style={{ minWidth: 80, display: "inline-block" }}>Total</b>
          </span>
        </div>
        <div className={"flex justify-between items-center"}>
          <span>Mins Conn.</span>
          <span>
            <span style={{ minWidth: 80, display: "inline-block" }}>
              $0.002
            </span>
            <span style={{ minWidth: 80, display: "inline-block" }}>
              {stats.minutes.toFixed(2)}
            </span>
            <span style={{ minWidth: 80, display: "inline-block" }}>
              ${(stats.minutes * 0.002).toFixed(2)}
            </span>
          </span>
        </div>
        <div className={"flex justify-between items-center"}>
          <span>Messages</span>
          <span>
            <span style={{ minWidth: 80, display: "inline-block" }}>$0.01</span>
            <span style={{ minWidth: 80, display: "inline-block" }}>
              {stats.messages.toFixed(2)}
            </span>
            <span style={{ minWidth: 80, display: "inline-block" }}>
              ${(stats.messages * 0.01).toFixed(2)}
            </span>
          </span>
        </div>
        <hr />
        <div className={"flex justify-between items-center"}>
          <span>
            <b>Total</b> {stats.date && `(Billed: ${stats.date})`}
          </span>
          <span style={{ display: "flex", alignItems: "center" }}>
            <b style={{ minWidth: 80, display: "inline-block" }}>
              ${(stats.minutes * 0.002 + stats.messages * 0.01).toFixed(2)}
            </b>
          </span>
        </div>
      </div>
    </Dialog>
  );
};

export default UsageChart;
