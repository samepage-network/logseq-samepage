import { compileLexer, Processor, URL_REGEX } from "samepage/utils/atJsonTokens";
import type { InitialSchema } from "samepage/types";

const lexer = compileLexer({
  attribute: { match: /\n?[a-z]+::[^\n]+/, lineBreaks: true },
  url: URL_REGEX,
  newLine: { match: /\n/, lineBreaks: true },
  text: { match: /(?:[^:^~_*[\]\n()]|:(?!:))+/, lineBreaks: true },
});

export default lexer;
