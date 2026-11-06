import { requireNativeView } from 'expo';
import * as React from 'react';
import { View } from 'react-native';

import SmartSpectraModule from './SmartSpectraModule';
import type { SmartSpectraCameraViewProps } from './SmartSpectra.types';

const NativeView: React.ComponentType<SmartSpectraCameraViewProps> | null = SmartSpectraModule
  ? requireNativeView('SmartSpectra')
  : null;

/** Live camera preview from the SDK. Renders an empty view when the native module is absent. */
export default function SmartSpectraCameraView(props: SmartSpectraCameraViewProps) {
  if (!NativeView) return <View style={props.style} />;
  return <NativeView {...props} />;
}
