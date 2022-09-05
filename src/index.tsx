import "@logseq/libs";
import "./index.css";
import setupSamePageClient from "@samepage/client/protocols/setupSamePageClient";
import { onAppEvent } from "@samepage/client/internal/registerAppEventListener";
import UsageChart from "./components/UsageChart";
import { renderLoading } from "./components/Loading";
import setupSharePageWithNotebook from "./protocols/sharePageWithNotebook";
import renderOverlay from "./components/renderOverlay";

const main = async () => {
  logseq.useSettingsSchema([
    {
      key: "auto-connect",
      type: "boolean",
      title: "Auto Connect",
      description: "Automatically connect to the SamePage Network",
      default: false,
    },
  ]);

  const workspace = await logseq.App.getCurrentGraph().then(
    (info) => info?.name || ""
  );

  // logseq commands arent idempotent -.-
  const commandsRegistered = new Set<string>();
  let removeLoadingCallback: (() => void) | undefined;
  const { unload: unloadSamePageClient } = setupSamePageClient({
    isAutoConnect: logseq.settings?.["auto-connect"] as boolean,
    app: 2,
    workspace,
    addCommand: ({ label, callback }) => {
      const key = label.replace(/ /g, "-").toLowerCase();
      if (!commandsRegistered.has(key)) {
        logseq.App.registerCommandPalette({ label, key }, callback);
        commandsRegistered.add(key);
      }
    },
    removeCommand: ({ label }) => {
      const key = label.replace(/ /g, "-").toLowerCase();
      if (commandsRegistered.has(key)) {
        logseq.App.unregister_plugin_simple_command(
          `${logseq.baseInfo.id}/${key}`
        );
        commandsRegistered.delete(key);
      }
    },
  });
  onAppEvent("log", (evt) =>
    window.logseq.UI.showMsg(
      evt.content,
      evt.intent === "info" ? "success" : evt.intent,
      { timeout: 5000 }
    )
  );
  onAppEvent("usage", (evt) =>
    renderOverlay({ Overlay: UsageChart, props: evt })
  );
  onAppEvent("connection", (evt) => {
    if (evt.status === "PENDING")
      renderLoading().then((c) => (removeLoadingCallback = c));
    else removeLoadingCallback?.();
  });
  const unloadSharePageWithNotebook = setupSharePageWithNotebook();

  logseq.provideStyle(`@import url("https://unpkg.com/normalize.css@^8.0.1");
@import url("https://unpkg.com/@blueprintjs/core@^4.8.0/lib/css/blueprint.css");
body {
  font-size: 16px;
}
a.page-title:hover {
  text-decoration: none;
}
.flex-col-reverse {
  flex-direction: column-reverse;
}
.top-2 {
  top: 8px;
}
.right-2 {
  right: 8px;
}
div.samepage-notification-container { 
  top: 40px;
  bottom: unset;
}
`);

  logseq.beforeunload(async () => {
    Array.from(
      window.parent.document.head.querySelectorAll(`style[data-ref=samepage]`)
    ).forEach((s) => s.remove());
    unloadSharePageWithNotebook();
    unloadSamePageClient();
  });
};

logseq.ready(main).catch(console.error);
