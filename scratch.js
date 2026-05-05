const fs = require('fs');

const fileContent = fs.readFileSync('src/backbone-v2/application/hierarchyService.js', 'utf8');

// Simple parsing to find keys of `const service = { ... }` or similar.
// Since the file is 2500 lines, I'll regex to extract keys from the returned object.
const match = fileContent.match(/const service = (\{[\s\S]*?\});\s*return service;/);
if (match) {
    const block = match[1];
    const keys = block.match(/^\s*([a-zA-Z0-9_]+)\s*:/gm) || [];
    const directFuncs = block.match(/^\s*([a-zA-Z0-9_]+)\s*,/gm) || [];
    const allKeys = [...keys.map(k => k.split(':')[0].trim()), ...directFuncs.map(k => k.replace(',','').trim())];
    console.log(allKeys.join(', '));
} else {
    console.log("Could not find the service object return block.");
}
