#!/usr/bin/env node
// Run: node scripts/generate-vapid.mjs
// Then add the output to your Vercel Environment Variables.
import { generateVAPIDKeys } from 'web-push';

const keys = generateVAPIDKeys();
console.log('\n=== GestureFlow VAPID Keys ===\n');
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('\nAdd both to Vercel → Settings → Environment Variables.');
console.log('NEVER commit VAPID_PRIVATE_KEY to git.\n');
