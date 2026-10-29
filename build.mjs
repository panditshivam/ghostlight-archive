import {mkdir,copyFile,rm} from 'node:fs/promises';
const files=['index.html','style.css','app.mjs','archive.mjs','core.mjs','model-config.mjs','model-worker.mjs','README.md','LICENSE'];
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of files)await copyFile(file,`dist/${file}`);
console.log(`Built ${files.length} explicitly selected public files.`);
