import fs from 'fs';

const filePath = 'd:/coding/IPA/MinecraftLauncher/template_debug.html';
const content = fs.readFileSync(filePath, 'utf8');

function countTags(tagName) {
    const openRegex = new RegExp(`<${tagName}\\b`, 'g');
    const closeRegex = new RegExp(`</${tagName}>`, 'g');
    const openCount = (content.match(openRegex) || []).length;
    const closeCount = (content.match(closeRegex) || []).length;
    return { openCount, closeCount };
}

const divCounts = countTags('div');
const templateCounts = countTags('template');
const transitionCounts = countTags('Transition');

console.log('--- Tag Balance Audit ---');
console.log(`div:       < ${divCounts.openCount-1} vs /> ${divCounts.closeCount}`); // -1 because we might have missed the root div in extraction if regex was tight
console.log(`template:  < ${templateCounts.openCount} vs /> ${templateCounts.closeCount}`);
console.log(`Transition: < ${transitionCounts.openCount} vs /> ${transitionCounts.closeCount}`);

// More detailed inspection for self-closing templates or weirdness
const templateTags = content.match(/<template[^>]*>/g) || [];
console.log('\nTemplate Tags Found:');
templateTags.forEach(t => console.log(t));
