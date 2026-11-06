import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '../theme';
import { VitalsProvider } from '../vitals/VitalsProvider';

export default function RootLayout() {
  return (
    <VitalsProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="session/[id]" options={{ gestureEnabled: false }} />
      </Stack>
    </VitalsProvider>
  );
}
