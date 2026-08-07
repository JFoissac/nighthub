import 'zone.js';
import 'zone.js/testing';

import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();

const globalAny = globalThis as any;

if (!globalAny.jest && globalAny.vi) {
  globalAny.jest = globalAny.vi;
}
