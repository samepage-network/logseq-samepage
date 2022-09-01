import { Parser, Grammar } from "nearley";
import grammar from "./blockGrammar";
import { Token } from "./blockTokens";

const blockLexer = (text: string): Token[] => {
  const parser = new Parser(Grammar.fromCompiled(grammar));
  parser.feed(text);
  if (parser.results.length > 1) {
    console.warn(
      `Grammar returned multiple results:`,
      parser.results.length,
      "for input:",
      text
    );
  }
  if (parser.results.length === 0) {
    console.warn(`Grammar returned no results for input:`, text);
    return [{ type: "text", raw: text, text }];
  }
  return parser.results[0];
};

export default blockLexer;
