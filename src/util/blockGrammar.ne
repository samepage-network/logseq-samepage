@builtin "number.ne"
@builtin "whitespace.ne"
@preprocessor typescript

@{%
import { 
   lexer, 
   createBoldToken,
   createHighlightingToken,
   createItalicsToken,
   createLinkToken,
   createStrikethroughToken,
   createTextToken,
   disambiguateTokens,
} from "./blockTokens";
%}

@lexer lexer

main -> tokens {% id %}

tokens -> token:+ {% disambiguateTokens %}

token -> %highlight tokens %highlight {% createHighlightingToken %}
   | %strike tokens %strike {% createStrikethroughToken %}
   | %boldUnder tokens %boldUnder {% createBoldToken %}
   | %boldStar tokens %boldStar  {% createBoldToken %}
   | %under tokens %under {% createItalicsToken %}
   | %star tokens %star {% createItalicsToken %}
   | %leftBracket tokens %rightBracket %leftParen %url %rightParen {% createLinkToken %}
   | %text {% createTextToken %}
   | %star  {% createTextToken %}
   | %carot  {% createTextToken %}
   | %tilde  {% createTextToken %}
   | %under  {% createTextToken %}
   | %leftParen {% createTextToken %}
   | %leftBracket {% createTextToken %}
   | %rightParen {% createTextToken %}
   | %rightBracket {% createTextToken %}
