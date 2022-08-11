const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["./src/main.tsx"],
    outdir: "dist",
    bundle: true,
    define: {
      "process.env.BLUEPRINT_NAMESPACE": '"bp4"',
      "process.env.WEB_SOCKET_URL": '"wss://ws.samepage.network"',
      "process.env.NODE_ENV": '"production"',
    },
  })
  .then(() => {
    console.log("done");
  });
