#!/usr/bin/env node
/**
 * COMMS_TODO Watcher
 * 
 * Monitors .ai/COMMS_TODO.md for tasks with Status=READY
 * Checks every 20 seconds and logs found tasks
 */

const { readFileSync } = require('fs');
const { join } = require('path');

const TODO_FILE = join(process.cwd(), '.ai', 'COMMS_TODO.md');
const CHECK_INTERVAL = 20000; // 20 seconds

function parseTasks(content) {
  const tasks = [];
  const taskRegex = /### (T\d+) — (.+?)\nStatus: (\w+)([\s\S]*?)(?=###|$)/g;
  
  let match;
  while ((match = taskRegex.exec(content)) !== null) {
    const [, id, title, status, details] = match;
    const task = { id, title: title.trim(), status };
    
    // Parse details
    const ownerMatch = details.match(/Owner:\s*(.+)/);
    if (ownerMatch) task.owner = ownerMatch[1].trim();
    
    const scopeMatch = details.match(/Scope:\s*([\s\S]*?)(?=Acceptance:|$)/);
    if (scopeMatch) {
      task.scope = scopeMatch[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line.startsWith('-'))
        .map(line => line.substring(1).trim());
    }
    
    const acceptanceMatch = details.match(/Acceptance:\s*([\s\S]*?)(?=Commit:|$)/);
    if (acceptanceMatch) {
      task.acceptance = acceptanceMatch[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line.startsWith('-'))
        .map(line => line.substring(1).trim());
    }
    
    tasks.push(task);
  }
  
  return tasks;
}

function readTodoFile() {
  try {
    return readFileSync(TODO_FILE, 'utf-8');
  } catch (error) {
    console.error(`❌ Error reading ${TODO_FILE}:`, error.message);
    return null;
  }
}

function checkTasks() {
  const content = readTodoFile();
  if (!content) return;
  
  const tasks = parseTasks(content);
  const readyTasks = tasks.filter(t => t.status === 'READY');
  
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  if (readyTasks.length > 0) {
    console.log(`\n🔔 [${timestamp}] Found ${readyTasks.length} READY task(s):`);
    readyTasks.forEach(task => {
      console.log(`\n  📋 ${task.id} — ${task.title}`);
      if (task.owner) console.log(`     Owner: ${task.owner}`);
      if (task.scope && task.scope.length > 0) {
        console.log(`     Scope:`);
        task.scope.forEach(item => console.log(`       - ${item}`));
      }
    });
    console.log('\n');
  } else {
    // Silent mode - only log when tasks found
    // Uncomment next line for verbose logging:
    // console.log(`[${timestamp}] No READY tasks found`);
  }
}

function main() {
  console.log('🚀 COMMS_TODO Watcher started');
  console.log(`📁 Watching: ${TODO_FILE}`);
  console.log(`⏱️  Check interval: ${CHECK_INTERVAL / 1000} seconds`);
  console.log('Press Ctrl+C to stop\n');
  
  // Initial check
  checkTasks();
  
  // Check periodically
  setInterval(checkTasks, CHECK_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Watcher stopped');
  process.exit(0);
});

main();

