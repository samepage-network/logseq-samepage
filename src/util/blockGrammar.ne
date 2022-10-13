@builtin "number.ne"
@builtin "whitespace.ne"
@preprocessor typescript

@{%
import {
   createBoldToken,
   createEmpty,
   createHighlightingToken,
   createItalicsToken,
   createLinkToken,
   createStrikethroughToken,
   createTextToken,
   createImageToken,
   disambiguateTokens,
} from "samepage/utils/atJsonTokens";
import lexer from "./blockLexer";
%}

@lexer lexer

main -> tokens {% id %} | null {% createEmpty %}

tokens -> token:+ {% disambiguateTokens %}

token -> %highlight tokens %highlight {% createHighlightingToken %}
   | %strike tokens %strike {% createStrikethroughToken %}
   | %boldUnder tokens %boldUnder {% createBoldToken %}
   | %boldStar tokens %boldStar  {% createBoldToken %}
   | %under tokens %under {% createItalicsToken %}
   | %star tokens %star {% createItalicsToken %}
   | %leftBracket tokens %rightBracket %leftParen %url %rightParen {% createLinkToken %}
   | %exclamationMark %leftBracket (tokens {% id %} | null {% id %}) %rightBracket %leftParen %url %rightParen {% createImageToken %}
   | %text {% createTextToken %}
   | %star  {% createTextToken %}
   | %carot  {% createTextToken %}
   | %tilde  {% createTextToken %}
   | %under  {% createTextToken %}
   | %leftParen {% createTextToken %}
   | %leftBracket {% createTextToken %}
   | %rightParen {% createTextToken %}
   | %rightBracket {% createTextToken %}
   | %newLine {% createTextToken %}
   | %attribute {% createEmpty %}
   | %exclamationMark {% createTextToken %}
   | %leftBracket %rightBracket %leftParen %url %rightParen {% createTextToken %}
