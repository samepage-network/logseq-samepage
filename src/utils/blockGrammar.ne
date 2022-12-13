@preprocessor typescript

@{%
import {
   createEmpty,
   createHighlightingToken,
   createStrikethroughToken,
   createTextToken,
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
   createAliasToken,
   createAssetToken,
   createCodeBlockToken,
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
   | %asset {% createAssetToken %}
   | %blockReference {% createReferenceToken %}
   | %hash:? %leftBracket %leftBracket tokens %rightBracket %rightBracket {% createWikilinkToken %}
   | %hashtag {% createHashtagToken %}
   | %macro {% parseMacroToken %}
   | %alias {% createAliasToken %}
   | %codeBlock {% createCodeBlockToken %}
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
