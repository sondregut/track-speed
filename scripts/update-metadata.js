#!/usr/bin/env node

/**
 * Update App Store Connect Metadata for Track Speed
 *
 * This script fills out all the App Store listing information:
 * - App description
 * - Keywords
 * - What's New
 * - Promotional text
 * - Support/Marketing URLs
 * - Privacy Policy
 * - Age Rating
 * - Categories
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const API_BASE_URL = 'https://api.appstoreconnect.apple.com/v1';

// ============================================
// Track Speed App Store Content
// ============================================

const METADATA = {
  // Version-specific content
  description: `Track Speed transforms your iPhone into a professional sprint timing system. Using advanced AI pose detection and your phone's camera, get timing-gate accuracy without expensive equipment.

PROFESSIONAL SPRINT TIMING
- Sub-10ms timing accuracy using AI pose detection
- Automatic torso detection per World Athletics Rule 164
- Works with any camera angle - perpendicular or along the track

MULTIPLE START METHODS
- Sound Detection: Clap or starting gun triggers the timer
- Thumb Start: Solo training mode - lift your thumb to start
- Gate Mode: Use multiple phones for split times

GHOST GATE TECHNOLOGY
- Background calibration for faster, more accurate detection
- Adapts to lighting conditions automatically
- Works outdoors in any weather

TRAINING FEATURES
- Flying starts (10m, 20m, 30m timed zones)
- Standing and block starts
- Series/interval training with rest timers
- Track unlimited athletes and sessions

MULTI-PHONE SYNC
- Connect multiple iPhones for split times
- NTP-style synchronization for precise timing
- Each phone acts as a timing gate

DESIGNED FOR ATHLETES
- Clean, distraction-free interface
- Large timer display visible from distance
- Quick session setup - start timing in seconds
- Export results for coaches and analysis

Perfect for:
- Track & field athletes and coaches
- Sprint training and speed development
- Personal bests and progress tracking
- Team training sessions
- Solo speed workouts

No expensive timing gates. No complicated setup. Just your iPhone and Track Speed.`,

  keywords: 'sprint,timer,running,track,speed,training,stopwatch,coach,athletics,gate,race,workout', // 100 char max

  promotionalText: 'Turn your iPhone into a professional sprint timing system. AI-powered accuracy, no equipment needed.',

  whatsNew: `Initial Release:
- AI-powered torso detection for accurate timing
- Multiple start methods: Sound, Thumb, Gate
- Ghost Gate calibration for improved accuracy
- Flying and standing start modes
- Series training with rest timers
- Multi-phone sync for split times
- Dark and light mode support`,

  supportUrl: 'https://trackspeed.app/support',
  marketingUrl: 'https://trackspeed.app',

  // App info content
  subtitle: 'AI Sprint Timer',
  privacyPolicyUrl: 'https://trackspeed.app/privacy',

  // Age rating - all NONE for a sports timer app
  ageRating: {
    alcoholTobaccoOrDrugUseOrReferences: 'NONE',
    contests: 'NONE',
    gambling: false,
    gamblingSimulated: 'NONE',
    horrorOrFearThemes: 'NONE',
    matureOrSuggestiveThemes: 'NONE',
    medicalOrTreatmentInformation: 'NONE',
    profanityOrCrudeHumor: 'NONE',
    sexualContentGraphicAndNudity: 'NONE',
    sexualContentOrNudity: 'NONE',
    violenceCartoonOrFantasy: 'NONE',
    violenceRealistic: 'NONE',
    violenceRealisticProlongedGraphicOrSadistic: 'NONE',
    unrestrictedWebAccess: false,
  },

  // Categories
  primaryCategory: 'SPORTS', // Sports
  secondaryCategory: 'HEALTH_AND_FITNESS', // Health & Fitness
};

// iOS App Category IDs
const CATEGORY_IDS = {
  SPORTS: 'SPORTS',
  HEALTH_AND_FITNESS: 'HEALTH_AND_FITNESS',
};

// ============================================
// API Helpers
// ============================================

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

  if (response.status === 204) return {};

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = data.errors?.[0];
    throw new Error(error?.detail || error?.title || response.statusText);
  }

  return data;
}

// ============================================
// Main Script
// ============================================

async function main() {
  const bundleId = process.env.ASC_BUNDLE_ID || 'app.trackspeed.ios';

  console.log('🚀 Track Speed - App Store Metadata Update\n');
  console.log('━'.repeat(50));

  // Step 1: Get the app
  console.log('\n📱 Finding app...');
  const appsResponse = await request('GET', `/apps?filter[bundleId]=${bundleId}`);
  const app = appsResponse.data?.[0];

  if (!app) {
    throw new Error(`App not found with bundle ID: ${bundleId}`);
  }

  console.log(`   ✅ Found: ${app.attributes.name} (${app.id})`);

  // Step 2: Get or create App Store version
  console.log('\n📦 Checking App Store versions...');
  const versionsResponse = await request('GET', `/apps/${app.id}/appStoreVersions?filter[platform]=IOS`);
  let version = versionsResponse.data?.find(
    (v) => v.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION'
  );

  if (!version && versionsResponse.data?.length > 0) {
    version = versionsResponse.data[0];
  }

  if (!version) {
    console.log('   Creating version 1.0.0...');
    const createResponse = await request('POST', '/appStoreVersions', {
      data: {
        type: 'appStoreVersions',
        attributes: {
          versionString: '1.0.0',
          platform: 'IOS',
        },
        relationships: {
          app: { data: { type: 'apps', id: app.id } },
        },
      },
    });
    version = createResponse.data;
  }

  console.log(`   ✅ Version: ${version.attributes.versionString} (${version.attributes.appStoreState})`);

  // Step 3: Update version localization
  console.log('\n📝 Updating app description and keywords...');

  const localizationsResponse = await request(
    'GET',
    `/appStoreVersions/${version.id}/appStoreVersionLocalizations`
  );

  let localization = localizationsResponse.data?.find((l) => l.attributes.locale === 'en-US');

  // Only include whatsNew for updates (not first version)
  const isFirstVersion = version.attributes.versionString === '1.0' || version.attributes.versionString === '1.0.0';

  const localizationAttrs = {
    description: METADATA.description,
    keywords: METADATA.keywords,
    promotionalText: METADATA.promotionalText,
    supportUrl: METADATA.supportUrl,
    marketingUrl: METADATA.marketingUrl,
  };

  // What's New is only for updates, not initial release
  if (!isFirstVersion) {
    localizationAttrs.whatsNew = METADATA.whatsNew;
  }

  if (localization) {
    // Update existing localization
    await request('PATCH', `/appStoreVersionLocalizations/${localization.id}`, {
      data: {
        type: 'appStoreVersionLocalizations',
        id: localization.id,
        attributes: localizationAttrs,
      },
    });
    console.log('   ✅ Updated en-US localization');
  } else {
    // Create new localization
    await request('POST', '/appStoreVersionLocalizations', {
      data: {
        type: 'appStoreVersionLocalizations',
        attributes: {
          locale: 'en-US',
          ...localizationAttrs,
        },
        relationships: {
          appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
        },
      },
    });
    console.log('   ✅ Created en-US localization');
  }

  // Step 4: Update app info (subtitle, privacy policy)
  console.log('\n🏷️  Updating subtitle and privacy policy...');

  const appInfosResponse = await request('GET', `/apps/${app.id}/appInfos`);
  const appInfo = appInfosResponse.data?.[0];

  if (appInfo) {
    const appInfoLocsResponse = await request(
      'GET',
      `/appInfos/${appInfo.id}/appInfoLocalizations`
    );
    const appInfoLoc = appInfoLocsResponse.data?.find((l) => l.attributes.locale === 'en-US');

    if (appInfoLoc) {
      await request('PATCH', `/appInfoLocalizations/${appInfoLoc.id}`, {
        data: {
          type: 'appInfoLocalizations',
          id: appInfoLoc.id,
          attributes: {
            subtitle: METADATA.subtitle,
            privacyPolicyUrl: METADATA.privacyPolicyUrl,
          },
        },
      });
      console.log('   ✅ Updated subtitle and privacy policy');
    }

    // Step 5: Update categories
    console.log('\n📂 Setting app categories...');
    try {
      await request('PATCH', `/appInfos/${appInfo.id}`, {
        data: {
          type: 'appInfos',
          id: appInfo.id,
          relationships: {
            primaryCategory: {
              data: { type: 'appCategories', id: CATEGORY_IDS.SPORTS },
            },
            secondaryCategory: {
              data: { type: 'appCategories', id: CATEGORY_IDS.HEALTH_AND_FITNESS },
            },
          },
        },
      });
      console.log('   ✅ Primary: Sports');
      console.log('   ✅ Secondary: Health & Fitness');
    } catch (e) {
      console.log(`   ⚠️  Categories: ${e.message}`);
    }
  }

  // Step 6: Update age rating
  console.log('\n🔞 Setting age rating...');
  try {
    const ageRatingResponse = await request(
      'GET',
      `/appStoreVersions/${version.id}/ageRatingDeclaration`
    );
    const ageRating = ageRatingResponse.data;

    if (ageRating) {
      await request('PATCH', `/ageRatingDeclarations/${ageRating.id}`, {
        data: {
          type: 'ageRatingDeclarations',
          id: ageRating.id,
          attributes: METADATA.ageRating,
        },
      });
      console.log('   ✅ Age rating set to 4+ (no objectionable content)');
    }
  } catch (e) {
    console.log(`   ⚠️  Age rating: ${e.message}`);
  }

  // Step 7: Update copyright
  console.log('\n©️  Setting copyright...');
  try {
    await request('PATCH', `/appStoreVersions/${version.id}`, {
      data: {
        type: 'appStoreVersions',
        id: version.id,
        attributes: {
          copyright: `© ${new Date().getFullYear()} Athlete Mindset Inc.`,
        },
      },
    });
    console.log(`   ✅ © ${new Date().getFullYear()} Athlete Mindset Inc.`);
  } catch (e) {
    console.log(`   ⚠️  Copyright: ${e.message}`);
  }

  // Summary
  console.log('\n' + '━'.repeat(50));
  console.log('\n✅ App Store metadata updated successfully!\n');
  console.log('📋 Summary:');
  console.log(`   App: ${app.attributes.name}`);
  console.log(`   Version: ${version.attributes.versionString}`);
  console.log(`   Description: ${METADATA.description.split('\n')[0].substring(0, 50)}...`);
  console.log(`   Keywords: ${METADATA.keywords.substring(0, 50)}...`);
  console.log(`   Subtitle: ${METADATA.subtitle}`);
  console.log(`   Category: Sports / Health & Fitness`);
  console.log('\n🔗 View in App Store Connect:');
  console.log(`   https://appstoreconnect.apple.com/apps/${app.id}/appstore\n`);
}

main().catch((e) => {
  console.error('\n❌ Error:', e.message);
  process.exit(1);
});
