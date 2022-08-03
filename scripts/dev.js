const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["./src/main.tsx"],
    outdir: "dist",
    bundle: true,
  })
  .then(() => console.log("done"));
