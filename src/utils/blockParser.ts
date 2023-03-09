import { Annotation, InitialSchema } from "samepage/internal/types";
import atJsonParser, {
  combineAtJsons,
  createEmptyAtJson,
  createTextAtJson,
  head,
  NULL_TOKEN,
  URL_REGEX,
} from "samepage/utils/atJsonParser";
import atJsonToLogseq from "./atJsonToLogseq";

type Rule = Parameters<typeof atJsonParser>[0]["grammarRules"][number];

const createTextRule = ({
  type,
  ruleName,
}: {
  type: string;
  ruleName: string;
}): Rule => ({
  name: ruleName,
  symbols: [{ type }],
  postprocess: createTextAtJson,
});

const baseRules: Rule[] = [
  { name: "main", symbols: [], postprocess: createEmptyAtJson },
  { name: "main", symbols: ["blockElements"], postprocess: head },
  { name: "blockElements", symbols: ["blockElement"], postprocess: head },
  {
    name: "blockElements",
    symbols: ["blockElement", "blockElements"],
    postprocess: combineAtJsons,
  },
  {
    name: "blockElements",
    symbols: ["blockElements", "lastElement"],
    postprocess: combineAtJsons,
  },
  {
    name: "blockElement",
    symbols: [
      { type: "openDoubleCarot" },
      "highlightExpression",
      "highlightBoundary",
    ],
    postprocess: (data) => {
      const [token, first] = data as [moo.Token, InitialSchema, InitialSchema];
      const highlight: InitialSchema = {
        content: first.content,
        annotations: (
          [
            {
              type: "highlighting",
              start: 0,
              end: first.content.length,
              attributes: {
                delimiter: token.value,
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(first.annotations),
      };
      return highlight;
    },
    preprocess: (ctx, dot, reject) => {
      if (dot === 1 && ctx.flags.has("doubleCarot")) return reject;
      else if (dot === 1) {
        const flags = new Set(ctx.flags);
        flags.add("doubleCarot");
        return { ...ctx, flags };
      } else if (dot === 3) {
        const flags = new Set(ctx.flags);
        flags.delete("doubleCarot");
        return { ...ctx, flags };
      }
      return ctx;
    },
  },
  {
    name: "highlightExpression",
    symbols: ["blockElements"],
    postprocess: head,
  },
  {
    name: "highlightExpression",
    symbols: [],
    postprocess: () => ({ content: NULL_TOKEN, annotations: [] }),
  },
  {
    name: "highlightBoundary",
    symbols: [{ type: "highlight" }],
    postprocess: createEmptyAtJson,
  },
  {
    name: "highlightBoundary",
    symbols: [{ type: "openDoubleCarot" }],
    postprocess: createEmptyAtJson,
  },
  {
    name: "blockElement",
    symbols: [
      { type: "openDoubleTilde" },
      "strikeExpression",
      "strikeBoundary",
    ],
    postprocess: (data) => {
      const [token, first] = data as [moo.Token, InitialSchema, InitialSchema];
      return {
        content: first.content,
        annotations: (
          [
            {
              type: "strikethrough",
              start: 0,
              end: first.content.length,
              attributes: {
                delimiter: token.value,
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(first.annotations),
      };
    },
    preprocess: (ctx, dot, reject) => {
      if (dot === 1 && ctx.flags.has("strike")) return reject;
      else if (dot === 1) {
        const flags = new Set(ctx.flags);
        flags.add("strike");
        return { ...ctx, flags };
      } else if (dot === 3) {
        const flags = new Set(ctx.flags);
        flags.delete("strike");
        return { ...ctx, flags };
      }
    },
  },
  {
    name: "strikeExpression",
    symbols: ["blockElements"],
    postprocess: head,
  },
  {
    name: "strikeExpression",
    symbols: [],
    postprocess: () => ({ content: NULL_TOKEN, annotations: [] }),
  },
  {
    name: "strikeBoundary",
    symbols: [{ type: "strike" }],
    postprocess: createEmptyAtJson,
  },
  {
    name: "strikeBoundary",
    symbols: [{ type: "openDoubleTilde" }],
    postprocess: createEmptyAtJson,
  },

  {
    name: "blockElement",
    symbols: [
      { type: "openDoubleUnder" },
      "doubleUnderExpression",
      "doubleUnderBoundary",
    ],
    postprocess: (data) => {
      const [_, first] = data as [moo.Token, InitialSchema, InitialSchema];
      return {
        content: first.content,
        annotations: (
          [
            {
              type: "bold",
              start: 0,
              end: first.content.length,
              attributes: {
                delimiter: "__",
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(first.annotations),
      };
    },

    preprocess: (ctx, dot, reject) => {
      if (dot === 1 && ctx.flags.has("doubleUnder")) return reject;
      else if (dot === 1) {
        const flags = new Set(ctx.flags);
        flags.add("doubleUnder");
        return { ...ctx, flags };
      } else if (dot === 3) {
        const flags = new Set(ctx.flags);
        flags.delete("doubleUnder");
        return { ...ctx, flags };
      }
    },
  },
  {
    name: "doubleUnderExpression",
    symbols: ["blockElements"],
    postprocess: head,
  },
  {
    name: "doubleUnderExpression",
    symbols: [],
    postprocess: () => ({ content: NULL_TOKEN, annotations: [] }),
  },
  {
    name: "doubleUnderBoundary",
    symbols: [{ type: "boldUnder" }],
    postprocess: createEmptyAtJson,
  },
  {
    name: "doubleUnderBoundary",
    symbols: [{ type: "openDoubleUnder" }],
    postprocess: createEmptyAtJson,
  },
  {
    name: "blockElement",
    symbols: [
      { type: "openDoubleStar" },
      "doubleStarExpression",
      "doubleStarBoundary",
    ],
    postprocess: (data) => {
      const [token, first] = data as [moo.Token, InitialSchema, InitialSchema];
      return {
        content: first.content,
        annotations: (
          [
            {
              type: "bold",
              start: 0,
              end: first.content.length,
              attributes: {
                delimiter: token.value,
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(first.annotations),
      };
    },
    preprocess: (ctx, dot, reject) => {
      if (dot === 1 && ctx.flags.has("doubleStar")) return reject;
      else if (dot === 1) {
        const flags = new Set(ctx.flags);
        flags.add("doubleStar");
        return { ...ctx, flags };
      } else if (dot === 3) {
        const flags = new Set(ctx.flags);
        flags.delete("doubleStar");
        return { ...ctx, flags };
      }
    },
  },
  {
    name: "doubleStarExpression",
    symbols: ["blockElements"],
    postprocess: head,
  },
  {
    name: "doubleStarExpression",
    symbols: [],
    postprocess: () => ({ content: NULL_TOKEN, annotations: [] }),
  },
  {
    name: "doubleStarBoundary",
    symbols: [{ type: "boldStar" }],
    postprocess: createEmptyAtJson,
  },
  {
    name: "doubleStarBoundary",
    symbols: [{ type: "openDoubleStar" }],
    postprocess: createEmptyAtJson,
  },

  {
    name: "blockElement",
    symbols: [{ type: "openUnder" }, "blockElements", "singleUnderBoundary"],
    postprocess: (data) => {
      const [_, first] = data as [moo.Token, InitialSchema, InitialSchema];
      return {
        content: first.content,
        annotations: (
          [
            {
              type: "italics",
              start: 0,
              end: first.content.length,
              attributes: {
                delimiter: "_",
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(first.annotations),
      };
    },
    preprocess: (ctx, dot, reject) => {
      if (dot === 1 && ctx.flags.has("singleUnder")) return reject;
      else if (dot === 1) {
        const flags = new Set(ctx.flags);
        flags.add("singleUnder");
        return { ...ctx, flags };
      } else if (dot === 3) {
        const flags = new Set(ctx.flags);
        flags.delete("singleUnder");
        return { ...ctx, flags };
      }
    },
  },
  {
    name: "singleUnderBoundary",
    symbols: [{ type: "under" }],
    postprocess: createEmptyAtJson,
  },
  {
    name: "singleUnderBoundary",
    symbols: [{ type: "openUnder" }],
    postprocess: createEmptyAtJson,
  },

  {
    name: "blockElement",
    symbols: [{ type: "openStar" }, "blockElements", "singleStarBoundary"],
    postprocess: (data) => {
      const [_, first] = data as [moo.Token, InitialSchema, InitialSchema];
      return {
        content: first.content,
        annotations: (
          [
            {
              type: "italics",
              start: 0,
              end: first.content.length,
              attributes: {
                delimiter: "*",
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(first.annotations),
      };
    },
  },
  {
    name: "singleStarBoundary",
    symbols: [{ type: "star" }],
    postprocess: createEmptyAtJson,
  },
  {
    name: "singleStarBoundary",
    symbols: [{ type: "openStar" }],
    postprocess: createEmptyAtJson,
  },
  {
    name: "blockElement",
    symbols: [{ type: "asset" }],
    postprocess: (data) => {
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
    },
  },
  {
    name: "blockElement",
    symbols: [{ type: "blockReference" }],
    postprocess: (data) => {
      const [token] = data as [moo.Token];
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
    },
  },
  {
    name: "blockElement",
    symbols: [
      { type: "hashDoubleLeftBracket" },
      "noDoubleRightBrackets",
      { type: "doubleRightBracket" },
    ],
    postprocess: (data, _, reject) => {
      const [ , token] = data as [
        moo.Token,
        InitialSchema,
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
                kind: "hash-wikilink",
              },
            },
          } as Annotation,
        ],
      };
    },
  },
  {
    name: "blockElement",
    symbols: [
      { type: "doubleLeftBracket" },
      "noDoubleRightBrackets",
      { type: "doubleRightBracket" },
    ],
    postprocess: (data, _, reject) => {
      const [, token] = data as [moo.Token, InitialSchema, moo.Token];
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
                kind: "wikilink",
              },
            },
          } as Annotation,
        ],
      };
    },
  },
  {
    name: "blockElement",
    symbols: [{ type: "hashtag" }],
    postprocess: (data) => {
      const [token] = data as [moo.Token];
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
    },
  },
  {
    name: "blockElement",
    symbols: [{ type: "macro" }],
    postprocess: (data) => {
      const [token] = data as [moo.Token];
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
    },
  },
  {
    name: "blockElement",
    symbols: [{ type: "alias" }],
    postprocess: (data) => {
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
    },
  },
  {
    name: "blockElement",
    symbols: [{ type: "codeBlock" }],
    postprocess: (data) => {
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
    },
  },
  {
    name: "blockElement",
    symbols: [{ type: "attribute" }],
    postprocess: createEmptyAtJson,
  },
  {
    name: "lastElement",
    symbols: [{ type: "doubleLeftBracket" }],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElements",
    symbols: [{ type: "doubleLeftBracket" }, "noDoubleRightBrackets"],
    postprocess: (data) => {
      const [, json] = data as [moo.Token, InitialSchema];
      return combineAtJsons([{ content: "[[", annotations: [] }, json]);
    },
  },
  {
    name: "noDoubleRightBrackets",
    symbols: ["noDoubleRightBracket", "noDoubleRightBrackets"],
    postprocess: combineAtJsons,
  },
  {
    name: "noDoubleRightBrackets",
    symbols: ["noDoubleRightBracket"],
    postprocess: head,
  },
  {
    name: "blockElement",
    symbols: [{ type: "doubleRightBracket" }],
    postprocess: createTextAtJson,
  },
  ...[
    "text",
    "star",
    "carot",
    "tilde",
    "under",
    "hash",
    "boldUnder",
    "boldStar",
    "highlight",
    "strike",
    "leftParen",
    "leftBracket",
    "rightParen",
    "rightBracket",
    "newLine",
    "exclamationMark",
  ].map((type) => createTextRule({ ruleName: "blockElement", type })),
];

const noDoubleRightBracketRules = baseRules
  .filter((b) => {
    const [symbol] = b.symbols;
    return (
      b.name === "blockElement" &&
      typeof symbol === "object" &&
      symbol.type !== "doubleRightBracket"
    );
  })
  .map((r) => ({ ...r, name: "noDoubleRightBracket" }));
const grammarRules: Rule[] = baseRules.concat(noDoubleRightBracketRules);

const blockParser = atJsonParser({
  lexerRules: {
    attribute: { match: /\n?[a-z]+::[^\n]+/, lineBreaks: true },
    alias: /\[[^\]]*\]\([^\)]*\)/,
    asset: /!\[[^\]]*\]\([^\)]*\)/,
    url: URL_REGEX,
    blockReference: /\(\([^)]*\)\)/,
    macro: /{{[^}]*}}/,
    hashtag: /#[a-zA-Z0-9_.-]+/,
    hashDoubleLeftBracket: "#[[",
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
    openDoubleCarot: {
      match: /\^\^(?=(?:[^^]|\^[^^])*\^\^)/,
      lineBreaks: true,
    },
    text: {
      match: /(?:[^:^~_*#[\]!\n(){`]|:(?!:)|{(?!{[^}]*}})|`(?!``)|``(?!`))+/,
      lineBreaks: true,
    },
    highlight: "^^",
    strike: "~~",
    boldUnder: "__",
    boldStar: "**",
    under: "_",
    star: "*",
    tilde: "~",
    carot: "^",
    doubleLeftBracket: "[[",
    doubleRightBracket: "]]",
    leftBracket: "[",
    leftParen: "(",
    rightBracket: "]",
    rightParen: ")",
    exclamationMark: "!",
  },
  grammarRules,
});

export default blockParser;
