import { InitialSchema } from "samepage/internal/types";
import renderAtJson from "samepage/utils/renderAtJson";

const atJsonToLogseq = (state: InitialSchema) => {
  return renderAtJson({
    state,
    applyAnnotation: {
      bold: {
        prefix: "**",
        suffix: `**`,
      },
      highlighting: {
        prefix: "^^",
        suffix: `^^`,
      },
      italics: {
        prefix: "_",
        suffix: `_`,
      },
      strikethrough: {
        prefix: "~~",
        suffix: `~~`,
      },
      link: ({ href }) => ({
        prefix: "[",
        suffix: `](${href})`,
      }),
      image: ({ src }, content) => ({
        prefix: "![",
        suffix: `](${src})`,
        replace: content === String.fromCharCode(0),
      }),
      reference: ({ notebookPageId, notebookUuid }, content) => ({
        prefix: "((",
        suffix: `${
          notebookUuid === window.logseq.settings["uuid"]
            ? notebookPageId
            : `${notebookUuid}:${notebookPageId}`
        }))`,
        replace: content === String.fromCharCode(0),
      }),
    },
  });
};

export default atJsonToLogseq;
