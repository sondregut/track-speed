#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

function getToken() {
  const issuerId = process.env.ASC_ISSUER_ID;
  const keyId = process.env.ASC_KEY_ID;
  let privateKey = process.env.ASC_PRIVATE_KEY;

  if (privateKey.endsWith('.p8') || privateKey.startsWith('./')) {
    privateKey = fs.readFileSync(path.resolve(__dirname, '..', privateKey), 'utf-8');
  }

  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' },
    privateKey,
    { algorithm: 'ES256', header: { alg: 'ES256', kid: keyId, typ: 'JWT' } }
  );
}

async function main() {
  console.log('🔑 Fetching registered bundle IDs...\n');

  const response = await fetch('https://api.appstoreconnect.apple.com/v1/bundleIds?limit=50', {
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  const data = await response.json();

  if (!data.data?.length) {
    console.log('No bundle IDs registered in this account.');
    return;
  }

  console.log('📦 Registered Bundle IDs:\n');
  for (const bundle of data.data) {
    console.log(`  ${bundle.attributes.name}`);
    console.log(`     Identifier: ${bundle.attributes.identifier}`);
    console.log(`     Platform: ${bundle.attributes.platform}`);
    console.log(`     ID: ${bundle.id}`);
    console.log('');
  }
}

main().catch(console.error);
