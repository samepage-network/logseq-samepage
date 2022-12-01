import { InitialSchema } from "samepage/internal/types";
import renderAtJson from "samepage/utils/renderAtJson";

const UUID_REGEX =
  /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/;

const atJsonToLogseq = (state: InitialSchema) => {
  return renderAtJson({
    state,
    applyAnnotation: {
      bold: (_, content) => ({
        prefix: "**",
        suffix: `**`,
        replace: content === String.fromCharCode(0),
      }),
      highlighting: (_, content) => ({
        prefix: "^^",
        suffix: `^^`,
        replace: content === String.fromCharCode(0),
      }),
      italics: (_, content) => ({
        prefix: "_",
        suffix: `_`,
        replace: content === String.fromCharCode(0),
      }),
      strikethrough: (_, content) => ({
        prefix: "~~",
        suffix: `~~`,
        replace: content === String.fromCharCode(0),
      }),
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
