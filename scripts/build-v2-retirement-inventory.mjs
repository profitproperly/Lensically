import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const webRoot=path.join(root,'lensically-web');
const workerFile=path.join(root,'lensically-worker','src','index.ts');
const wranglerFile=path.join(root,'lensically-worker','wrangler.jsonc');
const textExt=new Set(['.ts','.tsx','.js','.mjs','.json']);
function files(dir){const out=[];for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory()){if(['node_modules','.next','.open-next'].includes(ent.name))continue;out.push(...files(p))}else if(textExt.has(path.extname(ent.name)))out.push(p)}return out}
function rel(p){return path.relative(root,p).replaceAll('\\','/')}
function lineNo(text,index){return text.slice(0,index).split('\n').length}
function windowLines(text,line,radius=35){const lines=text.split('\n'),start=Math.max(0,line-1-radius),end=Math.min(lines.length,line+radius);return lines.slice(start,end).map((v,i)=>`${start+i+1}: ${v}`).join('\n')}

const apiPattern=/\/api\/[A-Za-z0-9_./:{}?=&%+-]+/g;
const webRefs=new Map();
for(const f of files(webRoot)){
 const text=fs.readFileSync(f,'utf8');
 for(const match of text.matchAll(apiPattern)){
  const raw=match[0].replace(/[),;`'"\]]+$/g,'');
  const route=raw.split('?')[0];
  const item=webRefs.get(route)||{route,occurrences:[]};
  item.occurrences.push({file:rel(f),line:lineNo(text,match.index),raw});webRefs.set(route,item);
 }
}
const worker=fs.readFileSync(workerFile,'utf8');
const implemented=new Map();
for(const match of worker.matchAll(apiPattern)){
 const raw=match[0].replace(/[),;`'"\]]+$/g,'');
 const route=raw.split('?')[0];
 const item=implemented.get(route)||{route,occurrences:[]};
 item.occurrences.push({line:lineNo(worker,match.index),raw});implemented.set(route,item);
}
const routes=[...webRefs.values()].sort((a,b)=>a.route.localeCompare(b.route)).map(item=>({
 ...item,
 worker_implemented:implemented.has(item.route),
 worker_occurrences:implemented.get(item.route)?.occurrences||[]
}));
const workerOnly=[...implemented.values()].filter(x=>!webRefs.has(x.route)).sort((a,b)=>a.route.localeCompare(b.route));
const wrangler=fs.readFileSync(wranglerFile,'utf8');
const cronMatches=[...wrangler.matchAll(/"([^"\n]+\s+[^"\n]+\s+[^"\n]+\s+[^"\n]+\s+[^"\n]+)"/g)].map(m=>m[1]).filter(v=>/[*0-9,/-]+\s+[*0-9,/-]+\s+[*0-9,/-]+\s+[*0-9,/-]+\s+[*0-9,/-]+/.test(v));
const cronEvidence=[];
for(const cron of [...new Set(cronMatches)]){
 const hits=[];let idx=0;while((idx=worker.indexOf(cron,idx))>=0){const line=lineNo(worker,idx);hits.push({line,context:windowLines(worker,line,50)});idx+=cron.length}
 cronEvidence.push({cron,hits});
}
const inventory={schema_version:'lensically-v2-zero-legacy-retirement-inventory-v1',generated_at:new Date().toISOString(),web_api_route_count:routes.length,worker_api_literal_count:implemented.size,web_routes:routes,worker_only_routes:workerOnly,cron_count:cronEvidence.length,crons:cronEvidence};
fs.writeFileSync('V2_RETIREMENT_INVENTORY.json',JSON.stringify(inventory,null,2)+'\n');
let md='# Lensically v2 Zero-Legacy Retirement Extract\n\n';
md+=`Generated: ${inventory.generated_at}\n\nWeb-used API routes: ${routes.length}\n\n`;
for(const item of routes){md+=`## ${item.route}\n\nWeb refs: ${item.occurrences.map(o=>`${o.file}:${o.line}`).join(', ')}\n\n`;for(const occ of item.worker_occurrences.slice(0,4)){md+=`### Worker occurrence line ${occ.line}\n\n\`\`\`ts\n${windowLines(worker,occ.line,45)}\n\`\`\`\n\n`}}
md+='\n# Background Cron Evidence\n\n';for(const item of cronEvidence){md+=`## ${item.cron}\n\n`;if(!item.hits.length)md+='No literal handler occurrence found in index.ts.\n\n';for(const hit of item.hits.slice(0,4))md+=`### line ${hit.line}\n\n\`\`\`ts\n${hit.context}\n\`\`\`\n\n`}
fs.writeFileSync('V2_RETIREMENT_EXTRACT.md',md);
console.log(JSON.stringify({web_api_route_count:routes.length,worker_api_literal_count:implemented.size,cron_count:cronEvidence.length},null,2));
