import "@logseq/libs";
import setupSamePageClient from "samepage/protocols/setupSamePageClient";
import defaultSettings from "samepage/utils/defaultSettings";
import { onAppEvent } from "samepage/internal/registerAppEventListener";
import { renderLoading } from "./components/Loading";
import setupSharePageWithNotebook from "./protocols/sharePageWithNotebook";
import renderOverlay from "./components/renderOverlay";
import type { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin";

const main = async () => {
  logseq.useSettingsSchema(
    defaultSettings.map(
      (s) =>
        ({
          key: s.id,
          type: s.type,
          title: s.name,
          description: s.description,
          default: s.default,
        } as SettingSchemaDesc)
    )
  );

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
div#main-content-container div[data-render*="-"] {
  flex-direction: column;
}
`);

  const workspace = await logseq.App.getCurrentGraph().then(
    (info) => info?.name || ""
  );

  // logseq commands arent idempotent -.-
  const commandsRegistered = new Set<string>();
  const { unload: unloadSamePageClient } = setupSamePageClient({
    isAutoConnect: logseq.settings?.["auto-connect"] as boolean,
    app: "LogSeq",
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
    renderOverlay,
    appRoot: window.parent.document.body,
  });
  onAppEvent("log", (evt) =>
    window.logseq.UI.showMsg(
      evt.content,
      evt.intent === "info" ? "success" : evt.intent,
      { timeout: 5000 }
    )
  );
  let removeLoadingCallback: (() => void) | undefined;
  onAppEvent("connection", (evt) => {
    if (evt.status === "PENDING")
      renderLoading().then((c) => (removeLoadingCallback = c));
    else removeLoadingCallback?.();
  });

  const unloadSharePageWithNotebook = setupSharePageWithNotebook();

  logseq.beforeunload(async () => {
    Array.from(
      window.parent.document.head.querySelectorAll(`style[data-ref=samepage]`)
    ).forEach((s) => s.remove());
    unloadSharePageWithNotebook();
    unloadSamePageClient();
  });
};

logseq.ready(main).catch(console.error);
