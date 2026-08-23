"use strict";

const assert=require("assert");
const path=require("path");
const {
  nodeSupported,
  isPrivateIPv4,
  networkCandidates,
  chooseLanIp,
  resolvePort,
  localUrls,
  npmInvocation
}=require("../scripts/iniciar-local");

assert.equal(nodeSupported("20.0.0"),true);
assert.equal(nodeSupported("22.14.0"),true);
assert.equal(nodeSupported("18.20.0"),false);
assert.equal(isPrivateIPv4("192.168.1.25"),true);
assert.equal(isPrivateIPv4("172.16.0.2"),true);
assert.equal(isPrivateIPv4("172.32.0.2"),false);
assert.equal(isPrivateIPv4("8.8.8.8"),false);

const candidates=networkCandidates({
  "vEthernet (WSL)":[{family:"IPv4",internal:false,address:"172.25.64.1"}],
  "Wi-Fi":[{family:"IPv4",internal:false,address:"192.168.10.24"}],
  "Loopback":[{family:"IPv4",internal:true,address:"127.0.0.1"}]
});
assert.equal(candidates[0].address,"192.168.10.24");
assert.equal(chooseLanIp(candidates),"192.168.10.24");
assert.equal(chooseLanIp(candidates,"172.25.64.1"),"172.25.64.1");
assert.equal(chooseLanIp([{name:"Ethernet",address:"8.8.8.8",score:60}]),"");
assert.equal(resolvePort("3100"),3100);
assert.throws(()=>resolvePort("70000"));
assert.deepEqual(localUrls("192.168.10.24",3000),{
  computer:"http://localhost:3000/admin.html",
  phone:"http://192.168.10.24:3000/admin.html"
});

const windowsNode="C:\\Program Files\\nodejs\\node.exe";
const windowsNpmCli=path.win32.join(
  path.win32.dirname(windowsNode),
  "node_modules",
  "npm",
  "bin",
  "npm-cli.js"
);
assert.deepEqual(npmInvocation({
  platform:"win32",
  execPath:windowsNode,
  env:{ComSpec:"C:\\Windows\\System32\\cmd.exe"},
  exists:candidate=>candidate===windowsNpmCli
}),{
  command:windowsNode,
  args:[windowsNpmCli],
  method:"npm-cli"
});
assert.deepEqual(npmInvocation({
  platform:"win32",
  execPath:windowsNode,
  env:{ComSpec:"C:\\Windows\\System32\\cmd.exe"},
  exists:()=>false
}),{
  command:"C:\\Windows\\System32\\cmd.exe",
  args:["/d","/c","npm.cmd"],
  method:"cmd"
});
assert.deepEqual(npmInvocation({
  platform:"linux",
  execPath:"/usr/bin/node",
  env:{},
  exists:()=>false
}),{
  command:"npm",
  args:[],
  method:"path"
});

console.log("✓ Detección de red local y acceso móvil validados");
