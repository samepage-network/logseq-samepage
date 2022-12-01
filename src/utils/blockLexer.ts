import { Annotation, InitialSchema } from "samepage/internal/types";
import {
  compileLexer,
  DEFAULT_TOKENS,
  Processor,
  disambiguateTokens as rootDisambiguateTokens,
} from "samepage/utils/atJsonTokens";
import atJsonToLogseq from "./atJsonToLogseq";

const REGEXES = {
  attribute: { match: /\n?[a-z]+::[^\n]+/, lineBreaks: true },
  url: DEFAULT_TOKENS.url,
  blockReference: /\(\([^)]*\)\)/,
  macro: /{{[^}]*}}/,
  hashtag: /#[a-zA-Z0-9_.-]+/,
  hash: /#/,
  newLine: { match: /\n/, lineBreaks: true },
  openUnder: { match: /_(?=[^_]+_)/, lineBreaks: true },
  openStar: { match: /\*(?=[^*]+\*)/, lineBreaks: true },
  openDoubleUnder: { match: /__(?=(?:[^_]|_[^_])*__)/, lineBreaks: true },
  openDoubleStar: { match: /\*\*(?=(?:[^*]|\*[^*])*\*\*)/, lineBreaks: true },
  openDoubleTilde: { match: /~~(?=(?:[^~]|~[^~])*~~)/, lineBreaks: true },
  openDoubleCarot: { match: /\^\^(?=(?:[^^]|\^[^^])*\^\^)/, lineBreaks: true },
  text: {
    match: /(?:[^:^~_*#[\]!\n(){]|:(?!:)|{(?!{[^}]*}}))+/,
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

export const createWikilinkToken: Processor<InitialSchema> = (
  _data,
  _,
  reject
) => {
  const [, , , token] = _data as [
    moo.Token,
    moo.Token,
    moo.Token,
    InitialSchema,
    moo.Token,
    moo.Token
  ];
  const notebookPageId = atJsonToLogseq(token);
  const closing = notebookPageId.indexOf("]]");
  const opening = notebookPageId.indexOf("[[");
  if (closing >= 0 && (opening < 0 || closing < opening)) {
    return reject;
  }
  return {
    content: String.fromCharCode(0),
    annotations: [
      {
        type: "reference",
        start: 0,
        end: 1,
        attributes: {
          notebookPageId,
          notebookUuid: window.logseq.settings["uuid"],
        },
      } as Annotation,
    ],
  };
};

export const createHashtagToken: Processor<InitialSchema> = (_data) => {
  const [token] = _data as [moo.Token];
  return {
    content: String.fromCharCode(0),
    annotations: [
      {
        type: "reference",
        start: 0,
        end: 1,
        attributes: {
          notebookPageId: token.value.replace(/^#/, ""),
          notebookUuid: window.logseq.settings["uuid"],
        },
      } as Annotation,
    ],
  };
};

export const disambiguateTokens: Processor<InitialSchema> = (
  data,
  _,
  reject
) => {
  const [tokens] = data as [InitialSchema[]];
  const leftBracketIndices = tokens
    .map((token, index) => ({ token, index }))
    .filter(
      ({ token }) => token.content === "[" && token.annotations.length === 0
    );
  if (
    leftBracketIndices.some(({ index, token }) => {
      if (token.annotations.length === 0) {
        if (
          tokens[index + 1]?.content === "[" &&
          tokens[index + 3]?.content === "]" &&
          tokens[index + 4]?.content === "]"
        )
          return true;
      }
      return false;
    })
  ) {
    return reject;
  }
  return rootDisambiguateTokens(data, _, reject);
};

export const createNull: Processor<InitialSchema> = () => ({
  content: String.fromCharCode(0),
  annotations: [],
});

const lexer = compileLexer(REGEXES);

export default lexer;
