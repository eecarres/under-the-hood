// Runnable check for profile.html's YAML round trip: node tests/profile-viewer.test.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../assets/profile.html"), "utf8");
const body = src.slice(src.indexOf("const esc"), src.indexOf("/* ---- radar"));
const ctx = { document: { getElementById: () => ({}) } };
vm.createContext(ctx);
vm.runInContext(`var text="", areas=[]; ${body};
  this.serialize=serialize; this.parse=parse; this.esc=esc; this.set=(t,a)=>{text=t; areas=a};`, ctx);

// row "b" was added to the file after the page loaded: its level must survive a save
ctx.set('updated: x\nareas:\n  - key: a\n    level: 1\n    notes: "hi <b>"\n  - key: b\n    level: 2\n',
        [{ key: "a", level: 3 }]);
const out = ctx.serialize();
const checks = {
  "edited level written": /key: a\n    level: 3/.test(out),
  "unknown row untouched": /key: b\n    level: 2/.test(out),
  "no undefined": !out.includes("undefined"),
  "notes parsed": ctx.parse(out)[0].notes === "hi <b>",
  "html escaped": ctx.esc('<&"') === "&lt;&amp;&quot;",
};
for (const [name, ok] of Object.entries(checks)) console.log(ok ? "ok  " : "FAIL", name);
if (Object.values(checks).includes(false)) process.exit(1);
