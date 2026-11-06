import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { SmartSpectraConfigureOptions, SmartSpectraModuleEvents } from './SmartSpectra.types';

declare class SmartSpectraNativeModule extends NativeModule<SmartSpectraModuleEvents> {
  configure(options: SmartSpectraConfigureOptions): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  reset(): Promise<void>;
}

/**
 * `null` when the native module isn't compiled into the app: on web, in Expo Go, or in a build
 * made before the module was added. Callers fall back to the simulated vitals source.
 */
export default requireOptionalNativeModule<SmartSpectraNativeModule>('SmartSpectra');
