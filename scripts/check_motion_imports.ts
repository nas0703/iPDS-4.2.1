import fs from 'fs';
import path from 'path';

function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        findFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const files = findFiles('.');
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('motion.') || content.includes('<motion')) {
    if (!content.includes("from 'motion/react'") && !content.includes("from \"motion/react\"") && !content.includes("from 'framer-motion'") && !content.includes("from \"framer-motion\"")) {
       console.log(`MISSING IMPORT IN: ${file}`);
    }
  }
});
