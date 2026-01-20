const fs = require('fs');
const lines = fs.readFileSync('server/src/index.ts', 'utf8').split('\n');

let inToolsArray = false;
let braceDepth = 0;
let toolStart = -1;
const toolBlocks = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('const tools: Tool[] = [')) {
        inToolsArray = true;
        continue;
    }
    if (!inToolsArray) continue;
    
    // Count braces
    for (const ch of line) {
        if (ch === '{') {
            if (braceDepth === 0) {
                toolStart = i;
            }
            braceDepth++;
        }
        if (ch === '}') {
            braceDepth--;
            if (braceDepth === 0) {
                // End of a tool object
                const toolLines = lines.slice(toolStart, i + 1);
                toolBlocks.push(toolLines.join('\n'));
                toolStart = -1;
            }
        }
    }
    if (line.includes('];')) {
        // End of array
        break;
    }
}

console.log(`Found ${toolBlocks.length} tools`);

const parsed = [];
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
    parsed.push({ name, description, required, params });
}

// Generate markdown table
console.log('| Tool Name | Description | Required Parameters | Optional Parameters |');
console.log('|-----------|-------------|---------------------|---------------------|');
for (const tool of parsed) {
    const requiredStr = tool.required.length > 0 ? tool.required.join(', ') : 'None';
    const optional = tool.params.filter(p => !tool.required.includes(p));
    const optionalStr = optional.length > 0 ? optional.join(', ') : 'None';
    console.log(`| \`${tool.name}\` | ${tool.description} | ${requiredStr} | ${optionalStr} |`);
}

console.log(`\nTotal tools: ${parsed.length}`);