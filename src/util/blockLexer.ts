import { Annotation, InitialSchema } from "samepage/internal/types";
import { compileLexer, DEFAULT_TOKENS, Processor } from "samepage/utils/atJsonTokens";

export const createReferenceToken: Processor<InitialSchema> = (_data) => {
  const [token] = _data as [moo.Token];
  const parts = token.value.slice(2, -2).split(":");
  const { notebookPageId, notebookUuid } =
    parts.length === 1
      ? {
          notebookPageId: parts[0],
          notebookUuid: window.logseq.settings["uuid"],
        }
      : { notebookPageId: parts[1], notebookUuid: parts[0] };
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
};

const lexer = compileLexer({
  attribute: { match: /\n?[a-z]+::[^\n]+/, lineBreaks: true },
  url: DEFAULT_TOKENS.url,
  blockReference: /\(\([^)]*\)\)/,
  newLine: { match: /\n/, lineBreaks: true },
  text: { match: /(?:[^:^~_*[\]!\n()]|:(?!:))+/, lineBreaks: true },
});

export default lexer;
