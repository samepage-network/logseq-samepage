import { compileLexer, DEFAULT_TOKENS } from "samepage/utils/atJsonTokens";

const lexer = compileLexer({
  attribute: { match: /\n?[a-z]+::[^\n]+/, lineBreaks: true },
  url: DEFAULT_TOKENS.url,
  newLine: { match: /\n/, lineBreaks: true },
  text: { match: /(?:[^:^~_*[\]\n()]|:(?!:))+/, lineBreaks: true },
});

export default lexer;
