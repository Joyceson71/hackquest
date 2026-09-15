const fs = require('fs').promises;
const path = require('path');

const replacements = {
  'border-black': 'border-border',
  'bg-white': 'bg-card',
  'bg-black': 'bg-foreground',
  'text-black': 'text-foreground',
  'text-white': 'text-background',
  'bg-muted/20': 'bg-muted'
};

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Use lookarounds to ensure we match whole classes, preventing partial matches like text-white in text-white-500
// but allowing matches with pseudo-classes (hover:bg-white) and opacities (bg-white/50)
const pattern = new RegExp(
  `(?<![a-zA-Z0-9-])(${Object.keys(replacements).map(escapeRegExp).join('|')})(?![a-zA-Z0-9-])`,
  'g'
);

async function getFiles(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}

async function optimizeColors() {
  try {
    const allFiles = await getFiles(path.join(__dirname, 'frontend'));
    const targetFiles = allFiles.filter(f => f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.js'));

    const concurrencyLimit = 10;
    for (let i = 0; i < targetFiles.length; i += concurrencyLimit) {
      const chunk = targetFiles.slice(i, i + concurrencyLimit);
      await Promise.all(chunk.map(async (file) => {
        try {
          const content = await fs.readFile(file, 'utf8');
          const optimizedContent = content.replace(pattern, match => replacements[match]);
          
          if (content !== optimizedContent) {
            await fs.writeFile(file, optimizedContent);
            console.log(`Updated ${path.relative(__dirname, file)}`);
          }
        } catch (err) {
          console.error(`Failed to process ${file}:`, err.message);
        }
      }));
    }
  } catch (err) {
    console.error('Fatal error during optimization:', err);
  }
}

optimizeColors();
