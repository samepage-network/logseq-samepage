const dev = require("samepage/scripts/dev").default;
const args = require("./args");

dev({ ...args, finish: "scripts/finish.js" });
