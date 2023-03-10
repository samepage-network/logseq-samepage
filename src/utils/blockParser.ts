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
    postprocess: (data, _, reject) => {
      const [first, second] = data as [InitialSchema, InitialSchema];
      if (
        second.content.indexOf("]]") > -1 &&
        first.annotations.some(
          (a) =>
            a.type === "reference" &&
            a.attributes.notebookPageId.includes("[[") &&
            !a.attributes.notebookPageId.includes("]]")
        )
      )
        return reject;
      return combineAtJsons([first, second]);
    },
  },
  {
    name: "main",
    symbols: ["blockElements", "lastElement"],
    postprocess: combineAtJsons,
  },
  {
    name: "main",
    symbols: ["lastElement"],
    postprocess: head,
  },

  {
    name: "blockElement",
    symbols: [
      { type: "highlight" },
      "highlightExpression",
      { type: "highlight" },
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
  },
  {
    name: "highlightExpression",
    symbols: ["noDoubleCarots"],
    postprocess: head,
  },
  {
    name: "highlightExpression",
    symbols: [],
    postprocess: () => ({ content: NULL_TOKEN, annotations: [] }),
  },
  {
    name: "noDoubleCarots",
    symbols: ["noDoubleCarot", "noDoubleCarots"],
    postprocess: combineAtJsons,
  },
  {
    name: "noDoubleCarots",
    symbols: ["noDoubleCarot"],
    postprocess: head,
  },
  {
    name: "lastElement",
    symbols: [{ type: "highlight" }, "noDoubleCarots"],
    postprocess: (data) => {
      const [, json] = data as [moo.Token, InitialSchema];
      return combineAtJsons([{ content: "^^", annotations: [] }, json]);
    },
  },
  {
    name: "lastElement",
    symbols: [{ type: "highlight" }],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElement",
    symbols: [{ type: "strike" }, "strikeExpression", { type: "strike" }],
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
  },
  {
    name: "strikeExpression",
    symbols: ["noDoubleTildes"],
    postprocess: head,
  },
  {
    name: "strikeExpression",
    symbols: [],
    postprocess: () => ({ content: NULL_TOKEN, annotations: [] }),
  },
  {
    name: "noDoubleTildes",
    symbols: ["noDoubleTilde", "noDoubleTildes"],
    postprocess: combineAtJsons,
  },
  {
    name: "noDoubleTildes",
    symbols: ["noDoubleTilde"],
    postprocess: head,
  },
  {
    name: "lastElement",
    symbols: [{ type: "strike" }, "noDoubleTildes"],
    postprocess: (data) => {
      const [, json] = data as [moo.Token, InitialSchema];
      return combineAtJsons([{ content: "~~", annotations: [] }, json]);
    },
  },
  {
    name: "lastElement",
    symbols: [{ type: "strike" }],
    postprocess: createTextAtJson,
  },

  {
    name: "blockElement",
    symbols: [
      { type: "doubleUnder" },
      "doubleUnderExpression",
      { type: "doubleUnder" },
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
  },
  {
    name: "doubleUnderExpression",
    symbols: ["noDoubleUnders"],
    postprocess: head,
  },
  {
    name: "doubleUnderExpression",
    symbols: [],
    postprocess: () => ({ content: NULL_TOKEN, annotations: [] }),
  },
  {
    name: "noDoubleUnders",
    symbols: ["noDoubleUnder", "noDoubleUnders"],
    postprocess: combineAtJsons,
  },
  {
    name: "noDoubleUnders",
    symbols: ["noDoubleUnder"],
    postprocess: head,
  },
  {
    name: "lastElement",
    symbols: [{ type: "doubleUnder" }, "noDoubleUnders"],
    postprocess: (data) => {
      const [, json] = data as [moo.Token, InitialSchema];
      return combineAtJsons([{ content: "__", annotations: [] }, json]);
    },
  },
  {
    name: "lastElement",
    symbols: [{ type: "doubleUnder" }],
    postprocess: createTextAtJson,
  },

  {
    name: "blockElement",
    symbols: [
      { type: "doubleStar" },
      "doubleStarExpression",
      { type: "doubleStar" },
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
  },
  {
    name: "doubleStarExpression",
    symbols: ["noDoubleStars"],
    postprocess: head,
  },
  {
    name: "doubleStarExpression",
    symbols: [],
    postprocess: () => ({ content: NULL_TOKEN, annotations: [] }),
  },
  {
    name: "noDoubleStars",
    symbols: ["noDoubleStar", "noDoubleStars"],
    postprocess: combineAtJsons,
  },
  {
    name: "noDoubleStars",
    symbols: ["noDoubleStar"],
    postprocess: head,
  },
  {
    name: "lastElement",
    symbols: [{ type: "doubleStar" }, "noDoubleStars"],
    postprocess: (data) => {
      const [, json] = data as [moo.Token, InitialSchema];
      return combineAtJsons([{ content: "**", annotations: [] }, json]);
    },
  },
  {
    name: "lastElement",
    symbols: [{ type: "strike" }],
    postprocess: createTextAtJson,
  },

  {
    name: "blockElement",
    symbols: [
      { type: "openItalUnder" },
      "noCloseItalUnders",
      { type: "closeItalUnder" },
    ],
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
  },
  {
    name: "lastElement",
    symbols: [{ type: "openItalUnder" }],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElements",
    symbols: [{ type: "openItalUnder" }, "noCloseItalUnders"],
    postprocess: (data) => {
      const [, json] = data as [moo.Token, InitialSchema];
      return combineAtJsons([{ content: "_", annotations: [] }, json]);
    },
  },
  {
    name: "noCloseItalUnders",
    symbols: ["noCloseItalUnder", "noCloseItalUnders"],
    postprocess: combineAtJsons,
  },
  {
    name: "noCloseItalUnders",
    symbols: ["noCloseItalUnder"],
    postprocess: head,
  },
  {
    name: "blockElement",
    symbols: [{ type: "closeItalUnder" }],
    postprocess: createTextAtJson,
  },

  {
    name: "blockElement",
    symbols: [
      { type: "openItalStar" },
      "noCloseItalStars",
      { type: "closeItalStar" },
    ],
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
    name: "lastElement",
    symbols: [{ type: "openItalStar" }],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElements",
    symbols: [{ type: "openItalStar" }, "noCloseItalStars"],
    postprocess: (data) => {
      const [, json] = data as [moo.Token, InitialSchema];
      return combineAtJsons([{ content: "*", annotations: [] }, json]);
    },
  },
  {
    name: "noCloseItalStars",
    symbols: ["noCloseItalStar", "noCloseItalStars"],
    postprocess: combineAtJsons,
  },
  {
    name: "noCloseItalStars",
    symbols: ["noCloseItalStar"],
    postprocess: head,
  },
  {
    name: "blockElement",
    symbols: [{ type: "closeItalStar" }],
    postprocess: createTextAtJson,
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
  ...[
    "text",
    "star",
    "carot",
    "tilde",
    "under",
    "hash",
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
      (b.name === "blockElement" || b.name === "lastElement") &&
      typeof symbol === "object" &&
      symbol.type !== "doubleRightBracket"
    );
  })
  .map((r) => ({ ...r, name: "noDoubleRightBracket" }));
const noCloseItalUnderRules = baseRules
  .filter((b) => {
    const [symbol] = b.symbols;
    return (
      (b.name === "blockElement" || b.name === "lastElement") &&
      typeof symbol === "object" &&
      symbol.type !== "closeItalUnder" &&
      symbol.type !== "openItalUnder"
    );
  })
  .map((r) => ({ ...r, name: "noCloseItalUnder" }));
const noCloseItalStarRules = baseRules
  .filter((b) => {
    const [symbol] = b.symbols;
    return (
      (b.name === "blockElement" || b.name === "lastElement") &&
      typeof symbol === "object" &&
      symbol.type !== "closeItalStar"
    );
  })
  .map((r) => ({ ...r, name: "noCloseItalStar" }));
const noDoubleCarotRules = baseRules
  .filter((b) => {
    const [symbol] = b.symbols;
    return (
      (b.name === "blockElement" || b.name === "lastElement") &&
      typeof symbol === "object" &&
      symbol.type !== "highlight"
    );
  })
  .map((r) => ({ ...r, name: "noDoubleCarot" }));
const noDoubleTildeRules = baseRules
  .filter((b) => {
    const [symbol] = b.symbols;
    return (
      (b.name === "blockElement" || b.name === "lastElement") &&
      typeof symbol === "object" &&
      symbol.type !== "strike"
    );
  })
  .map((r) => ({ ...r, name: "noDoubleTilde" }));
const noDoubleUnderRules = baseRules
  .filter((b) => {
    const [symbol] = b.symbols;
    return (
      (b.name === "blockElement" || b.name === "lastElement") &&
      typeof symbol === "object" &&
      symbol.type !== "doubleUnder"
    );
  })
  .map((r) => ({ ...r, name: "noDoubleUnder" }));
const noDoubleStarRules = baseRules
  .filter((b) => {
    const [symbol] = b.symbols;
    return (
      (b.name === "blockElement" || b.name === "lastElement") &&
      typeof symbol === "object" &&
      symbol.type !== "doubleStar"
    );
  })
  .map((r) => ({ ...r, name: "noDoubleStar" }));
const grammarRules: Rule[] = baseRules
  .concat(noDoubleCarotRules)
  .concat(noDoubleTildeRules)
  .concat(noDoubleUnderRules)
  .concat(noDoubleStarRules)
  .concat(noCloseItalUnderRules)
  .concat(noCloseItalStarRules)
  .concat(noDoubleRightBracketRules);

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
    doubleUnder: "__",
    doubleStar: "**",
    closeItalUnder: { match: /(?<!\s)_(?=[\s])/, lineBreaks: true },
    openItalUnder: { match: /(?<=\s)_(?!\s)/, lineBreaks: true },
    closeItalStar: { match: /(?<!\s)\*(?=\s)/, lineBreaks: true },
    openItalStar: { match: /(?<=\s)\*(?!\s)/, lineBreaks: true },
    text: {
      match: /(?:[^:^~_*#[\]!\n(){`]|:(?!:)|{(?!{[^}]*}})|`(?!``)|``(?!`))+/,
      lineBreaks: true,
    },
    highlight: "^^",
    strike: "~~",
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
