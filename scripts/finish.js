const fs = require("fs");

module.exports = () => {
  const packageJson = JSON.parse(
    fs.readFileSync("./dist/package.json").toString()
  );
  packageJson.logseq.id = "samepage-dev";
  fs.writeFileSync("./dist/package.json", JSON.stringify(packageJson, null, 4));
};
