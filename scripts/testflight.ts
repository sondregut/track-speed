#!/usr/bin/env npx ts-node

/**
 * TestFlight Automation CLI
 *
 * Usage:
 *   npx ts-node scripts/testflight.ts <command> [options]
 *
 * Commands:
 *   list-builds          List recent builds
 *   list-groups          List beta groups
 *   list-testers         List beta testers
 *   create-group         Create a beta group
 *   invite-tester        Invite a tester
 *   distribute           Distribute build to group
 *
 * Environment variables required:
 *   ASC_ISSUER_ID        App Store Connect Issuer ID
 *   ASC_KEY_ID           API Key ID
 *   ASC_PRIVATE_KEY      Private key contents (or path to .p8 file)
 *   ASC_BUNDLE_ID        Bundle ID (default: com.trackspeed.app)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Dynamic import for the API client (ESM compatibility)
async function main() {
  const { AppStoreConnectClient } = await import('../src/lib/appstore/index.js');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  // Load configuration from environment
  const config = loadConfig();
  const client = new AppStoreConnectClient(config);

  // Get app ID
  const bundleId = process.env.ASC_BUNDLE_ID || 'com.trackspeed.app';
  const app = await client.getAppByBundleId(bundleId);

  if (!app) {
    console.error(`Error: App with bundle ID "${bundleId}" not found`);
    process.exit(1);
  }

  console.log(`\n📱 App: ${app.attributes.name} (${bundleId})\n`);

  // Execute command
  try {
    switch (command) {
      case 'list-builds':
        await listBuilds(client, app.id);
        break;

      case 'list-groups':
        await listGroups(client, app.id);
        break;

      case 'list-testers':
        await listTesters(client);
        break;

      case 'create-group':
        await createGroup(client, app.id, args.slice(1));
        break;

      case 'invite-tester':
        await inviteTester(client, args.slice(1));
        break;

      case 'distribute':
        await distributeBuild(client, app.id, args.slice(1));
        break;

      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
TestFlight Automation CLI

Usage:
  npx ts-node scripts/testflight.ts <command> [options]

Commands:
  list-builds                    List recent builds
  list-groups                    List beta groups
  list-testers                   List beta testers
  create-group <name>            Create a beta group
  invite-tester <email> <group>  Invite a tester to a group
  distribute <build> <group>     Distribute build to group

Environment Variables:
  ASC_ISSUER_ID      App Store Connect Issuer ID
  ASC_KEY_ID         API Key ID
  ASC_PRIVATE_KEY    Private key contents or path to .p8 file
  ASC_BUNDLE_ID      Bundle ID (default: com.trackspeed.app)

Examples:
  # List all builds
  npx ts-node scripts/testflight.ts list-builds

  # Create a beta group
  npx ts-node scripts/testflight.ts create-group "External Testers"

  # Invite a tester
  npx ts-node scripts/testflight.ts invite-tester user@example.com "External Testers"

  # Distribute latest build to a group
  npx ts-node scripts/testflight.ts distribute latest "External Testers"
`);
}

function loadConfig() {
  const issuerId = process.env.ASC_ISSUER_ID;
  const keyId = process.env.ASC_KEY_ID;
  let privateKey = process.env.ASC_PRIVATE_KEY;

  if (!issuerId || !keyId || !privateKey) {
    console.error('Error: Missing required environment variables');
    console.error('Required: ASC_ISSUER_ID, ASC_KEY_ID, ASC_PRIVATE_KEY');
    process.exit(1);
  }

  // Check if privateKey is a file path
  if (privateKey.endsWith('.p8') || privateKey.includes('/')) {
    const keyPath = path.resolve(privateKey);
    if (fs.existsSync(keyPath)) {
      privateKey = fs.readFileSync(keyPath, 'utf-8');
    }
  }

  return { issuerId, keyId, privateKey };
}

async function listBuilds(client: any, appId: string) {
  console.log('📦 Recent Builds:\n');

  const response = await client.listBuilds(appId, { limit: 10 });

  if (response.data.length === 0) {
    console.log('No builds found');
    return;
  }

  for (const build of response.data) {
    const state = build.attributes.processingState;
    const icon = state === 'VALID' ? '✅' : state === 'PROCESSING' ? '⏳' : '❌';
    const date = new Date(build.attributes.uploadedDate).toLocaleDateString();

    console.log(
      `  ${icon} v${build.attributes.version} (${build.id.slice(0, 8)})`
    );
    console.log(`     State: ${state}`);
    console.log(`     Uploaded: ${date}`);
    console.log(`     Min OS: ${build.attributes.minOsVersion}`);
    console.log('');
  }
}

async function listGroups(client: any, appId: string) {
  console.log('👥 Beta Groups:\n');

  const response = await client.listBetaGroups(appId);

  if (response.data.length === 0) {
    console.log('No beta groups found');
    return;
  }

  for (const group of response.data) {
    const type = group.attributes.isInternalGroup ? 'Internal' : 'External';
    const publicLink = group.attributes.publicLinkEnabled ? '🔗' : '';

    console.log(`  ${publicLink} ${group.attributes.name} (${type})`);
    console.log(`     ID: ${group.id}`);
    if (group.attributes.publicLink) {
      console.log(`     Public Link: ${group.attributes.publicLink}`);
    }
    console.log('');
  }
}

async function listTesters(client: any) {
  console.log('🧑‍💻 Beta Testers:\n');

  const response = await client.listBetaTesters({ limit: 50 });

  if (response.data.length === 0) {
    console.log('No testers found');
    return;
  }

  for (const tester of response.data) {
    const name = [tester.attributes.firstName, tester.attributes.lastName]
      .filter(Boolean)
      .join(' ') || 'Unknown';
    const state = tester.attributes.state;
    const icon =
      state === 'INSTALLED'
        ? '✅'
        : state === 'ACCEPTED'
        ? '📱'
        : state === 'INVITED'
        ? '📧'
        : '⏳';

    console.log(`  ${icon} ${name} <${tester.attributes.email}>`);
    console.log(`     Status: ${state}`);
    console.log('');
  }
}

async function createGroup(client: any, appId: string, args: string[]) {
  const name = args[0];

  if (!name) {
    console.error('Error: Group name required');
    console.error('Usage: create-group <name>');
    process.exit(1);
  }

  console.log(`Creating beta group: ${name}...`);

  const response = await client.createBetaGroup(appId, name, {
    isInternalGroup: false,
    hasAccessToAllBuilds: false,
    publicLinkEnabled: true,
    feedbackEnabled: true,
  });

  console.log(`\n✅ Beta group created!`);
  console.log(`   ID: ${response.data.id}`);
  console.log(`   Name: ${response.data.attributes.name}`);

  if (response.data.attributes.publicLink) {
    console.log(`   Public Link: ${response.data.attributes.publicLink}`);
  }
}

async function inviteTester(client: any, args: string[]) {
  const email = args[0];
  const groupName = args.slice(1).join(' ');

  if (!email || !groupName) {
    console.error('Error: Email and group name required');
    console.error('Usage: invite-tester <email> <group-name>');
    process.exit(1);
  }

  // Find the group by name
  const bundleId = process.env.ASC_BUNDLE_ID || 'com.trackspeed.app';
  const app = await client.getAppByBundleId(bundleId);
  const groups = await client.listBetaGroups(app!.id);
  const group = groups.data.find(
    (g: any) => g.attributes.name.toLowerCase() === groupName.toLowerCase()
  );

  if (!group) {
    console.error(`Error: Beta group "${groupName}" not found`);
    process.exit(1);
  }

  console.log(`Inviting ${email} to ${groupName}...`);

  const response = await client.inviteBetaTester(email, group.id);

  console.log(`\n✅ Invitation sent!`);
  console.log(`   Email: ${response.data.attributes.email}`);
  console.log(`   Status: ${response.data.attributes.state}`);
}

async function distributeBuild(client: any, appId: string, args: string[]) {
  const buildArg = args[0];
  const groupName = args.slice(1).join(' ');

  if (!buildArg || !groupName) {
    console.error('Error: Build and group name required');
    console.error('Usage: distribute <build-id|latest> <group-name>');
    process.exit(1);
  }

  // Get build
  let buildId: string;
  if (buildArg === 'latest') {
    const latest = await client.getLatestBuild(appId);
    if (!latest) {
      console.error('Error: No valid builds found');
      process.exit(1);
    }
    buildId = latest.id;
    console.log(`Using latest build: v${latest.attributes.version}`);
  } else {
    buildId = buildArg;
  }

  // Find the group
  const groups = await client.listBetaGroups(appId);
  const group = groups.data.find(
    (g: any) => g.attributes.name.toLowerCase() === groupName.toLowerCase()
  );

  if (!group) {
    console.error(`Error: Beta group "${groupName}" not found`);
    process.exit(1);
  }

  console.log(`Distributing build to ${groupName}...`);

  await client.addBuildToBetaGroup(group.id, buildId);

  console.log(`\n✅ Build distributed!`);
  console.log(`   Build ID: ${buildId}`);
  console.log(`   Group: ${group.attributes.name}`);
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
