/**
 * Force flush FragmentCache to save noun-genders.json
 */

import { getFragmentCache } from '../lib/fragmentCache.js';

console.log('Flushing FragmentCache...');
const cache = getFragmentCache();
cache.flush();
console.log('✅ Cache flushed successfully');
