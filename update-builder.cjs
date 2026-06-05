const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
p.build = {
  appId: "com.walltask.companion",
  productName: "WallTask Companion",
  directories: {
    output: "dist-electron-build"
  },
  files: [
    "dist-electron/**/*",
    "public/**/*"
  ],
  win: {
    target: "nsis",
    icon: "public/vite.svg"
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    runAfterFinish: true
  }
};
fs.writeFileSync('package.json', JSON.stringify(p, null, 2));
