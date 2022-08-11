import "@logseq/libs";
import "./index.css";
import { setupSamePageClient } from "@samepage/client";
import setupSharePageWithNotebook from "@samepage/client/protocols/sharePageWithNotebook";

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
  const unloadSamePageClient = setupSamePageClient({
    isAutoConnect: logseq.settings?.["auto-connect"] as boolean,
    app: 2,
    workspace,
    addCommand: ({ label, callback }) =>
      logseq.App.registerCommandPalette({ label, key: label }, callback),
  });
  const unloadSharePageWithGraph = setupSharePageWithNotebook({
    getUpdateLog: () => [
      // compare with input id
    ],
    render: ({ onSubmit }) => {},
  });

  logseq.beforeunload(async () => {
    unloadSharePageWithGraph();
    unloadSamePageClient();
  });
  // loadSharePageWithGraph();
  // ... loading other protocols go here ...
};

logseq.ready(main).catch(console.error);
