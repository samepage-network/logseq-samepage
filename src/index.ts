import "@logseq/libs";
import setupSamePageClient from "samepage/protocols/setupSamePageClient";
import defaultSettings from "samepage/utils/defaultSettings";
import { onAppEvent } from "samepage/internal/registerAppEventListener";
import { renderLoading } from "./components/Loading";
import setupSharePageWithNotebook, {
  granularChanges,
} from "./protocols/sharePageWithNotebook";
import renderOverlay from "./components/renderOverlay";
import type { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin";

const IGNORED_LOGS = new Set([
  "list-pages-success",
  "load-remote-message",
  "update-success",
]);

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
  logseq.onSettingsChanged((_, b) => {
    granularChanges.enabled = !!b["granular-changes"];
  });

  fetch("samepage.css")
    .then((r) => r.text())
    .then((style) =>
      logseq.provideStyle(`${style}

div#main-content-container div[data-render*="-"] {
  flex-direction: column;
}

.samepage-shared-page-status img {
  margin: 0;
}
`)
    );

  const workspace = await logseq.App.getCurrentGraph().then(
    (info) => info?.name || ""
  );

  // logseq commands arent idempotent -.-
  const commandsRegistered = new Set<string>();
  const { unload: unloadSamePageClient } = setupSamePageClient({
    getSetting: (s) => (logseq.settings?.[s] as string) || "",
    setSetting: (s, v) => logseq.updateSettings({ [s]: v }),
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
  onAppEvent(
    "log",
    (evt) =>
      !IGNORED_LOGS.has(evt.id) &&
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
