import { InitialSchema } from "samepage/internal/types";
import renderAtJson from "samepage/utils/renderAtJson";

const UUID_REGEX =
  /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/;

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
        if (notebookUuid === window.logseq.settings["uuid"]) {
          if (UUID_REGEX.test(notebookPageId)) {
            return {
              prefix: replace ? "" : "[",
              suffix: `${replace ? "" : "]("}((${notebookPageId}))${
                replace ? "" : ")"
              }`,
              replace,
            };
          }
          return {
            prefix: replace ? "" : "[",
            suffix: `${replace ? "" : "]("}[[${notebookPageId}]]${
              replace ? "" : ")"
            }`,
            replace,
          };
        }
        return {
          prefix: "",
          suffix: `{{renderer samepage-reference,${notebookUuid}:${notebookPageId}}}`,
          replace,
        };
      },
    },
  });
};

export default atJsonToLogseq;
