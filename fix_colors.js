const fs = require('fs').promises;

const files = [
  'frontend/app/page.tsx',
  'frontend/app/layout.tsx',
  'frontend/components/actions/ActionBoard.tsx',
  'frontend/components/actions/ActionRow.tsx',
  'frontend/components/review/ProposedItemCard.tsx'
];

const replacements = {
  'border-black': 'border-border',
  'bg-white': 'bg-card',
  'bg-black': 'bg-foreground',
  'text-black': 'text-foreground',
  'text-white': 'text-background',
  'bg-muted/20': 'bg-muted'
};

// Escape regex characters and create a single unified pattern
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp(Object.keys(replacements).map(escapeRegExp).join('|'), 'g');

async function optimizeColors() {
  try {
    // Process all files concurrently
    await Promise.all(files.map(async (file) => {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Single pass replacement reduces memory allocations
        const optimizedContent = content.replace(pattern, match => replacements[match]);
        
        // Only perform disk I/O if the file actually changed
        if (content !== optimizedContent) {
          await fs.writeFile(file, optimizedContent);
          console.log(`Updated ${file}`);
        } else {
          console.log(`No changes needed in ${file}`);
        }
      } catch (err) {
        console.error(`Failed to process ${file}:`, err.message);
      }
    }));
  } catch (err) {
    console.error('Fatal error during optimization:', err);
  }
}

optimizeColors();
