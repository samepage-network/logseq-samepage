import { InitialSchema } from "samepage/internal/types";
import renderAtJson from "samepage/utils/renderAtJson";

const UUID_REGEX =
  /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/;

const atJsonToLogseq = (state: InitialSchema) => {
  return renderAtJson({
    state,
    applyAnnotation: {
      bold: ({ content, attributes }) => {
        const validDelimiters = new Set(["**", "__"]);
        const delimiter = attributes?.delimiter || "**";
        const prefix = validDelimiters.has(delimiter) ? delimiter : "**";
        return {
          prefix,
          suffix: attributes?.open ? "" : prefix,
          replace: content === String.fromCharCode(0),
        };
      },
      italics: ({ content, attributes }) => {
        const validDelimiters = new Set(["*", "_"]);
        const delimiter = attributes?.delimiter || "**";
        const prefix = validDelimiters.has(delimiter) ? delimiter : "**";
        return {
          prefix,
          suffix: attributes?.open ? "" : prefix,
          replace: content === String.fromCharCode(0),
        };
      },
      highlighting: ({ content }) => ({
        prefix: "^^",
        suffix: `^^`,
        replace: content === String.fromCharCode(0),
      }),
      strikethrough: ({ content }) => ({
        prefix: "~~",
        suffix: `~~`,
        replace: content === String.fromCharCode(0),
      }),
      link: ({ attributes: { href }, content }) => ({
        prefix: "[",
        suffix: `](${href})`,
        replace: content === String.fromCharCode(0),
      }),
      image: ({ attributes: { src }, content }) => ({
        prefix: "![",
        suffix: `](${src})`,
        replace: content === String.fromCharCode(0),
      }),
      reference: ({
        attributes: { notebookPageId, notebookUuid },
        content,
        appAttributes: { kind },
      }) => {
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
            suffix: `${replace ? "" : "]("}${
              kind === "hash-wikilink"
                ? `#[[${notebookPageId}]]`
                : kind === "hash"
                ? `#${notebookPageId}`
                : `[[${notebookPageId}]]`
            }${replace ? "" : ")"}`,
            replace,
          };
        }
        return {
          prefix: "",
          suffix: `{{renderer samepage-reference,${notebookUuid}:${notebookPageId}}}`,
          replace,
        };
      },
      code: ({ attributes: { language } }) => {
        return {
          prefix: `\`\`\`${language}\n`,
          suffix: "```",
        };
      },
    },
  });
};

export default atJsonToLogseq;
