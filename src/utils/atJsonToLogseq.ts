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
      reference: ({ notebookPageId, notebookUuid }, content) => {
        const replace = content === String.fromCharCode(0);
        return notebookUuid === window.logseq.settings["uuid"]
          ? {
              prefix: replace ? "" : "[",
              suffix: `${replace ? "" : "]("}((${notebookPageId}))${
                replace ? "" : ")"
              }`,
              replace,
            }
          : {
              prefix: "",
              suffix: `{{renderer samepage-reference,${notebookUuid}:${notebookPageId}}}`,
              replace,
            };
      },
    },
  });
};

export default atJsonToLogseq;
