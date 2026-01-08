#!/usr/bin/env node

/**
 * Create App in App Store Connect
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const API_BASE_URL = 'https://api.appstoreconnect.apple.com/v1';

function getToken() {
  const issuerId = process.env.ASC_ISSUER_ID;
  const keyId = process.env.ASC_KEY_ID;
  let privateKey = process.env.ASC_PRIVATE_KEY;

  if (privateKey.endsWith('.p8') || privateKey.startsWith('./')) {
    const keyPath = path.resolve(__dirname, '..', privateKey);
    privateKey = fs.readFileSync(keyPath, 'utf-8');
  }

  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' },
    privateKey,
    { algorithm: 'ES256', header: { alg: 'ES256', kid: keyId, typ: 'JWT' } }
  );
}

async function request(method, urlPath, body) {
  const token = getToken();
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${API_BASE_URL}${urlPath}`, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.errors?.[0]?.detail || response.statusText);
  }
  return data;
}

async function main() {
  const bundleId = 'com.trackspeed.app';
  const appName = 'Track Speed';
  const sku = 'trackspeed001';
  const primaryLocale = 'en-US';

  console.log('🔑 Connecting to App Store Connect...\n');

  // Step 1: Check if bundle ID exists
  console.log('📦 Checking bundle ID registration...');
  let bundleIdResource;

  try {
    const bundleIds = await request('GET', `/bundleIds?filter[identifier]=${bundleId}`);
    bundleIdResource = bundleIds.data?.[0];

    if (bundleIdResource) {
      console.log(`   ✅ Bundle ID already registered: ${bundleIdResource.id}`);
    }
  } catch (e) {
    console.log(`   Bundle ID not found, will register...`);
  }

  // Step 2: Register bundle ID if needed
  if (!bundleIdResource) {
    console.log('📝 Registering bundle ID...');
    try {
      const result = await request('POST', '/bundleIds', {
        data: {
          type: 'bundleIds',
          attributes: {
            identifier: bundleId,
            name: appName,
            platform: 'IOS',
          },
        },
      });
      bundleIdResource = result.data;
      console.log(`   ✅ Bundle ID registered: ${bundleIdResource.id}`);
    } catch (e) {
      console.error(`   ❌ Failed to register bundle ID: ${e.message}`);
      console.log('\n   You may need to register it manually at:');
      console.log('   https://developer.apple.com/account/resources/identifiers/add/bundleId');
      process.exit(1);
    }
  }

  // Step 3: Check if app already exists
  console.log('\n📱 Checking if app exists...');
  try {
    const apps = await request('GET', `/apps?filter[bundleId]=${bundleId}`);
    if (apps.data?.length > 0) {
      console.log(`   ✅ App already exists!`);
      console.log(`   Name: ${apps.data[0].attributes.name}`);
      console.log(`   ID: ${apps.data[0].id}`);
      return;
    }
  } catch (e) {
    // App doesn't exist, continue
  }

  // Step 4: Create the app
  console.log('\n🚀 Creating app in App Store Connect...');
  try {
    const result = await request('POST', '/apps', {
      data: {
        type: 'apps',
        attributes: {
          name: appName,
          primaryLocale: primaryLocale,
          sku: sku,
          bundleId: bundleId,
        },
        relationships: {
          bundleId: {
            data: {
              type: 'bundleIds',
              id: bundleIdResource.id,
            },
          },
        },
      },
    });

    console.log(`\n✅ App created successfully!`);
    console.log(`   Name: ${result.data.attributes.name}`);
    console.log(`   Bundle ID: ${bundleId}`);
    console.log(`   App ID: ${result.data.id}`);
    console.log(`   SKU: ${sku}`);
    console.log(`\n🎉 Track Speed is now in App Store Connect!`);
    console.log(`   View at: https://appstoreconnect.apple.com/apps/${result.data.id}`);

  } catch (e) {
    console.error(`\n❌ Failed to create app: ${e.message}`);

    if (e.message.includes('already exists') || e.message.includes('has already been taken')) {
      console.log('\n   The app name or SKU may already be in use.');
      console.log('   Try creating manually at: https://appstoreconnect.apple.com');
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
