import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve('.');
const required = [
  '.nojekyll',
  'index.html',
  'login.html',
  'course.html',
  'course.json',
  'assets/app.js',
  'assets/account.js',
  'assets/styles.css',
  'assets/profile.css',
  'assets/worker.js',
  'assets/pyodide/pyodide.mjs',
  'assets/pyodide/pyodide.asm.wasm',
  'assets/pyodide/python_stdlib.zip',
];
const errors = [];
const credentialHeader = ['username', 'password_hash', 'role', 'mobile'].join(
  ',',
);
const textExtensions = new Set([
  '.css',
  '.csv',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.txt',
  '.yml',
  '.yaml',
]);

async function exists(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function files(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await files(full)));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

for (const name of required)
  if (!(await exists(path.join(root, name))))
    errors.push(`missing required file: ${name}`);

const published = await files(root);
for (const file of published) {
  const name = path.basename(file).toLowerCase();
  if (
    name === '.env' ||
    name === 'credentials.csv' ||
    name.includes('secret') ||
    name.includes('password')
  )
    errors.push(
      `forbidden potentially sensitive file: ${path.relative(root, file)}`,
    );
  if (textExtensions.has(path.extname(file).toLowerCase())) {
    const contents = await readFile(file, 'utf8');
    if (contents.includes(credentialHeader))
      errors.push(
        `credentials CSV header found in: ${path.relative(root, file)}`,
      );
    if (/[a-f0-9]{32}:[a-f0-9]{128}/i.test(contents))
      errors.push(
        `scrypt password hash found in: ${path.relative(root, file)}`,
      );
  }
}

for (const html of published.filter((file) => file.endsWith('.html'))) {
  const source = await readFile(html, 'utf8');
  const attributes = source.matchAll(
    /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
  );
  for (const match of attributes) {
    const value = match[1] ?? match[2];
    if (
      !value ||
      value.startsWith('#') ||
      /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)
    )
      continue;
    const relative = decodeURIComponent(value.split(/[?#]/, 1)[0]);
    if (
      !relative ||
      relative.startsWith('/api/') ||
      relative.startsWith('api/')
    )
      continue;
    const target = path.resolve(path.dirname(html), relative);
    if (target !== root && !target.startsWith(root + path.sep)) {
      errors.push(
        `${path.relative(root, html)}: link escapes publication root: ${value}`,
      );
    } else if (!(await exists(target))) {
      errors.push(
        `${path.relative(root, html)}: missing local target: ${value}`,
      );
    }
  }
}

if (errors.length) {
  console.error('Publication validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Publication validation passed.');
}
