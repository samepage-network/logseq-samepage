import blockGrammar from "../src/util/blockGrammar";
import type { InitialSchema } from "samepage/types";
import atJsonParser from "samepage/utils/atJsonParser";

const runTest = (md: string, expected: InitialSchema) => () => {
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
