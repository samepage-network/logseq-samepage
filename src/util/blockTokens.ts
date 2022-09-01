import moo from "moo";
import nearley from "nearley";

// https://github.com/spamscanner/url-regex-safe/blob/master/src/index.js
const protocol = `(?:https?://)`;
const host = "(?:(?:[a-z\\u00a1-\\uffff0-9][-_]*)*[a-z\\u00a1-\\uffff0-9]+)";
const domain = "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*";
const tld = `(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))`;
const port = "(?::\\d{2,5})?";
const path = "(?:[/?#][^\\s\"\\)']*)?";
const regex = `(?:${protocol}|www\\.)(?:${host}${domain}${tld})${port}${path}`;
const URL_REGEX = new RegExp(regex);

export const lexer = moo.compile({
  url: URL_REGEX,
  highlight: "^^",
  strike: "~~",
  boldUnder: "__",
  boldStar: "**",
  under: "_",
  star: "*",
  tilde: "~",
  carot: "^",
  leftBracket: "[",
  leftParen: "(",
  rightBracket: "]",
  rightParen: ")",
  text: { match: /[^^~_*[\]]+/, lineBreaks: true },
});

type BoldToken = {
  type: "bold";
  raw: string;
  tokens: Token[];
};

type HighlightingToken = {
  type: "highlighting";
  raw: string;
  tokens: Token[];
};

type ItalicsToken = {
  type: "italics";
  raw: string;
  tokens: Token[];
};

type StrikethroughToken = {
  type: "strikethrough";
  raw: string;
  tokens: Token[];
};

type TextToken = {
  type: "text";
  raw: string;
  text: string;
};

type LinkToken = {
  type: "link";
  raw: string;
  tokens: Token[];
  href: string;
};

export type Token =
  | BoldToken
  | HighlightingToken
  | ItalicsToken
  | LinkToken
  | StrikethroughToken
  | TextToken;

const flattenRaw = (dataSegments: (moo.Token | Token[])[]) =>
  dataSegments
    .flatMap((dataSegment) =>
      Array.isArray(dataSegment)
        ? dataSegment.map((s) => s.raw)
        : dataSegment.text
    )
    .join("");

type Processor<T> = (
  ...args: Parameters<nearley.Postprocessor>
) => T | Parameters<nearley.Postprocessor>[2];

export const createBoldToken: Processor<BoldToken> = (_data) => {
  const data = _data as [moo.Token, Token[], moo.Token];
  const raw = flattenRaw(data);
  return { type: "bold", raw, tokens: data[1] };
};

export const createHighlightingToken: Processor<HighlightingToken> = (
  _data
) => {
  const data = _data as [moo.Token, Token[], moo.Token];
  const raw = flattenRaw(data);
  return { type: "highlighting", raw, tokens: data[1] };
};

export const createItalicsToken: Processor<ItalicsToken> = (_data) => {
  const data = _data as [moo.Token, Token[], moo.Token];
  const raw = flattenRaw(data);
  return { type: "italics", raw, tokens: data[1] };
};

export const createStrikethroughToken: Processor<StrikethroughToken> = (
  _data
) => {
  const data = _data as [moo.Token, Token[], moo.Token];
  const raw = flattenRaw(data);
  return { type: "strikethrough", raw, tokens: data[1] };
};

export const createLinkToken: Processor<LinkToken> = (_data) => {
  const data = _data as [
    moo.Token,
    Token[],
    moo.Token,
    moo.Token,
    moo.Token,
    moo.Token
  ];
  const raw = flattenRaw(data);
  return { type: "link", raw, tokens: data[1], href: data[4].text };
};

export const createTextToken: Processor<TextToken> = (_data) => {
  const data = _data as [moo.Token];
  const raw = data[0].text;
  return { type: "text", raw, text: raw };
};

export const disambiguateTokens: Processor<Token[]> = (data, _, reject) => {
  const [tokens] = data as [Token[]];
  if (
    tokens.filter((s) => s.type === "text" && s.text.includes("*")).length > 1
  ) {
    return reject;
  }
  if (
    tokens.filter((s) => s.type === "text" && s.text.includes("_")).length > 1
  ) {
    return reject;
  }
  const reducedTokens: Token[] = [];
  tokens.forEach((t) => {
    const pre = reducedTokens.slice(-1)[0];
    if (t.type === "text" && pre?.type === "text") {
      pre.raw += t.raw;
      pre.text += t.text;
    } else {
      reducedTokens.push({ ...t });
    }
  });
  return reducedTokens;
};
