const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
p.main = 'dist-electron/main.cjs';
p.scripts['dev:electron'] = 'concurrently "vite --config vite.electron.config.ts" "tsup --watch" "wait-on dist-electron/main.cjs && electron ."';
fs.writeFileSync('package.json', JSON.stringify(p, null, 2));
