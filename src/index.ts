import "@logseq/libs";
import setupSamePageClient from "samepage/protocols/setupSamePageClient";
import defaultSettings from "samepage/utils/defaultSettings";
import setupSharePageWithNotebook from "./protocols/sharePageWithNotebook";
import setupNotebookQuerying from "./protocols/notebookQuerying";
import renderOverlay from "./components/renderOverlay";
import type { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin";

const setupUserSettings = () => {
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
};

const setupClient = async () => {
  fetch("index.css")
    .then((r) => r.text())
    .then((style) => logseq.provideStyle(style));
  const workspace = await logseq.App.getCurrentGraph().then(
    (info) => info?.name || ""
  );

  // logseq commands arent idempotent -.-
  const commandsRegistered = new Set<string>();
  const { unload } = setupSamePageClient({
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
    onAppLog: (evt) =>
      evt.intent !== "debug" &&
      window.logseq.UI.showMsg(
        evt.content,
        evt.intent === "info" ? "success" : evt.intent,
        { timeout: 5000 }
      ),
    notificationContainerPath: `.cp__header .r.flex::before(0)`,
  });
  return unload;
};

const setupProtocols = () => {
  const unloadSharePageWithNotebook = setupSharePageWithNotebook();
  const unloadNotebookQuerying = setupNotebookQuerying();
  return () => {
    unloadNotebookQuerying();
    unloadSharePageWithNotebook();
  };
};

const main = async () => {
  setupUserSettings();
  const unloadSamePageClient = await setupClient();
  const unloadProtocols = setupProtocols();

  logseq.beforeunload(async () => {
    Array.from(
      window.parent.document.head.querySelectorAll(`style[data-ref=samepage]`)
    ).forEach((s) => s.remove());
    unloadProtocols();
    unloadSamePageClient();
  });
};

logseq.ready(main).catch(console.error);
