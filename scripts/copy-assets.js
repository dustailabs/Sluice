// Copies static assets (node icons) into dist/ next to the compiled JS,
// since tsc only compiles .ts files and n8n loads icons from beside the
// node's .node.js file at runtime.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'nodes');
const destDir = path.join(root, 'dist', 'nodes');

function copySvgs(dir, destBase) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const srcPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			copySvgs(srcPath, path.join(destBase, entry.name));
			continue;
		}
		if (entry.name.endsWith('.svg')) {
			fs.mkdirSync(destBase, { recursive: true });
			fs.copyFileSync(srcPath, path.join(destBase, entry.name));
			console.log(`copied ${srcPath} -> ${path.join(destBase, entry.name)}`);
		}
	}
}

copySvgs(srcDir, destDir);
