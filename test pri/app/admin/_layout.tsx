import { Slot } from 'expo-router';
import { GestureResponderEvent, View } from 'react-native';

import { useAdminIdleTimeout } from '@/lib/adminSession';

export default function AdminLayout() {
  const { recordActivity } = useAdminIdleTimeout();

  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={(_e: GestureResponderEvent) => recordActivity()}
    >
      <Slot />
    </View>
  );
}