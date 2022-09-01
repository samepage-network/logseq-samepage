const fs = require("fs");
const nearley = require("nearley");
const nearleyc = require("nearley/lib/compile");
const nearleys = require("nearley/lib/stream");
const nearleylang = require("nearley/lib/nearley-language-bootstrapped");
const nearleyg = require("nearley/lib/generate.js");
const nearleyl = require("nearley/lib/lint.js");

const nearleyCompile = (f) => {
  const parserGrammar = nearley.Grammar.fromCompiled(nearleylang);
  const parser = new nearley.Parser(parserGrammar);
  const base = f.replace(/\.ne/, "").replace(/^\.\//, "");
  const input = fs.createReadStream(`./${base}.ne`);
  const output = fs.createWriteStream(`./${base}.ts`);
  return new Promise((resolve, reject) =>
    input
      .pipe(new nearleys(parser))
      .on("finish", function () {
        try {
          parser.feed("\n");
          const c = nearleyc(parser.results[0], {});
          nearleyl(c, { out: process.stderr });
          output.write(nearleyg(c));

          resolve();
        } catch (e) {
          reject(e);
        }
      })
      .on("error", (e) => {
        console.error("Error compiling nearley file", base);
        console.error(e);
      })
  ).catch((e) => {
    console.error("Error running nearley compiler on file", base);
    console.error(e);
  });
};

module.exports = nearleyCompile;
