"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");

for(const [htmlFile,jsFile] of [
  ["public/admin.html","public/admin.js"],
  ["public/index.html","public/app.js"],
  ["public/album.html","public/album.js"],
  ["public/catalogo.html","public/catalogo.js"],
  ["public/muestra.html","public/muestra.js"]
]){
  const html=read(htmlFile);
  const js=read(jsFile);
  const htmlIds=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(htmlIds).size,htmlIds.length,`${htmlFile} contiene identificadores DOM duplicados.`);

  const availableIds=new Set(
    [...`${html}\n${js}`.matchAll(/\bid=["']([^"']+)["']/g)].map(match=>match[1])
  );
  const directReferences=new Set(
    [...js.matchAll(/\$\(["']([^"']+)["']\)/g)].map(match=>match[1])
  );
  const missing=[...directReferences].filter(id=>!availableIds.has(id));
  assert.deepEqual(missing,[],`${jsFile} llama identificadores que no existen: ${missing.join(", ")}`);

  for(const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)){
    const reference=match[1];
    if(!reference.startsWith("/")||reference.startsWith("//"))continue;
    const localPath=reference.split(/[?#]/)[0].replace(/^\/+/,"");
    if(!localPath||localPath.startsWith("api/")||localPath.startsWith("e/"))continue;
    assert.ok(fs.existsSync(path.join(root,"public",localPath)),`${htmlFile} referencia un recurso inexistente: ${reference}`);
  }

  const namedFunctions=[
    ...js.matchAll(/(?:^|\n)(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)
  ].map(match=>match[1]);
  const unused=namedFunctions.filter(name=>(js.match(new RegExp(`\\b${name}\\b`,"g"))||[]).length<2);
  assert.deepEqual(unused,[],`${jsFile} conserva funciones declaradas sin ninguna llamada: ${unused.join(", ")}`);
}

console.log("✓ Referencias DOM, recursos estáticos y funciones declaradas validados");
