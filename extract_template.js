import fs from 'fs';

const filePath = 'd:/coding/IPA/MinecraftLauncher/src/renderer/src/App.vue';
const content = fs.readFileSync(filePath, 'utf8');

const templateMatch = content.match(/<template>([\s\S]*)<\/template>\s*<style>/);

if (templateMatch) {
    const templateContent = templateMatch[1];
    fs.writeFileSync('d:/coding/IPA/MinecraftLauncher/template_debug.html', templateContent);
    console.log('Template section extracted to d:/coding/IPA/MinecraftLauncher/template_debug.html');
} else {
    console.error('Could not find template section');
}
