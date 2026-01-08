#!/usr/bin/env node

/**
 * TestFlight Automation CLI
 *
 * Usage:
 *   node scripts/testflight.js <command> [options]
 *
 * Commands:
 *   list-builds          List recent builds
 *   list-groups          List beta groups
 *   list-testers         List beta testers
 *   create-group         Create a beta group
 *   invite-tester        Invite a tester
 *   distribute           Distribute build to group
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const API_BASE_URL = 'https://api.appstoreconnect.apple.com/v1';

// ============================================
// API Client
// ============================================

class AppStoreConnectClient {
  constructor(config) {
    this.config = config;
    this.token = null;
    this.tokenExpiry = 0;
  }

  generateToken() {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 20 * 60;

    const payload = {
      iss: this.config.issuerId,
      iat: now,
      exp: expiry,
      aud: 'appstoreconnect-v1',
    };

    const token = jwt.sign(payload, this.config.privateKey, {
      algorithm: 'ES256',
      header: {
        alg: 'ES256',
        kid: this.config.keyId,
        typ: 'JWT',
      },
    });

    this.token = token;
    this.tokenExpiry = expiry;
    return token;
  }

  getToken() {
    const now = Math.floor(Date.now() / 1000);
    if (!this.token || now >= this.tokenExpiry - 60) {
      return this.generateToken();
    }
    return this.token;
  }

  async request(method, urlPath, body) {
    const url = `${API_BASE_URL}${urlPath}`;
    const token = this.getToken();

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const errorMessage = errorBody.errors?.[0]?.detail || response.statusText;
      throw new Error(`API Error: ${errorMessage}`);
    }

    if (response.status === 204) return {};
    return response.json();
  }

  async get(urlPath) {
    return this.request('GET', urlPath);
  }

  async post(urlPath, body) {
    return this.request('POST', urlPath, body);
  }

  // Apps
  async getAppByBundleId(bundleId) {
    const response = await this.get(`/apps?filter[bundleId]=${bundleId}`);
    return response.data?.[0] || null;
  }

  // Builds
  async listBuilds(appId, options = {}) {
    let urlPath = `/builds?filter[app]=${appId}`;
    if (options.limit) urlPath += `&limit=${options.limit}`;
    if (options.processingState) urlPath += `&filter[processingState]=${options.processingState}`;
    return this.get(urlPath);
  }

  async getLatestBuild(appId) {
    const response = await this.listBuilds(appId, { limit: 1, processingState: 'VALID' });
    return response.data?.[0] || null;
  }

  // Beta Groups
  async listBetaGroups(appId) {
    return this.get(`/betaGroups?filter[app]=${appId}`);
  }

  async createBetaGroup(appId, name, options = {}) {
    return this.post('/betaGroups', {
      data: {
        type: 'betaGroups',
        attributes: {
          name,
          isInternalGroup: options.isInternalGroup ?? false,
          hasAccessToAllBuilds: options.hasAccessToAllBuilds ?? false,
          publicLinkEnabled: options.publicLinkEnabled ?? false,
          feedbackEnabled: options.feedbackEnabled ?? true,
        },
        relationships: {
          app: { data: { type: 'apps', id: appId } },
        },
      },
    });
  }

  async addBuildToBetaGroup(betaGroupId, buildId) {
    return this.post(`/betaGroups/${betaGroupId}/relationships/builds`, {
      data: [{ type: 'builds', id: buildId }],
    });
  }

  // Beta Testers
  async listBetaTesters(options = {}) {
    let urlPath = '/betaTesters';
    const params = [];
    if (options.email) params.push(`filter[email]=${options.email}`);
    if (options.limit) params.push(`limit=${options.limit}`);
    if (params.length > 0) urlPath += `?${params.join('&')}`;
    return this.get(urlPath);
  }

  async inviteBetaTester(email, betaGroupId, options = {}) {
    return this.post('/betaTesters', {
      data: {
        type: 'betaTesters',
        attributes: {
          email,
          firstName: options.firstName,
          lastName: options.lastName,
        },
        relationships: {
          betaGroups: { data: [{ type: 'betaGroups', id: betaGroupId }] },
        },
      },
    });
  }
}

// ============================================
// Commands
// ============================================

async function listBuilds(client, appId) {
  console.log('📦 Recent Builds:\n');

  const response = await client.listBuilds(appId, { limit: 10 });

  if (!response.data?.length) {
    console.log('No builds found');
    return;
  }

  for (const build of response.data) {
    const state = build.attributes.processingState;
    const icon = state === 'VALID' ? '✅' : state === 'PROCESSING' ? '⏳' : '❌';
    const date = new Date(build.attributes.uploadedDate).toLocaleDateString();

    console.log(`  ${icon} v${build.attributes.version} (${build.id.slice(0, 8)})`);
    console.log(`     State: ${state}`);
    console.log(`     Uploaded: ${date}`);
    console.log(`     Min OS: ${build.attributes.minOsVersion}`);
    console.log('');
  }
}

async function listGroups(client, appId) {
  console.log('👥 Beta Groups:\n');

  const response = await client.listBetaGroups(appId);

  if (!response.data?.length) {
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

async function listTesters(client) {
  console.log('🧑‍💻 Beta Testers:\n');

  const response = await client.listBetaTesters({ limit: 50 });

  if (!response.data?.length) {
    console.log('No testers found');
    return;
  }

  for (const tester of response.data) {
    const name = [tester.attributes.firstName, tester.attributes.lastName]
      .filter(Boolean)
      .join(' ') || 'Unknown';
    const state = tester.attributes.state;
    const icon = state === 'INSTALLED' ? '✅' : state === 'ACCEPTED' ? '📱' : state === 'INVITED' ? '📧' : '⏳';

    console.log(`  ${icon} ${name} <${tester.attributes.email}>`);
    console.log(`     Status: ${state}`);
    console.log('');
  }
}

async function createGroup(client, appId, args) {
  const name = args[0];

  if (!name) {
    console.error('Error: Group name required');
    console.error('Usage: create-group <name>');
    process.exit(1);
  }

  console.log(`Creating beta group: ${name}...`);

  const response = await client.createBetaGroup(appId, name, {
    isInternalGroup: false,
    publicLinkEnabled: true,
    feedbackEnabled: true,
  });

  console.log(`\n✅ Beta group created!`);
  console.log(`   ID: ${response.data.id}`);
  console.log(`   Name: ${response.data.attributes.name}`);
}

async function inviteTester(client, appId, args) {
  const email = args[0];
  const groupName = args.slice(1).join(' ');

  if (!email || !groupName) {
    console.error('Error: Email and group name required');
    console.error('Usage: invite-tester <email> <group-name>');
    process.exit(1);
  }

  const groups = await client.listBetaGroups(appId);
  const group = groups.data?.find(
    (g) => g.attributes.name.toLowerCase() === groupName.toLowerCase()
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

async function distributeBuild(client, appId, args) {
  const buildArg = args[0];
  const groupName = args.slice(1).join(' ');

  if (!buildArg || !groupName) {
    console.error('Error: Build and group name required');
    console.error('Usage: distribute <build-id|latest> <group-name>');
    process.exit(1);
  }

  let buildId;
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

  const groups = await client.listBetaGroups(appId);
  const group = groups.data?.find(
    (g) => g.attributes.name.toLowerCase() === groupName.toLowerCase()
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

// ============================================
// Main
// ============================================

function printHelp() {
  console.log(`
TestFlight Automation CLI

Usage:
  node scripts/testflight.js <command> [options]

Commands:
  list-builds                    List recent builds
  list-groups                    List beta groups
  list-testers                   List beta testers
  create-group <name>            Create a beta group
  invite-tester <email> <group>  Invite a tester to a group
  distribute <build> <group>     Distribute build to group

Examples:
  node scripts/testflight.js list-builds
  node scripts/testflight.js create-group "External Testers"
  node scripts/testflight.js invite-tester user@example.com "External Testers"
  node scripts/testflight.js distribute latest "External Testers"
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

  // Load key from file if path provided
  if (privateKey.endsWith('.p8') || privateKey.startsWith('./') || privateKey.startsWith('/')) {
    const keyPath = path.resolve(__dirname, '..', privateKey);
    if (fs.existsSync(keyPath)) {
      privateKey = fs.readFileSync(keyPath, 'utf-8');
    } else {
      console.error(`Error: Key file not found: ${keyPath}`);
      process.exit(1);
    }
  }

  return { issuerId, keyId, privateKey };
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  const config = loadConfig();
  const client = new AppStoreConnectClient(config);

  const bundleId = process.env.ASC_BUNDLE_ID || 'com.trackspeed.app';

  console.log(`\n🔑 Connecting to App Store Connect...`);

  const app = await client.getAppByBundleId(bundleId);

  if (!app) {
    console.error(`Error: App with bundle ID "${bundleId}" not found`);
    process.exit(1);
  }

  console.log(`📱 App: ${app.attributes.name} (${bundleId})\n`);

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
        await inviteTester(client, app.id, args.slice(1));
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
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
