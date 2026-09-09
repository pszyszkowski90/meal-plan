import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * Ramka ekranów grupy `(auth)`: wyśrodkowana kolumna o szerokości `MaxContentWidth` w bezpiecznym
 * obszarze. Powstała, gdy ten sam `ThemedView` + `SafeAreaView` z tym samym zestawem stylów pojawił
 * się po raz trzeci (logowanie, rejestracja, reset hasła). Odstępy ze `Spacing`, bez surowych wartości.
 */
export function AuthScreen({ children }: PropsWithChildren) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>{children}</SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
  },
});
