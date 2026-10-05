import fs from 'node:fs';
import path from 'node:path';
import { parseFragment, serialize } from 'parse5';
const project = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(project, file), 'utf8');
const names = {
    class: 'className',
    for: 'htmlFor',
    tabindex: 'tabIndex',
    readonly: 'readOnly',
    maxlength: 'maxLength',
    minlength: 'minLength',
    colspan: 'colSpan',
    rowspan: 'rowSpan',
    autocomplete: 'autoComplete',
    autofocus: 'autoFocus',
    crossorigin: 'crossOrigin',
    inputmode: 'inputMode',
    spellcheck: 'spellCheck',
    srcset: 'srcSet',
    value: 'defaultValue',
    checked: 'defaultChecked'
};
const boolean = new Set([
    'hidden',
    'required',
    'disabled',
    'multiple',
    'readOnly',
    'autoFocus',
    'defaultChecked',
    'open',
    'inert'
]);
const camel = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
function jsx(node) {
    if (node.nodeName === '#text')
        return node.value.trim() ? `{${JSON.stringify(node.value)}}` : '';
    if (!node.tagName || ['script', 'link'].includes(node.tagName)) return '';
    let props = '';
    for (const attr of node.attrs || []) {
        if (attr.name === 'selected' || attr.name.startsWith('on')) continue;
        const name =
            attr.name === 'value' && node.tagName === 'option'
                ? 'value'
                : names[attr.name] ||
                  (/^(?:stroke-|fill-|clip-)/.test(attr.name) ? camel(attr.name) : attr.name);
        if (name === 'style') {
            const style = Object.fromEntries(
                attr.value
                    .split(';')
                    .filter(Boolean)
                    .map((rule) => {
                        const colon = rule.indexOf(':');
                        return [camel(rule.slice(0, colon).trim()), rule.slice(colon + 1).trim()];
                    })
            );
            props += ` style={${JSON.stringify(style)} as CSSProperties}`;
        } else if (
            [
                'rows',
                'cols',
                'size',
                'rowSpan',
                'colSpan',
                'tabIndex',
                'maxLength',
                'minLength'
            ].includes(name)
        )
            props += ` ${name}={${Number(attr.value)}}`;
        else
            props += boolean.has(name)
                ? ` ${name}={true}`
                : ` ${name}=${JSON.stringify(attr.value)}`;
    }
    if (node.tagName === 'select') {
        const selected = (node.childNodes || []).find(
            (child) =>
                child.tagName === 'option' && child.attrs?.some((attr) => attr.name === 'selected')
        );
        if (selected)
            props += ` defaultValue=${JSON.stringify(selected.attrs.find((attr) => attr.name === 'value')?.value || selected.childNodes?.find((child) => child.nodeName === '#text')?.value || '')}`;
    }
    if (node.tagName === 'template')
        return `<template${props} dangerouslySetInnerHTML={{__html:${JSON.stringify(serialize(node.content))}}}/>`;
    if (
        [
            'input',
            'img',
            'br',
            'hr',
            'meta',
            'source',
            'wbr',
            'area',
            'col',
            'embed',
            'param',
            'track',
            'base'
        ].includes(node.tagName)
    )
        return `<${node.tagName}${props}/>`;
    return `<${node.tagName}${props}>${(node.childNodes || []).map(jsx).join('')}</${node.tagName}>`;
}
export function generateForms() {
    for (const [input, folder] of [
        ['tools.html', 'workspace'],
        ['torneios/decklist-builder/index.html', 'builder']
    ]) {
        let body = read(input).match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1];
        if (folder === 'builder')
            body = body
                .replaceAll('../../', '')
                .replaceAll('id="toast-container"', 'id="builderToast"');
        const output = `// Generated from the shared domain form source; run npm run build.\nimport type {CSSProperties} from 'react';\nexport function DomainForms(){return <>${parseFragment(body).childNodes.map(jsx).join('')}</>}\n`;
        fs.mkdirSync(path.join(project, `frontend/apps/${folder}`), { recursive: true });
        fs.writeFileSync(path.join(project, `frontend/apps/${folder}/DomainForms.tsx`), output);
    }
}
generateForms();
