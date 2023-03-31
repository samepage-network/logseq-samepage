const build = require("samepage/scripts/build").default;
const args = require("./args");

build({ ...args, dry: process.argv.includes("--dry") });
