const fs = require('fs');
const content = fs.readFileSync('server/src/index.ts', 'utf8');

// Find the tools array start and end
const start = content.indexOf('const tools: Tool[] = [');
if (start === -1) {
    console.error('Could not find tools array');
    process.exit(1);
}

let bracketCount = 0;
let inArray = false;
let arrayStr = '';
for (let i = start; i < content.length; i++) {
    const ch = content[i];
    if (ch === '[' && !inArray) {
        inArray = true;
        bracketCount = 1;
        continue;
    }
    if (inArray) {
        if (ch === '[') bracketCount++;
        if (ch === ']') bracketCount--;
        if (bracketCount === 0) {
            // end of array
            break;
        }
        arrayStr += ch;
    }
}

// Now we have the array content without the outer brackets.
// Split by '},' that are followed by a newline and whitespace and '{' (start of next tool)
// This is tricky because there are nested braces inside properties.
// Instead, we can parse using a simple stack.
let tools = [];
let stack = [];
let current = '';
let inString = false;
let escape = false;
for (let i = 0; i < arrayStr.length; i++) {
    const ch = arrayStr[i];
    if (escape) {
        current += ch;
        escape = false;
        continue;
    }
    if (ch === '\\') {
        escape = true;
        current += ch;
        continue;
    }
    if (ch === '"' || ch === "'") {
        inString = !inString;
        current += ch;
        continue;
    }
    if (!inString) {
        if (ch === '{') {
            stack.push('{');
            current += ch;
        } else if (ch === '}') {
            stack.pop();
            current += ch;
            if (stack.length === 0) {
                // End of a tool object
                tools.push(current.trim());
                current = '';
                // skip comma and whitespace
                while (i + 1 < arrayStr.length && (arrayStr[i + 1] === ',' || arrayStr[i + 1] === '\n' || arrayStr[i + 1] === '\r' || arrayStr[i + 1] === ' ')) {
                    i++;
                }
                continue;
            }
        } else {
            current += ch;
        }
    } else {
        current += ch;
    }
}

console.log(`Found ${tools.length} tools`);

const parsed = [];
for (const tool of tools) {
    // Extract name
    const nameMatch = tool.match(/name:\s*'([^']+)'/);
    const name = nameMatch ? nameMatch[1] : '';
    // Extract description
    const descMatch = tool.match(/description:\s*'([^']*)'/);
    const description = descMatch ? descMatch[1] : '';
    // Extract required array
    const requiredMatch = tool.match(/required:\s*\[([^\]]*)\]/);
    let required = [];
    if (requiredMatch) {
        required = requiredMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    }
    // Extract properties
    const propsMatch = tool.match(/properties:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
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