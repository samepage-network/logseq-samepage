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

// The rest of these are tests from roamjs-components marked compiler. should use to test this grammar
//
// test(
//   "Runs Todos",
//   runTest(
//     `- A {{[[TODO]]}} This is a todo block
// - A {{[[DONE]]}} This is a done block
// `,
//     `<ul>
// <li>A <span><label class="check-container"><input type="checkbox" disabled=""><span class="checkmark"></span></label></span> This is a todo block</li>
// <li>A <span><label class="check-container"><input type="checkbox" checked="" disabled=""><span class="checkmark"></span></label></span> This is a done block</li>
// </ul>
// `
//   )
// );

// test(
//   "Runs Basic Code Block",
//   runTest(
//     `- \`\`\`javascript
// console.log("Render");
// console.log("this");
// console.log("block");
// \`\`\``,
//     `<ul>
// <li><pre><code class="language-javascript">console.log(&quot;Render&quot;);
// console.log(&quot;this&quot;);
// console.log(&quot;block&quot;);
// </code></pre>
// </li>
// </ul>
// `
//   )
// );

// test(
//   "Runs code block without newline",
//   runTest(
//     `- \`\`\`javascript
// console.log("Render");
// console.log("this");
// console.log("block");\`\`\``,
//     `<ul>
// <li><pre><code class="language-javascript">console.log(&quot;Render&quot;);
// console.log(&quot;this&quot;);
// console.log(&quot;block&quot;);
// </code></pre>
// </li>
// </ul>
// `
//   )
// );

// test(
//   "Runs buttons",
//   runTest(
//     `- {{pull references}}`,
//     `<ul>
// <li><button class="bp3-button">pull references</button></li>
// </ul>
// `
//   )
// );

// test(
//   "Custom components buttons",
//   runTest(
//     `- {{component}}
// - {{no component}}`,
//     `<ul>
// <li><p>component</p></li>
// <li><button class="bp3-button">no component</button></li>
// </ul>
// `,
//     {
//       components: (c: string) => c === "component" && `<p>component</p>`,
//     }
//   )
// );

// test(
//   "Runs queries",
//   runTest(
//     `- {{[[query]]: {and:{or:[[TODO]] [[DONE]]} [[January 26th, 2021]]}}}`,
//     `<ul>
// <li><button class="bp3-button">query</button></li>
// </ul>
// `
//   )
// );

// test(
//   "Runs tags as links",
//   runTest(
//     `- Started with [[Hello World]]
// - Then #Vargas is my last name
// - This [[Page]] has no href`,
//     `<ul>
// <li>Started with <a class="rm-page-ref" data-tag="Hello World" href="/hello-world">Hello World</a></li>
// <li>Then <a class="rm-page-ref" data-tag="Vargas" href="/asdfasdf">Vargas</a> is my last name</li>
// <li>This Page has no href</li>
// </ul>
// `,
//     {
//       pagesToHrefs: (tag: string) => {
//         const pages = {
//           "Hello World": "/hello-world",
//           Vargas: "/asdfasdf",
//         } as { [key: string]: string };
//         return pages[tag];
//       },
//     }
//   )
// );

// test(
//   "Links without context is just text",
//   runTest(
//     `- Started with [[Hello World]]
// - Then #Vargas is my last name
// - This [[Page]] has no href`,
//     `<ul>
// <li>Started with [[Hello World]]</li>
// <li>Then #Vargas is my last name</li>
// <li>This [[Page]] has no href</li>
// </ul>
// `
//   )
// );

// test(
//   "Double tag on context",
//   runTest(
//     `- Started with [[Hello World]] [[Page]]`,
//     `<ul>
// <li>Started with <a class="rm-page-ref" data-tag="Hello World" href="/hello-world">Hello World</a> <a class="rm-page-ref" data-tag="Page" href="/page">Page</a></li>
// </ul>
// `,
//     {
//       pagesToHrefs: (t: string) => `/${t.toLowerCase().replace(" ", "-")}`,
//     }
//   )
// );

// test(
//   "Nested Links",
//   runTest(
//     `- One type of [[[[Nested]] Links]]
// - And another [[Example [[Nested]] Link]]
// - A Final [[Link [[Nested]]]]`,
//     `<ul>
// <li>One type of <a class="rm-page-ref" data-tag="[[Nested]] Links" href="/start"><a class="rm-page-ref" data-tag="Nested" href="/nested">Nested</a> Links</a></li>
// <li>And another <a class="rm-page-ref" data-tag="Example [[Nested]] Link" href="/middle">Example <a class="rm-page-ref" data-tag="Nested" href="/nested">Nested</a> Link</a></li>
// <li>A Final <a class="rm-page-ref" data-tag="Link [[Nested]]" href="/end">Link <a class="rm-page-ref" data-tag="Nested" href="/nested">Nested</a></a></li>
// </ul>
// `,
//     {
//       pagesToHrefs: (tag: string) => {
//         const pages = {
//           "[[Nested]] Links": "/start",
//           "Example [[Nested]] Link": "/middle",
//           "Link [[Nested]]": "/end",
//           Nested: "/nested",
//         } as { [key: string]: string };
//         return pages[tag];
//       },
//     }
//   )
// );

// test(
//   "Renders iframe",
//   runTest(
//     `- {{iframe:https://givebutter.com/roamjs}}`,
//     `<ul>
// <li><div class="rm-iframe-container"><iframe src="https://givebutter.com/roamjs" frameborder="0" class="rm-iframe"></iframe></div></li>
// </ul>
// `
//   )
// );

// test(
//   "Renders page aliases",
//   runTest(
//     `- Resolve an alias [Page]([[Hello World]])
// - An invalid [alias](wat)`,
//     `<ul>
// <li>Resolve an alias <a class="rm-alias" href="/hello-world">Page</a></li>
// <li>An invalid <a href="wat">alias</a></li>
// </ul>
// `,
//     {
//       pagesToHrefs: (t: string) => `/${t.toLowerCase().replace(" ", "-")}`,
//     }
//   )
// );

// test(
//   "Renders Roam Attributes",
//   runTest(
//     `- Known:: Attribute value
// - Unexpected:: just bold`,
//     `<ul>
// <li><span class="rm-bold"><a href="/known">Known:</a></span> Attribute value</li>
// <li><span class="rm-bold">Unexpected:</span> just bold</li>
// </ul>
// `,
//     {
//       pagesToHrefs: (t: string) => {
//         const pages: { [t: string]: string } = { Known: "/known" };
//         return pages[t];
//       },
//     }
//   )
// );

// test(
//   "Render block references",
//   runTest(
//     `- A known reference ((123456789))
// - An unknown reference ((abcdefghi))
// - An known with unknown page ((asdfghjkl))
// - A known alias reference [number alias](((123456789)))
// - An unknown alias reference [letter alias](((abcdefghi)))`,
//     `<ul>
// <li>A known reference <a class="rm-block-ref" href="/number#123456789">A number block</a></li>
// <li>An unknown reference ((abcdefghi))</li>
// <li>An known with unknown page linked content</li>
// <li>A known alias reference <a class="rm-alias" href="/number#123456789">number alias</a></li>
// <li>An unknown alias reference letter alias</li>
// </ul>
// `,
//     {
//       pagesToHrefs: (t: string, r?: string) => {
//         const pages: { [t: string]: string } = { Number: "/number" };
//         return pages[t] ? (r ? `${pages[t]}#${r}` : pages[t]) : "";
//       },
//       blockReferences: (t: string) => {
//         const blockReferences: { [t: string]: { text: string; page: string } } =
//           {
//             "123456789": {
//               text: "A number block",
//               page: "Number",
//             },
//             asdfghjkl: {
//               text: "linked content",
//               page: "",
//             },
//           };
//         return blockReferences[t];
//       },
//     }
//   )
// );

// test(
//   "Render videos",
//   runTest(
//     `- {{[[youtube]]: https://www.youtube.com/embed/cQ25hHAPZk0}}
// - {{video: https://www.youtube.com/embed/cQ25hHAPZk0}}`,
//     `<ul>
// <li><div class="rm-iframe-container"><iframe src="https://www.youtube.com/embed/cQ25hHAPZk0" class="rm-iframe rm-video-player"></iframe></div></li>
// <li><div class="rm-iframe-container"><iframe src="https://www.youtube.com/embed/cQ25hHAPZk0" class="rm-iframe rm-video-player"></iframe></div></li>
// </ul>
// `,
//     {
//       pagesToHrefs: (t: string) => {
//         const pages: { [t: string]: string } = { Known: "/known" };
//         return pages[t];
//       },
//     }
//   )
// );

// test("Render hrs", runInlineTest(`---`, `<hr>`));

// test(
//   "Incomplete Tag",
//   runTest(
//     `- [[Incomplete]`,
//     `<ul>
// <li>[[Incomplete]</li>
// </ul>
// `
//   )
// );

// test(
//   "Roam Render",
//   runInlineTest(
//     `{{roam/render: ((sketching))}}`,
//     `<button class="bp3-button">roam/render</button>`
//   )
// );

// test(
//   "Inline Code Blocks",
//   runInlineTest(
//     `\`\`\`css
// body {
//   background-color: red;
// }\`\`\``,
//     `<pre><code class="language-css"><span class="token selector">body</span> <span class="token punctuation">{</span>
//   <span class="token property">background-color</span><span class="token punctuation">:</span> <span class="token color">red</span><span class="token punctuation">;</span>
// <span class="token punctuation">}</span></code></pre>`
//   )
// );

// test(
//   "Inline Code Spans",
//   runInlineTest(`Here is \`a code\` span`, `Here is <code>a code</code> span`)
// );

// test(
//   "Blockquote",
//   runInlineTest(
//     "> an **important** aside",
//     `<blockquote class="rm-bq">an <span class="rm-bold">important</span> aside</blockquote>`
//   )
// );

// test(
//   "Long underscore",
//   runInlineTest(
//     "[[__________ wat]]",
//     `<a class="rm-page-ref" data-tag="__________ wat" href="/___________wat">__________ wat</a>`,
//     {
//       pagesToHrefs: (t: string) => {
//         const pages: { [t: string]: string } = {
//           "__________ wat": "/___________wat",
//         };
//         return pages[t];
//       },
//     }
//   )
// );

// test(
//   "Double left paren",
//   runInlineTest(
//     "This block has two left parens ((but should still parse)",
//     `This block has two left parens ((but should still parse)`
//   )
// );

// test(
//   "Single tilde",
//   runInlineTest(
//     "This ~~has strikethrough~~ but ~this does~ not.",
//     `This <del>has strikethrough</del> but ~this does~ not.`
//   )
// );

// test(
//   "Special chars",
//   runInlineTest("« So much happening! »", `« So much happening! »`)
// );

// test(
//   "Special chars in inline code",
//   runInlineTest(
//     "The `build` has a `url/{{github.number}}`.",
//     `The <code>build</code> has a <code>url/{{github.number}}</code>.`
//   )
// );

// test(
//   "Inline before special Inline character",
//   runInlineTest(
//     "There is a RoamJS component called `PageInput`, which you could find as part of the [roamjs-components](https://github.com/dvargas92495/roamjs-components) library.",
//     `There is a RoamJS component called <code>PageInput</code>, which you could find as part of the <a href="https://github.com/dvargas92495/roamjs-components">roamjs-components</a> library.`
//   )
// );

// test(
//   "Link weirdness",
//   runInlineTest(
//     "I have three links [distributed systems](https://en.wikipedia.org/wiki/Distributed_computing), [decentralized finance](https://en.wikipedia.org/wiki/Decentralized_finance), and [algorithmic trading]([[algorithmic trading]]). And another link [Martin](https://martin.ai/) and a final link [[Go]].",
//     `I have three links <a href="https://en.wikipedia.org/wiki/Distributed_computing">distributed systems</a>, <a href="https://en.wikipedia.org/wiki/Decentralized_finance">decentralized finance</a>, and [algorithmic trading]([[algorithmic trading]]). And another link <a href="https://martin.ai/">Martin</a> and a final link [[Go]].`
//   )
// );

// test(
//   "Attributes with links don't link",
//   runTest(
//     "- Foo:: test\n- Foo:: [[bar]]",
//     `<ul>
// <li><span class="rm-bold"><a href="/Foo">Foo:</a></span> test</li>
// <li><span class="rm-bold"><a href="/Foo">Foo:</a></span> <a class="rm-page-ref" data-tag="bar" href="/bar">bar</a></li>
// </ul>
// `,
//     {
//       pagesToHrefs: (t: string) => `/${t}`,
//     }
//   )
// );

// test(
//   "space before strikethrough link",
//   runInlineTest(
//     " ~~no~~ [all](https://google.com)",
//     ` <del>no</del> <a href="https://google.com">all</a>`
//   )
// );
