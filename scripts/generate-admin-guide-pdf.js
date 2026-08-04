/* global __dirname */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'docs', 'guides', 'guia-administradores-digistats.md');
const outputPath = path.join(root, 'docs', 'guides', 'guia-administradores-digistats.html');
const pdfPath = path.join(root, 'docs', 'guides', 'Guia-do-Administrador-DigiStats.pdf');
const markdown = fs.readFileSync(sourcePath, 'utf8');

function inline(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

const htmlParts = [];
let paragraph = [];
let listType = null;

function closeParagraph() {
    if (!paragraph.length) return;
    htmlParts.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
}

function closeList() {
    if (!listType) return;
    htmlParts.push(`</${listType}>`);
    listType = null;
}

for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);

    if (!line) {
        closeParagraph();
        closeList();
        continue;
    }
    if (line === '---') {
        closeParagraph();
        closeList();
        htmlParts.push('<hr>');
        continue;
    }
    if (heading) {
        closeParagraph();
        closeList();
        const level = heading[1].length;
        htmlParts.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        continue;
    }
    if (unordered || ordered) {
        closeParagraph();
        const nextType = unordered ? 'ul' : 'ol';
        if (listType !== nextType) {
            closeList();
            listType = nextType;
            htmlParts.push(`<${listType}>`);
        }
        htmlParts.push(`<li>${inline((unordered || ordered)[1])}</li>`);
        continue;
    }
    paragraph.push(line);
}
closeParagraph();
closeList();

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Guia do Administrador — DigiStats</title>
<style>
@page { size: A4; margin: 16mm 16mm 18mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #18233b; font-family: "Segoe UI", Arial, sans-serif; font-size: 10.5pt; line-height: 1.46; }
h1 { margin: 0 0 6mm; padding: 13mm 10mm; color: #fff; background: linear-gradient(135deg,#17243f,#6559e8); border-radius: 5mm; font-size: 26pt; line-height: 1.1; }
h1 + p { color: #53617b; font-weight: 600; }
h2 { margin: 8mm 0 3mm; color: #263c73; border-bottom: 1.5px solid #8092f2; padding-bottom: 1.5mm; font-size: 16pt; break-after: avoid; }
h3 { margin: 5mm 0 2mm; color: #3b4e78; font-size: 12.5pt; break-after: avoid; }
p { margin: 0 0 3mm; orphans: 3; widows: 3; }
ul, ol { margin: 1.5mm 0 3.5mm 6mm; padding-left: 5mm; }
li { margin: 0 0 1.3mm; break-inside: avoid; }
strong { color: #142a5a; }
code { padding: .3mm 1.2mm; border-radius: 1mm; background: #eef1fb; color: #253a72; font-family: Consolas, monospace; font-size: 9.5pt; }
hr { margin: 8mm 0; border: 0; border-top: 1px solid #d8deed; }
a { color: #4b52be; text-decoration: none; }
@media print { h1, h2, h3 { break-inside: avoid; } }
</style>
</head>
<body>${htmlParts.join('\n')}</body>
</html>`;

fs.writeFileSync(outputPath, html, 'utf8');

const edgeCandidates = [
    process.env.EDGE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);
const edgePath = edgeCandidates.find((candidate) => fs.existsSync(candidate));
if (!edgePath) {
    console.error(`HTML gerado em ${outputPath}, mas o Microsoft Edge não foi encontrado.`);
    process.exitCode = 1;
} else {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'digistats-admin-guide-'));
    const result = spawnSync(
        edgePath,
        [
            '--headless=new',
            '--disable-gpu',
            '--no-pdf-header-footer',
            `--user-data-dir=${userDataDir}`,
            `--print-to-pdf=${pdfPath}`,
            new URL(`file:///${outputPath.replace(/\\/g, '/')}`).href
        ],
        { stdio: 'inherit' }
    );
    if (result.status !== 0) {
        console.error('Não foi possível gerar o PDF do guia administrativo.');
        process.exitCode = result.status || 1;
    } else {
        console.log(`PDF gerado em ${pdfPath}`);
    }
}
