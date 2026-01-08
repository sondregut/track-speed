#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const API_BASE_URL = 'https://api.appstoreconnect.apple.com/v1';

async function main() {
  const issuerId = process.env.ASC_ISSUER_ID;
  const keyId = process.env.ASC_KEY_ID;
  let privateKey = process.env.ASC_PRIVATE_KEY;

  if (privateKey.endsWith('.p8') || privateKey.startsWith('./')) {
    const keyPath = path.resolve(__dirname, '..', privateKey);
    privateKey = fs.readFileSync(keyPath, 'utf-8');
  }

  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' },
    privateKey,
    { algorithm: 'ES256', header: { alg: 'ES256', kid: keyId, typ: 'JWT' } }
  );

  console.log('🔑 Connecting to App Store Connect...\n');

  const response = await fetch(`${API_BASE_URL}/apps`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Error:', error.errors?.[0]?.detail || response.statusText);
    process.exit(1);
  }

  const data = await response.json();

  console.log('📱 Your Apps:\n');

  if (!data.data?.length) {
    console.log('No apps found. You need to create the app in App Store Connect first.');
    console.log('\nTo create the app:');
    console.log('1. Go to https://appstoreconnect.apple.com');
    console.log('2. Click "My Apps" → "+" → "New App"');
    console.log('3. Enter: Name "Track Speed", Bundle ID "com.trackspeed.app"');
    return;
  }

  for (const app of data.data) {
    console.log(`  ${app.attributes.name}`);
    console.log(`     Bundle ID: ${app.attributes.bundleId}`);
    console.log(`     ID: ${app.id}`);
    console.log('');
  }
}

main().catch(console.error);
