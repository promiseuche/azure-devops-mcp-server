const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('server/src/index.ts', 'utf8');

// Find the tools array start
const startMarker = 'const tools: Tool[] = [';
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
    console.error('Could not find tools array');
    process.exit(1);
}

let braceCount = 0;
let inArray = false;
let arrayContent = '';
for (let i = startIdx; i < content.length; i++) {
    const ch = content[i];
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

// Now split by '},' that are followed by whitespace and '{' (start of next tool)
// This is a simplistic approach but works for our formatted file.
const toolBlocks = [];
let currentBlock = '';
let depth = 0;
for (let i = 0; i < arrayContent.length; i++) {
    const ch = arrayContent[i];
    if (ch === '{') {
        depth++;
    }
    if (ch === '}') {
        depth--;
        if (depth === 0) {
            // end of a tool object
            currentBlock += ch;
            toolBlocks.push(currentBlock.trim());
            currentBlock = '';
            // skip the comma and whitespace
            while (arrayContent[i + 1] === ',' || arrayContent[i + 1] === '\n' || arrayContent[i + 1] === '\r' || arrayContent[i + 1] === ' ') {
                i++;
            }
            continue;
        }
    }
    if (depth > 0) {
        currentBlock += ch;
    }
}

console.log(`Found ${toolBlocks.length} tools`);

const tools = [];
for (const block of toolBlocks) {
    // Extract name
    const nameMatch = block.match(/name:\s*'([^']+)'/);
    const name = nameMatch ? nameMatch[1] : '';
    // Extract description
    const descMatch = block.match(/description:\s*'([^']*)'/);
    const description = descMatch ? descMatch[1] : '';
    // Extract required array
    const requiredMatch = block.match(/required:\s*\[([^\]]*)\]/);
    let required = [];
    if (requiredMatch) {
        required = requiredMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    }
    // Extract properties
    const propsMatch = block.match(/properties:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
    let params = [];
    if (propsMatch) {
        const props = propsMatch[1];
        // find property names
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