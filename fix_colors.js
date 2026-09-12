const fs = require('fs');
const files = [
  'frontend/app/page.tsx',
  'frontend/app/layout.tsx',
  'frontend/components/actions/ActionBoard.tsx',
  'frontend/components/actions/ActionRow.tsx',
  'frontend/components/review/ProposedItemCard.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/border-black/g, 'border-border');
  content = content.replace(/bg-white/g, 'bg-card');
  content = content.replace(/bg-black/g, 'bg-foreground');
  content = content.replace(/text-black/g, 'text-foreground');
  content = content.replace(/text-white/g, 'text-background');
  content = content.replace(/bg-muted\/20/g, 'bg-muted');
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
}
