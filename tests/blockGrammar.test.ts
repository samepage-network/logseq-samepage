// TODO make this test friendly - https://github.com/microsoft/playwright/issues/17852
import blockGrammar from "../src/utils/blockGrammar";
import type { InitialSchema } from "samepage/internal/types";
import atJsonParser from "samepage/utils/atJsonParser";
import { test, expect } from "@playwright/test";
import { v4 } from "uuid";
import lexer from "../src/utils/blockLexer";

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

const runTest = (md: string, expected: InitialSchema, debug?: true) => () => {
  if (debug) {
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
};

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
    annotations: [{ type: "italics", start: 2, end: 9 }],
  })
);

test(
  "Italics text (asterisk)",
  runTest("A *italics* text", {
    content: "A italics text",
    annotations: [{ type: "italics", start: 2, end: 9 }],
  })
);

test(
  "Bold text (underscore)",
  runTest("A __bold__ text", {
    content: "A bold text",
    annotations: [{ type: "bold", start: 2, end: 6 }],
  })
);

test(
  "Bold text (asterisk)",
  runTest("A **bold** text", {
    content: "A bold text",
    annotations: [{ type: "bold", start: 2, end: 6 }],
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
  runTest("Some content\nid:: 12345678-abdf-1234-5678-abcdef123456", {
    content: "Some content",
    annotations: [],
  })
);

test(
  "Only attribute",
  runTest("id:: 12345678-abdf-1234-5678-abcdef123456", {
    content: "",
    annotations: [],
  })
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
  runTest("A block ((reference)) to content", {
    content: `A block ${String.fromCharCode(0)} to content`,
    annotations: [
      {
        start: 8,
        end: 9,
        type: "reference",
        attributes: {
          notebookPageId: "reference",
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
      { start: 5, end: 9, type: "italics" },
      { start: 14, end: 18, type: "italics" },
    ],
  })
);
