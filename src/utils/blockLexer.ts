import { Annotation, InitialSchema } from "samepage/internal/types";
import {
  compileLexer,
  DEFAULT_TOKENS,
  Processor,
} from "samepage/utils/atJsonTokens";

const REGEXES = {
  attribute: { match: /\n?[a-z]+::[^\n]+/, lineBreaks: true },
  url: DEFAULT_TOKENS.url,
  blockReference: /\(\([^)]*\)\)/,
  macro: /{{[^}]*}}/,
  newLine: { match: /\n/, lineBreaks: true },
  text: {
    match: /(?:[^:^~_*[\]!\n(){]|:(?!:)|{(?!{[^}]*}}))+/,
    lineBreaks: true,
  },
};

export const createReferenceToken: Processor<InitialSchema> = (_data) => {
  const [token] = _data as [moo.Token];
  const notebookPageId = token.value.slice(2, -2);
  return {
    content: String.fromCharCode(0),
    annotations: [
      {
        type: "reference",
        start: 0,
        end: 1,
        attributes: {
          notebookPageId,
          notebookUuid: window.logseq.settings.uuid,
        },
      } as Annotation,
    ],
  };
};

export const parseMacroToken: Processor<InitialSchema> = (_data) => {
  const [token] = _data as [moo.Token];
  const macro = token.value.match(/{{([^}]*)}}/)?.[1] || "";
  const [_, macroName, macroArgs] = macro.match(/^([^\s]+)\s*(.*)$/) || [];
  if (macroName === "renderer") {
    const parts = macroArgs.split(",");
    if (parts[0] === "samepage-reference") {
      const [notebookUuid, notebookPageId] = parts
        .slice(1)
        .join(",")
        .split(":");
      return {
        content: String.fromCharCode(0),
        annotations: [
          {
            type: "reference",
            start: 0,
            end: 1,
            attributes: {
              notebookPageId,
              notebookUuid,
            },
          } as Annotation,
        ],
      };
    }
  }
  return {
    content: token.text,
    annotations: [],
  };
};

const lexer = compileLexer(REGEXES);

export default lexer;
