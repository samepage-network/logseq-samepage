@builtin "number.ne"
@builtin "whitespace.ne"
@preprocessor typescript

@{%
import {
   createEmpty,
   createHighlightingToken,
   createLinkToken,
   createStrikethroughToken,
   createTextToken,
   createImageToken,
} from "samepage/utils/atJsonTokens";
import lexer, {
   disambiguateTokens,
   createBoldToken,
   createItalicsToken,
   createReferenceToken,
   parseMacroToken,
   createWikilinkToken,
   createHashtagToken,
   createNull,
} from "./blockLexer";
%}

@lexer lexer

main -> tokens {% id %} | null {% createEmpty %}

tokens -> token:+ {% disambiguateTokens %}

token -> %openDoubleCarot (tokens {% id %} | null {% createNull %}) (%highlight | %openDoubleCarot) {% createHighlightingToken %}
   | %openDoubleTilde (tokens {% id %} | null {% createNull %}) (%strike | %openDoubleTilde) {% createStrikethroughToken %}
   | %openDoubleUnder (tokens {% id %} | null {% createNull %}) (%boldUnder | %openDoubleUnder) {% createBoldToken %}
   | %openDoubleStar (tokens {% id %} | null {% createNull %}) (%boldStar | %openDoubleStar)  {% createBoldToken %}
   | %openUnder tokens (%under | %openUnder) {% createItalicsToken %}
   | %openStar tokens (%star | %openStar) {% createItalicsToken %}
   | %leftBracket tokens %rightBracket %leftParen %url %rightParen {% createLinkToken %}
   | %exclamationMark %leftBracket (tokens {% id %} | null {% id %}) %rightBracket %leftParen %url %rightParen {% createImageToken %}
   | %blockReference {% createReferenceToken %}
   | %hash:? %leftBracket %leftBracket tokens %rightBracket %rightBracket {% createWikilinkToken %}
   | %hashtag {% createHashtagToken %}
   | %macro {% parseMacroToken %}
   | %text {% createTextToken %}
   | %star  {% createTextToken %}
   | %carot  {% createTextToken %}
   | %tilde  {% createTextToken %}
   | %under  {% createTextToken %}
   | %hash {% createTextToken %}
   | %boldUnder {% createTextToken %}
   | %boldStar {% createTextToken %}
   | %highlight {% createTextToken %}
   | %strike {% createTextToken %}
   | %leftParen {% createTextToken %}
   | %leftBracket {% createTextToken %}
   | %rightParen {% createTextToken %}
   | %rightBracket {% createTextToken %}
   | %newLine {% createTextToken %}
   | %attribute {% createEmpty %}
   | %exclamationMark {% createTextToken %}
   | %leftBracket %rightBracket %leftParen %url %rightParen {% createTextToken %}
