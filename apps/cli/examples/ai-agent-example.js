#!/usr/bin/env node

/**
 * Example: Using Trelexa CLI from an AI Agent (Node.js)
 *
 * This demonstrates how AI agents can programmatically use the Trelexa CLI
 * to schedule social media posts.
 */

const { execSync } = require('child_process');

// Configuration
const TRELEXA_API_KEY = process.env.TRELEXA_API_KEY;

if (!TRELEXA_API_KEY) {
  console.error('❌ TRELEXA_API_KEY environment variable is required');
  process.exit(1);
}

/**
 * Execute a Trelexa CLI command
 */
function runTrelexaCommand(command) {
  try {
    const output = execSync(`trelexa ${command}`, {
      env: { ...process.env, TRELEXA_API_KEY },
      encoding: 'utf-8',
    });
    return JSON.parse(output);
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(error.message);
    throw error;
  }
}

/**
 * Main AI Agent workflow
 */
async function main() {
  console.log('🤖 AI Agent: Starting social media scheduling workflow...\n');

  try {
    // Step 1: Get available integrations
    console.log('📋 Fetching connected integrations...');
    const integrations = runTrelexaCommand('integrations:list');
    console.log(`Found ${integrations.length || 0} integrations\n`);

    // Step 2: Create multiple scheduled posts
    const posts = [
      {
        content: '🌅 Good morning! Starting the day with positive energy.',
        schedule: getScheduledTime(9, 0), // 9 AM
      },
      {
        content: '☕ Midday motivation: Keep pushing towards your goals!',
        schedule: getScheduledTime(12, 0), // 12 PM
      },
      {
        content: '🌙 Evening reflection: What did you accomplish today?',
        schedule: getScheduledTime(20, 0), // 8 PM
      },
    ];

    console.log('📝 Creating scheduled posts...');
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      console.log(`  ${i + 1}. Creating post scheduled for ${post.schedule}...`);

      const command = `posts:create -c "${post.content}" -s "${post.schedule}"`;
      const result = runTrelexaCommand(command);

      console.log(`  ✅ Post created with ID: ${result.id || 'unknown'}`);
    }

    console.log('\n📊 Checking created posts...');
    const postsList = runTrelexaCommand('posts:list -l 5');
    console.log(`Total recent posts: ${postsList.total || 0}\n`);

    console.log('✅ AI Agent workflow completed successfully!');
  } catch (error) {
    console.error('\n❌ AI Agent workflow failed:', error.message);
    process.exit(1);
  }
}

/**
 * Helper: Get ISO 8601 timestamp for today at specific time
 */
function getScheduledTime(hours, minutes) {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  // If time already passed today, schedule for tomorrow
  if (date < new Date()) {
    date.setDate(date.getDate() + 1);
  }

  return date.toISOString();
}

// Run the agent
main().catch(console.error);
