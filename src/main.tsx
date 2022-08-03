import "@logseq/libs";
import "./index.css";

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
  console.log("samepage ready!");
};

logseq.ready(main).catch(console.error);
