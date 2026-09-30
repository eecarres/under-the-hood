// Runnable check for profile.html's YAML round trip: node tests/profile-viewer.test.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../assets/profile.html"), "utf8");
const body = src.slice(src.indexOf("const esc"), src.indexOf("/* ---- radar"));
const ctx = { document: { getElementById: () => ({}) } };
vm.createContext(ctx);
vm.runInContext(`var text="", areas=[], edited=new Set(); ${body};
  this.serialize=serialize; this.parse=parse; this.esc=esc;
  this.set=(t,a,e)=>{text=t; areas=a; edited=new Set(e)};`, ctx);

// page edited "a"; the agent changed "b" on disk meanwhile; "c" appeared after load
ctx.set('updated: x\nareas:\n  - key: a\n    level: 1\n    notes: "hi <b>"\n' +
        '  - key: b\n    level: 4\n  - key: c\n    level: 2  # gut feel\n',
        [{ key: "a", level: 3 }, { key: "b", level: 1 }], ["a"]);
const out = ctx.serialize();
const checks = {
  "edited level written": /key: a\n    level: 3/.test(out),
  "unedited row keeps disk value": /key: b\n    level: 4/.test(out),
  "unknown row untouched": /key: c\n    level: 2  # gut feel/.test(out),
  "commented level parses": ctx.parse(out)[2].level === 2,
  "no undefined": !out.includes("undefined"),
  "notes parsed": ctx.parse(out)[0].notes === "hi <b>",
  "html escaped": ctx.esc('<&"') === "&lt;&amp;&quot;",
};
for (const [name, ok] of Object.entries(checks)) console.log(ok ? "ok  " : "FAIL", name);
if (Object.values(checks).includes(false)) process.exit(1);
