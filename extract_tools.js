const fs = require('fs');
const path = require('path');

const file = fs.readFileSync('server/src/index.ts', 'utf8');

// Find the tools array start
const start = file.indexOf('const tools: Tool[] = [');
if (start === -1) {
    console.error('Could not find tools array');
    process.exit(1);
}

// Extract the array content (simplistic approach)
let braceCount = 0;
let inArray = false;
let arrayContent = '';
for (let i = start; i < file.length; i++) {
    const ch = file[i];
    if (ch === '[' && !inArray) {
        inArray = true;
        braceCount = 1;
        continue;
    }
    if (inArray) {
        if (ch === '[') braceCount++;
        if (ch === ']') braceCount--;
        if (braceCount === 0) {
            // end of array
            break;
        }
        arrayContent += ch;
    }
}

// Now parse each tool object (naive regex)
const toolRegex = /\{\s*name:\s*'([^']+)',\s*description:\s*'([^']*)',\s*inputSchema:\s*\{[^}]*\}/g;
let match;
const tools = [];
while ((match = toolRegex.exec(arrayContent)) !== null) {
    const name = match[1];
    const description = match[2];
    // Extract properties from inputSchema (simplified)
    const schemaStart = arrayContent.indexOf('inputSchema:', match.index);
    const schemaEnd = arrayContent.indexOf('},', schemaStart) + 1;
    const schema = arrayContent.substring(schemaStart, schemaEnd);
    // Find required array
    let required = [];
    const requiredMatch = schema.match(/required:\s*\[([^\]]*)\]/);
    if (requiredMatch) {
        required = requiredMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    }
    // Find properties
    const propsMatch = schema.match(/properties:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
    let params = [];
    if (propsMatch) {
        const props = propsMatch[1];
        // crude extraction of property names
        const propRegex = /(\w+):\s*\{/g;
        let propMatch;
        while ((propMatch = propRegex.exec(props)) !== null) {
            params.push(propMatch[1]);
        }
    }
    tools.push({ name, description, required, params });
}

// Generate markdown table
console.log('| Tool Name | Description | Required Parameters | Optional Parameters |');
console.log('|-----------|-------------|---------------------|---------------------|');
for (const tool of tools) {
    const requiredStr = tool.required.length > 0 ? tool.required.join(', ') : 'None';
    const optional = tool.params.filter(p => !tool.required.includes(p));
    const optionalStr = optional.length > 0 ? optional.join(', ') : 'None';
    console.log(`| \`${tool.name}\` | ${tool.description} | ${requiredStr} | ${optionalStr} |`);
}

// Also output count
console.log(`\nTotal tools: ${tools.length}`);