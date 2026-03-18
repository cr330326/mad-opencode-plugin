/**
 * Simple verification script for MAD OpenCode Plugin
 *
 * This script verifies the plugin can be imported and has the correct structure
 * without requiring a running MAD Server.
 */

import { MadPlugin } from './dist/index.js';

console.log('✅ Plugin imported successfully');

// Verify the plugin is a function
if (typeof MadPlugin !== 'function') {
  console.error('❌ MadPlugin is not a function');
  process.exit(1);
}
console.log('✅ MadPlugin is a function');

// Mock input to test plugin initialization
const mockInput = {
  directory: '/test/project',
  project: 'test-project',
};

// Test plugin initialization (without actually connecting to server)
console.log('\n📦 Testing plugin initialization...');

// Set environment variables for testing
process.env.MAD_SERVER_URL = 'http://localhost:3000';
process.env.MAD_API_KEY = 'test-key';
process.env.MAD_CLIENT_NAME = 'test-client';
process.env.MAD_DEBUG = '1';

try {
  const hooks = await MadPlugin(mockInput);
  console.log('✅ Plugin initialized successfully');

  // Verify hooks object structure
  if (!hooks || typeof hooks !== 'object') {
    console.error('❌ Hooks is not an object');
    process.exit(1);
  }
  console.log('✅ Hooks object returned');

  // Verify required hooks exist
  const requiredHooks = ['event', 'chat.message', 'tool.execute.after'];
  for (const hookName of requiredHooks) {
    if (typeof hooks[hookName] !== 'function') {
      console.error(`❌ Missing hook: ${hookName}`);
      process.exit(1);
    }
    console.log(`✅ Hook '${hookName}' exists`);
  }

  console.log('\n🎉 All verification tests passed!');
  console.log('\n📝 Plugin structure verified:');
  console.log('  - Plugin exports: ✓');
  console.log('  - Plugin initialization: ✓');
  console.log('  - Hook registration: ✓');
  console.log('  - Required hooks (event, chat.message, tool.execute.after): ✓');

} catch (error) {
  console.error('❌ Plugin initialization failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
