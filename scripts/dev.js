const esbuild = require("esbuild");
const chokidar = require("chokidar");

let rebuilder;
chokidar
  .watch(["src"])
  .on("add", (file) => {
    if (file === "src/main.tsx") {
      console.log(`building ${file}...`);
      esbuild
        .build({
          entryPoints: ["./src/main.tsx"],
          outdir: "dist",
          bundle: true,
          define: {
            "process.env.API_URL": '"http://localhost:3003"',
            "process.env.NODE_ENV": '"development"',
            "process.env.WEB_SOCKET_URL": '"ws://127.0.0.1:3010"',
          },
          incremental: true,
        })
        .then((r) => {
          rebuilder = r.rebuild;
          console.log(`successfully built ${file}...`);
        });
    }
  })
  .on("change", (file) => {
    console.log(`File ${file} has been changed`);
    rebuilder()
      .then(() => console.log(`Rebuilt main.tsx`))
      .catch((e) => console.error(`Failed to rebuild`, file, e));
  });
