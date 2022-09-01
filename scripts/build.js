const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const nearleyCompile = require("./nearley");

const files = [
  "node_modules/normalize.css/normalize.css",
  "node_modules/@blueprintjs/icons/lib/css/blueprint-icons.css",
  "node_modules/@blueprintjs/core/lib/css/blueprint.css",
];

nearleyCompile("./src/util/blockGrammar")
  .then(() =>
    esbuild.build({
      entryPoints: ["./src/main.tsx"],
      outdir: "dist",
      bundle: true,
      define: {
        "process.env.BLUEPRINT_NAMESPACE": '"bp4"',
        "process.env.NODE_ENV": '"production"',
      },
    })
  )
  .then(() => {
    files.forEach((f) => fs.cpSync(f, path.join("dist", path.basename(f))));
    console.log("done");
  });
