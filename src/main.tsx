import "@logseq/libs";
import "./index.css";
import { setupSamePageClient } from "@samepage/client";
import setupSharePageWithNotebook from "@samepage/client/protocols/sharePageWithNotebook";
import { render } from "./components/SharePageDialog";

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
  const commandsRegistered = new Set<string>(); // logseq isnt idempotent -.-
  const unloadSamePageClient = setupSamePageClient({
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
      console.log(
        `Could not unregister the ${label} command. Does LogSeq support it?`
      );
    },
    onAppEventHandler: (event) => {
      console.log("App Event", event);
    },
    onUsageEventHandler: (event) => {
      console.log("App Event", event);
    },
  });
  const unloadSharePageWithGraph = setupSharePageWithNotebook({
    getUpdateLog: () => [
      // compare with input id
    ],
    render: async ({ onSubmit }) => {
      const notebookPageId = await logseq.Editor.getCurrentPage().then(
        (p) => p?.id.toString() || ""
      );
      render({ onSubmit, notebookPageId });
    },
  });
  // ... loading other protocols go here ...

  logseq.beforeunload(async () => {
    unloadSharePageWithGraph();
    unloadSamePageClient();
  });
  console.log("samepage ready!");
};

logseq.ready(main).catch(console.error);
