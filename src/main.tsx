import "@logseq/libs";
import setupSamePageClient from "./components/setupSamePageClient";
import "./index.css";
// import { render } from "./components/NotificationContainer";
// import loadSharePageWithGraph from "./messages/sharePageWithGraph";

const main = () => {
  logseq.useSettingsSchema([
    {
      key: "shared-pages",
      type: "object",
      title: "Shared Pages",
      description: "View all of the shared with other notebooks.",
      default: {},
    },
    {
      key: "auto-connect",
      type: "boolean",
      title: "Auto Connect",
      description: "Automatically connect to SamePage Network",
      default: false,
    },
    {
      key: "usage",
      type: "object",
      title: "Usage",
      description:
        "Displays how much the user has used the SamePage network this month. Price is not actually charged, but to inform what might be used in the future.",
      default: {},
    },
  ]);

  /*const api = */setupSamePageClient(
    () => logseq.settings?.["auto-connect"]
  );
  // render(api);
  // loadSharePageWithGraph(api);
  // window.samepage = api;
  console.log("samepage ready!", logseq.settings);
};

logseq.ready(main).catch(console.error);
