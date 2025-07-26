#!/usr/bin/env node

/**
 * Documentation Integrity Checker
 * 
 * This script ensures all documentation files are properly linked
 * and no orphaned files exist in the docs directory.
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const ALLOWED_UNLINKED = [
  'README.md', // Index files themselves don't need to be linked
  '.DS_Store',  // macOS system files
];

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Track all markdown files and their references
const allMarkdownFiles = new Set();
const referencedFiles = new Set();
const indexFiles = [];

/**
 * Recursively find all markdown files in a directory
 */
function findMarkdownFiles(dir, baseDir = DOCS_DIR) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const relativePath = path.relative(baseDir, fullPath);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findMarkdownFiles(fullPath, baseDir);
    } else if (file.endsWith('.md')) {
      allMarkdownFiles.add(relativePath);
      
      // Track index files
      if (file === 'README.md' || file === 'index.md') {
        indexFiles.push(fullPath);
      }
    }
  }
}

/**
 * Extract markdown links from content
 */
function extractMarkdownLinks(content, currentDir) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = [];
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    const link = match[2];
    
    // Only process relative .md links
    if (link.endsWith('.md') && !link.startsWith('http') && !link.startsWith('#')) {
      // Handle relative paths
      const resolvedPath = path.join(currentDir, link);
      const normalizedPath = path.relative(DOCS_DIR, resolvedPath);
      links.push(normalizedPath);
    }
  }
  
  return links;
}

/**
 * Check all index files for references
 */
function checkIndexFiles() {
  console.log(`${colors.blue}Checking documentation integrity...${colors.reset}\n`);
  
  for (const indexFile of indexFiles) {
    const content = fs.readFileSync(indexFile, 'utf8');
    const currentDir = path.dirname(indexFile);
    const links = extractMarkdownLinks(content, currentDir);
    
    links.forEach(link => {
      // Normalize the path
      const normalizedLink = path.normalize(link).replace(/\\/g, '/');
      referencedFiles.add(normalizedLink);
    });
  }
}

/**
 * Find orphaned files
 */
function findOrphanedFiles() {
  const orphaned = [];
  
  for (const file of allMarkdownFiles) {
    const fileName = path.basename(file);
    
    // Skip files that are allowed to be unlinked
    if (ALLOWED_UNLINKED.includes(fileName)) {
      continue;
    }
    
    // Check if file is referenced
    if (!referencedFiles.has(file) && !file.includes('README.md') && !file.includes('index.md')) {
      orphaned.push(file);
    }
  }
  
  return orphaned;
}

/**
 * Find broken links
 */
function findBrokenLinks() {
  const broken = [];
  
  for (const ref of referencedFiles) {
    if (!allMarkdownFiles.has(ref)) {
      broken.push(ref);
    }
  }
  
  return broken;
}

/**
 * Main execution
 */
function main() {
  try {
    // Find all markdown files
    findMarkdownFiles(DOCS_DIR);
    
    // Check all index files for references
    checkIndexFiles();
    
    // Find issues
    const orphaned = findOrphanedFiles();
    const broken = findBrokenLinks();
    
    // Report results
    console.log(`Total documentation files: ${colors.blue}${allMarkdownFiles.size}${colors.reset}`);
    console.log(`Total referenced files: ${colors.blue}${referencedFiles.size}${colors.reset}`);
    console.log(`Total index files: ${colors.blue}${indexFiles.length}${colors.reset}\n`);
    
    let hasErrors = false;
    
    if (orphaned.length > 0) {
      hasErrors = true;
      console.log(`${colors.red}❌ Found ${orphaned.length} orphaned files:${colors.reset}`);
      orphaned.forEach(file => {
        console.log(`   ${colors.yellow}${file}${colors.reset}`);
      });
      console.log('\nThese files are not referenced in any index file.');
      console.log('Please add them to the appropriate README.md or remove them.\n');
    }
    
    if (broken.length > 0) {
      hasErrors = true;
      console.log(`${colors.red}❌ Found ${broken.length} broken links:${colors.reset}`);
      broken.forEach(file => {
        console.log(`   ${colors.yellow}${file}${colors.reset}`);
      });
      console.log('\nThese links point to non-existent files.');
      console.log('Please fix the links or create the missing files.\n');
    }
    
    if (!hasErrors) {
      console.log(`${colors.green}✅ Documentation integrity check passed!${colors.reset}`);
      console.log('All files are properly linked and no broken references found.\n');
    }
    
    // Exit with error code if issues found
    process.exit(hasErrors ? 1 : 0);
    
  } catch (error) {
    console.error(`${colors.red}Error checking documentation:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Run the script
main();