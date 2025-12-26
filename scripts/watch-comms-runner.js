#!/usr/bin/env node
/**
 * Runner COMMS Watcher
 * 
 * Monitors .ai/COMMS_TODO.md for tasks with Status=READY and Owner=Runner/Architect
 * Checks every 20 seconds and logs found tasks
 */

const { readFileSync } = require('fs');
const { join } = require('path');

const TODO_FILE = join(process.cwd(), '.ai', 'COMMS_TODO.md');
const CHECK_INTERVAL = 20000; // 20 seconds

const RUNNER_OWNERS = ['Runner', 'Architect', 'Architect/Orchestrator'];

let lastTaskIds = new Set();

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
  const readyTasks = tasks.filter(t => 
    t.status === 'READY' && 
    t.owner && 
    RUNNER_OWNERS.some(owner => t.owner === owner || t.owner.includes(owner))
  );
  
  // De-dup: only print if task IDs changed
  const currentTaskIds = new Set(readyTasks.map(t => t.id));
  const idsChanged = 
    currentTaskIds.size !== lastTaskIds.size ||
    [...currentTaskIds].some(id => !lastTaskIds.has(id));
  
  if (!idsChanged) return; // No change, stay silent
  
  lastTaskIds = currentTaskIds;
  
  if (readyTasks.length > 0) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`\n🔔 [${timestamp}] Found ${readyTasks.length} READY task(s) for Runner:`);
    readyTasks.forEach(task => {
      console.log(`\n  📋 ${task.id} — ${task.title}`);
      if (task.owner) console.log(`     Owner: ${task.owner}`);
      if (task.scope && task.scope.length > 0) {
        console.log(`     Scope:`);
        task.scope.forEach(item => console.log(`       - ${item}`));
      }
    });
    console.log('\n');
  }
}

function main() {
  console.log('🚀 Runner COMMS watcher started');
  console.log(`📁 Watching: ${TODO_FILE}`);
  console.log(`⏱️  Interval: 20s`);
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

