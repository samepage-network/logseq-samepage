// TODO make this test friendly - https://github.com/microsoft/playwright/issues/17852
import blockGrammar from "../src/utils/blockGrammar";
import type { InitialSchema } from "samepage/internal/types";
import atJsonParser from "samepage/utils/atJsonParser";
import { test, expect } from "@playwright/test";
import { v4 } from "uuid";
import lexer from "../src/utils/blockLexer";
import atJsonToLogseq from "../src/utils/atJsonToLogseq";
import registry from "samepage/internal/registry";

const notebookUuid = v4();
// @ts-ignore
global.localStorage = {
  getItem: () => JSON.stringify({ uuid: notebookUuid }),
};
global.window = {
  // @ts-ignore
  logseq: {
    settings: {
      uuid: notebookUuid,
    },
  },
};

const runTest =
  (
    md: string,
    expected: InitialSchema,
    opts: { debug?: true; skipInverse?: true } = {}
  ) =>
  () => {
    if (opts.debug) {
      const buffer = lexer.reset(md);
      let token = buffer.next();
      while (token) {
        console.log(token);
        token = buffer.next();
      }
    }
    const output = atJsonParser(blockGrammar, md);
    expect(output).toBeTruthy();
    expect(output.content).toEqual(expected.content);
    expected.annotations.forEach((e, i) => {
      expect(output.annotations[i]).toEqual(e);
    });
    expect(output.annotations[expected.annotations.length]).toBeUndefined();
    expect(expected.annotations[output.annotations.length]).toBeUndefined();
    if (!opts.skipInverse) expect(atJsonToLogseq(output)).toEqual(md);
  };

test.beforeAll(() => {
  registry({ app: 2 });
});

test(
  "Highlighted Text",
  runTest("A ^^highlighted^^ text", {
    content: "A highlighted text",
    annotations: [{ type: "highlighting", start: 2, end: 13 }],
  })
);

test(
  "Strikethrough Text",
  runTest("A ~~strikethrough~~ text", {
    content: "A strikethrough text",
    annotations: [{ type: "strikethrough", start: 2, end: 15 }],
  })
);

test(
  "Italics text (underscore)",
  runTest("A _italics_ text", {
    content: "A italics text",
    annotations: [
      {
        type: "italics",
        start: 2,
        end: 9,
        appAttributes: { logseq: { kind: "_" } },
      },
    ],
  })
);

test(
  "Italics text (asterisk)",
  runTest("A *italics* text", {
    content: "A italics text",
    annotations: [
      {
        type: "italics",
        start: 2,
        end: 9,
        appAttributes: { logseq: { kind: "*" } },
      },
    ],
  })
);

test(
  "Bold text (underscore)",
  runTest("A __bold__ text", {
    content: "A bold text",
    annotations: [
      {
        type: "bold",
        start: 2,
        end: 6,
        appAttributes: { logseq: { kind: "__" } },
      },
    ],
  })
);

test(
  "Bold text (asterisk)",
  runTest("A **bold** text", {
    content: "A bold text",
    annotations: [
      {
        type: "bold",
        start: 2,
        end: 6,
        appAttributes: { logseq: { kind: "**" } },
      },
    ],
  })
);

test(
  "Support single characters as text",
  runTest("A *, some ^, one ~, and going down _.", {
    content: "A *, some ^, one ~, and going down _.",
    annotations: [],
  })
);

test(
  "External links",
  runTest("A [linked](https://samepage.network) text", {
    content: "A linked text",
    annotations: [
      {
        type: "link",
        start: 2,
        end: 8,
        attributes: { href: "https://samepage.network" },
      },
    ],
  })
);

test(
  "Ignore attributes",
  runTest(
    "Some content\nid:: 12345678-abdf-1234-5678-abcdef123456",
    {
      content: "Some content",
      annotations: [],
    },
    { skipInverse: true }
  )
);

test(
  "Only attribute",
  runTest(
    "id:: 12345678-abdf-1234-5678-abcdef123456",
    {
      content: "",
      annotations: [],
    },
    { skipInverse: true }
  )
);

test(
  "Aliasless link",
  runTest("A [](https://samepage.network) text", {
    content: "A [](https://samepage.network) text",
    annotations: [],
  })
);

test(
  "Just a link",
  runTest("Just a link: https://samepage.network", {
    content: "Just a link: https://samepage.network",
    annotations: [],
  })
);

test(
  "Image with alias",
  runTest("![alias](https://samepage.network/images/logo.png)", {
    content: "alias",
    annotations: [
      {
        type: "image",
        start: 0,
        end: 5,
        attributes: {
          src: "https://samepage.network/images/logo.png",
        },
      },
    ],
  })
);

test(
  "Image without alias",
  runTest("![](https://samepage.network/images/logo.png)", {
    content: String.fromCharCode(0),
    annotations: [
      {
        type: "image",
        start: 0,
        end: 1,
        attributes: {
          src: "https://samepage.network/images/logo.png",
        },
      },
    ],
  })
);

test(
  "No text",
  runTest("", {
    content: "",
    annotations: [],
  })
);

test("A normal block reference", () => {
  runTest("A block ((abcd1234-abcd-1234-abcd-1234abcd1234)) to content", {
    content: `A block ${String.fromCharCode(0)} to content`,
    annotations: [
      {
        start: 8,
        end: 9,
        type: "reference",
        attributes: {
          notebookPageId: "abcd1234-abcd-1234-abcd-1234abcd1234",
          notebookUuid,
        },
      },
    ],
  })();
});

test("A cross app block reference", () => {
  runTest("A {{renderer samepage-reference,abcd1234:reference}} to content", {
    content: `A ${String.fromCharCode(0)} to content`,
    annotations: [
      {
        start: 2,
        end: 3,
        type: "reference",
        attributes: {
          notebookPageId: "reference",
          notebookUuid: "abcd1234",
        },
      },
    ],
  })();
});

test("Regular text with left braces in it", () => {
  runTest("Regular {{ text", {
    content: `Regular {{ text`,
    annotations: [],
  })();
});

test("Parse a macro", () => {
  runTest("Regular {{macro}} text", {
    content: `Regular {{macro}} text`,
    annotations: [],
  })();
});

test("A normal page reference", () => {
  runTest("A page [[reference]] to content", {
    content: `A page ${String.fromCharCode(0)} to content`,
    annotations: [
      {
        start: 7,
        end: 8,
        type: "reference",
        attributes: {
          notebookPageId: "reference",
          notebookUuid,
        },
        appAttributes: {
          logseq: {
            kind: "wikilink",
          },
        },
      },
    ],
  })();
});

test(
  "A nested page reference",
  runTest("A page [[with [[nested]] references]] to content", {
    content: `A page ${String.fromCharCode(0)} to content`,
    annotations: [
      {
        start: 7,
        end: 8,
        type: "reference",
        attributes: {
          notebookPageId: "with [[nested]] references",
          notebookUuid,
        },
        appAttributes: {
          logseq: {
            kind: "wikilink",
          },
        },
      },
    ],
  })
);

test(
  "A hashtag",
  runTest("A page #tag to content", {
    content: `A page ${String.fromCharCode(0)} to content`,
    annotations: [
      {
        start: 7,
        end: 8,
        type: "reference",
        attributes: {
          notebookPageId: "tag",
          notebookUuid,
        },
        appAttributes: {
          logseq: {
            kind: "hash",
          },
        },
      },
    ],
  })
);

test(
  "A hashtagged page reference",
  runTest("A page #[[That hashtags]] to content", {
    content: `A page ${String.fromCharCode(0)} to content`,
    annotations: [
      {
        start: 7,
        end: 8,
        type: "reference",
        attributes: {
          notebookPageId: "That hashtags",
          notebookUuid,
        },
        appAttributes: {
          logseq: {
            kind: "hash-wikilink",
          },
        },
      },
    ],
  })
);

test(
  "Empty block",
  runTest("", {
    content: ``,
    annotations: [],
  })
);

test(
  "Double italics",
  runTest("Deal _with_ two _sets_ of italics", {
    content: "Deal with two sets of italics",
    annotations: [
      {
        start: 5,
        end: 9,
        type: "italics",
        appAttributes: { logseq: { kind: "_" } },
      },
      {
        start: 14,
        end: 18,
        type: "italics",
        appAttributes: { logseq: { kind: "_" } },
      },
    ],
  })
);

test(
  "Odd number underscores",
  runTest("Deal _with_ odd _underscores", {
    content: "Deal with odd _underscores",
    annotations: [
      {
        start: 5,
        end: 9,
        type: "italics",
        appAttributes: { logseq: { kind: "_" } },
      },
    ],
  })
);

test(
  "Odd number asterisks",
  runTest("Deal *with* odd *asterisks", {
    content: "Deal with odd *asterisks",
    annotations: [
      {
        start: 5,
        end: 9,
        type: "italics",
        appAttributes: { logseq: { kind: "*" } },
      },
    ],
  })
);

test(
  "Odd number double underscores",
  runTest("Deal __with__ odd __underscores", {
    content: `Deal with odd __underscores`,
    annotations: [
      {
        start: 5,
        end: 9,
        type: "bold",
        appAttributes: { logseq: { kind: "__" } },
      },
    ],
  })
);

test(
  "Odd number double asterisks",
  runTest("Deal **with** odd **asterisks", {
    content: `Deal with odd **asterisks`,
    annotations: [
      {
        start: 5,
        end: 9,
        type: "bold",
        appAttributes: { logseq: { kind: "**" } },
      },
    ],
  })
);

test(
  "Odd number double tilde",
  runTest("Deal ~~with~~ odd ~~tildes", {
    content: `Deal with odd ~~tildes`,
    annotations: [{ start: 5, end: 9, type: "strikethrough" }],
  })
);

test(
  "Odd number double carot",
  runTest("Deal ^^with^^ odd ^^carots", {
    content: `Deal with odd ^^carots`,
    annotations: [{ start: 5, end: 9, type: "highlighting" }],
  })
);

test(
  "Just double underscore should be valid",
  runTest("Review __public pages", {
    content: "Review __public pages",
    annotations: [],
  })
);

test(
  "Just double asterisk should be valid",
  runTest("Review **public pages", {
    content: "Review **public pages",
    annotations: [],
  })
);

test(
  "Double page tags",
  runTest("One [[page]] and two [[pages]]", {
    content: `One ${String.fromCharCode(0)} and two ${String.fromCharCode(0)}`,
    annotations: [
      {
        start: 4,
        end: 5,
        type: "reference",
        attributes: {
          notebookPageId: "page",
          notebookUuid,
        },
        appAttributes: {
          logseq: {
            kind: "wikilink",
          },
        },
      },
      {
        start: 14,
        end: 15,
        type: "reference",
        attributes: {
          notebookPageId: "pages",
          notebookUuid,
        },
        appAttributes: {
          logseq: {
            kind: "wikilink",
          },
        },
      },
    ],
  })
);

test(
  "Local asset link",
  runTest(" ![local](../assets/file.pdf)", {
    content: " ![local](../assets/file.pdf)",
    annotations: [],
  })
);

test(
  "Double double bold text means no bold",
  runTest("A ****Bold**** text", {
    content: `A ${String.fromCharCode(0)}Bold${String.fromCharCode(0)} text`,
    annotations: [
      {
        end: 3,
        start: 2,
        type: "bold",
        appAttributes: { logseq: { kind: "**" } },
      },
      {
        end: 8,
        start: 7,
        type: "bold",
        appAttributes: { logseq: { kind: "**" } },
      },
    ],
  })
);

test(
  "Double double underscore text means no bold",
  runTest("A ____slanted____ text", {
    content: `A ${String.fromCharCode(0)}slanted${String.fromCharCode(0)} text`,
    annotations: [
      {
        end: 3,
        start: 2,
        type: "bold",
        appAttributes: { logseq: { kind: "__" } },
      },
      {
        end: 11,
        start: 10,
        type: "bold",
        appAttributes: { logseq: { kind: "__" } },
      },
    ],
  })
);

test(
  "Double double highlight text means no highlight",
  runTest("A ^^^^highlight^^^^ text", {
    content: `A ${String.fromCharCode(0)}highlight${String.fromCharCode(
      0
    )} text`,
    annotations: [
      { end: 3, start: 2, type: "highlighting" },
      { end: 13, start: 12, type: "highlighting" },
    ],
  })
);

test(
  "Double double strikethrough text means no strikethrough",
  runTest("A ~~~~struck~~~~ text", {
    content: `A ${String.fromCharCode(0)}struck${String.fromCharCode(0)} text`,
    annotations: [
      { end: 3, start: 2, type: "strikethrough" },
      { end: 10, start: 9, type: "strikethrough" },
    ],
  })
);

test(
  "Underscore within bold underscores",
  runTest("__hello_world__", {
    content: "hello_world",
    annotations: [
      {
        end: 11,
        start: 0,
        type: "bold",
        appAttributes: { logseq: { kind: "__" } },
      },
    ],
  })
);

test(
  "Asterisk within bold stars",
  runTest("**hello*world**", {
    content: "hello*world",
    annotations: [
      {
        end: 11,
        start: 0,
        type: "bold",
        appAttributes: { logseq: { kind: "**" } },
      },
    ],
  })
);
