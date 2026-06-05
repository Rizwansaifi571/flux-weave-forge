const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
p.scripts['dev:electron'] = 'concurrently "vite --config vite.electron.config.ts" "tsup --watch" "wait-on dist-electron/main.js && electron ."';
p.scripts['build:electron'] = 'vite build --config vite.electron.config.ts && tsup && electron-builder';
fs.writeFileSync('package.json', JSON.stringify(p, null, 2));
