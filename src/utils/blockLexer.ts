import { Annotation, InitialSchema } from "samepage/internal/types";
import {
  compileLexer,
  DEFAULT_TOKENS,
  Processor,
  disambiguateTokens as rootDisambiguateTokens,
  createBoldToken as parentCreateBoldToken,
  createItalicsToken as parentCreateItalicsToken,
} from "samepage/utils/atJsonTokens";
import atJsonToLogseq from "./atJsonToLogseq";

const REGEXES = {
  attribute: { match: /\n?[a-z]+::[^\n]+/, lineBreaks: true },
  alias: /\[[^\]]*\]\([^\)]*\)/,
  asset: /!\[[^\]]*\]\([^\)]*\)/,
  url: DEFAULT_TOKENS.url,
  blockReference: /\(\([^)]*\)\)/,
  macro: /{{[^}]*}}/,
  hashtag: /#[a-zA-Z0-9_.-]+/,
  hash: /#/,
  codeBlock: {
    match: /```[\w ]*\n(?:[^`]|`(?!``)|``(?!`))*```/,
    lineBreaks: true,
  },
  newLine: { match: /\n/, lineBreaks: true },
  openUnder: { match: /_(?=[^_]+_(?!_))/, lineBreaks: true },
  openStar: { match: /\*(?=[^*]+\*(?!\*))/, lineBreaks: true },
  openDoubleUnder: { match: /__(?=(?:[^_]|_[^_])*__)/, lineBreaks: true },
  openDoubleStar: { match: /\*\*(?=(?:[^*]|\*[^*])*\*\*)/, lineBreaks: true },
  openDoubleTilde: { match: /~~(?=(?:[^~]|~[^~])*~~)/, lineBreaks: true },
  openDoubleCarot: { match: /\^\^(?=(?:[^^]|\^[^^])*\^\^)/, lineBreaks: true },
  text: {
    match: /(?:[^:^~_*#[\]!\n(){`]|:(?!:)|{(?!{[^}]*}})|`(?!``)|``(?!`))+/,
    lineBreaks: true,
  },
};

export const createBoldToken: Processor<InitialSchema> = (data, _, reject) => {
  const result = parentCreateBoldToken(data, _, reject);
  if (result === reject) return reject;
  const [bold] = (result as InitialSchema).annotations;
  bold.appAttributes = {
    logseq: {
      kind: (data as [moo.Token])[0].value,
    },
  };
  return result;
};

export const createItalicsToken: Processor<InitialSchema> = (
  data,
  _,
  reject
) => {
  const result = parentCreateItalicsToken(data, _, reject);
  if (result === reject) return reject;
  const [ital] = (result as InitialSchema).annotations;
  ital.appAttributes = {
    logseq: {
      kind: (data as [moo.Token])[0].value,
    },
  };
  return result;
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
  const [hash, , , token] = _data as [
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
        appAttributes: {
          logseq: {
            kind: hash ? "hash-wikilink" : "wikilink",
          },
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
        appAttributes: {
          logseq: {
            kind: "hash",
          },
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

export const createAliasToken: Processor<InitialSchema> = (data) => {
  const { value } = (data as [moo.Token])[0];
  const arr = /\[([^\]]*)\]\(([^\)]*)\)/.exec(value);
  if (!arr) {
    return {
      content: "",
      annotations: [],
    };
  }
  const [_, _content, href] = arr;
  const content = _content || String.fromCharCode(0);
  return {
    content,
    annotations: [
      {
        start: 0,
        end: content.length,
        type: "link",
        attributes: {
          href,
        },
      },
    ],
  };
};

export const createAssetToken: Processor<InitialSchema> = (data) => {
  const { value } = (data as [moo.Token])[0];
  const arr = /!\[([^\]]*)\]\(([^\)]*)\)/.exec(value);
  if (!arr) {
    return {
      content: "",
      annotations: [],
    };
  }
  const [_, _content, src] = arr;
  const content = _content || String.fromCharCode(0);
  return {
    content,
    annotations: [
      {
        start: 0,
        end: content.length,
        type: "image",
        attributes: {
          src,
        },
      },
    ],
  };
};

export const createCodeBlockToken: Processor<InitialSchema> = (data) => {
  const { value } = (data as [moo.Token])[0];
  const language = /^```([\w ]*)\n/.exec(value)?.[1]?.trim?.() || "";
  const content = value.replace(/^```[\w ]*\n/, "").replace(/```$/, "");
  return {
    content,
    annotations: [
      {
        start: 0,
        end: content.length,
        type: "code",
        attributes: {
          language,
        },
      },
    ],
  };
};

const lexer = compileLexer(REGEXES);

export default lexer;
