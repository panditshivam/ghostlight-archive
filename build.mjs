import {mkdir,copyFile,rm} from 'node:fs/promises';
const files=['index.html','style.css','app.mjs','game.mjs','audio.mjs','archive.mjs','core.mjs','model-config.mjs','model-worker.mjs','README.md','LICENSE','revival.html','revival.css','revival.mjs','revival-config.mjs','revival-dispatch.mjs','revival-model-worker.mjs','revival-service-config.mjs','revival-review.json'];
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of files)await copyFile(file,`dist/${file}`);
console.log(`Built ${files.length} explicitly selected public files.`);
