import "@logseq/libs";
import "./index.css";
import { setupSamePageClient } from "@samepage/client";
import { render as renderToast } from "./components/Toast";
import UsageChart from "./components/UsageChart";
import { notify } from "./components/NotificationContainer";
import { renderLoading } from "./components/Loading";
import setupSharePageWithNotebook, {
  notebookDbIds,
  STATUS_EVENT_NAME,
} from "./protocols/sharePageWithNotebook";
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
  let removeLoadingCallback: () => void;
  const { unload: unloadSamePageClient, apps } =
    await setupSamePageClient({
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
      onAppEventHandler: (evt) => {
        if (evt.type === "log") {
          renderToast({
            id: evt.id,
            content: evt.content,
            intent:
              evt.intent === "error"
                ? "danger"
                : evt.intent === "info"
                ? "primary"
                : evt.intent,
          });
        } else if (evt.type === "init-page") {
          const id = evt.notebookPageId;
          window.logseq.Editor.getBlock(id).then((block) => {
            if (block) {
              notebookDbIds.add(block.id);
              document.body.dispatchEvent(
                new CustomEvent(STATUS_EVENT_NAME, {
                  detail: evt.notebookPageId,
                })
              );
            }
          });
        } else if (evt.type === "share-page") {
          const app = apps.find((a) => a.id === evt.source.app)?.name;
          const args = {
            workspace: evt.source.workspace,
            app: `${evt.source.app}`,
            pageUuid: evt.pageUuid,
          };
          notify({
            title: "Share Page",
            description: `Notebook ${app}/${evt.source.workspace} is attempting to share page ${evt.notebookPageId}. Would you like to accept?`,
            actions: [
              {
                label: "accept",
                method: "accept",
                args,
              },
              {
                label: "reject",
                method: "reject",
                args,
              },
            ],
          });
        } else if (evt.type === "usage") {
          renderOverlay({ Overlay: UsageChart, props: evt });
        } else if (evt.type === "connection") {
          if (evt.status === "PENDING") removeLoadingCallback = renderLoading();
          else removeLoadingCallback?.();
        }
      },
    });
  const unloadSharePageWithNotebook = setupSharePageWithNotebook(apps);
  logseq.showMainUI();

  logseq.beforeunload(async () => {
    logseq.hideMainUI();
    unloadSharePageWithNotebook();
    unloadSamePageClient();
  });
};

logseq.ready(main).catch(console.error);
