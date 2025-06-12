
const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

// Update Python version file
const pythonVersionPath = path.join(__dirname, '../server/app/version.py');
fs.writeFileSync(
  pythonVersionPath,
  `VERSION = '${version}'\n`
);

console.log(`Version ${version} synchronized across all project files`);