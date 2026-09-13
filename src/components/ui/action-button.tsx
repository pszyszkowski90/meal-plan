import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, type ThemeColor } from '@/constants/theme';

export type ActionButtonProps = {
  label: string;
  onPress: () => void | Promise<void>;
  /** Blokuje przycisk i podmienia etykietę na `busyLabel` (albo zostawia `label`). */
  busy?: boolean;
  busyLabel?: string;
  /** Powierzchnia z motywu: `backgroundSelected` to akcja główna, `backgroundElement` — drugorzędna. */
  type?: Extract<ThemeColor, 'backgroundSelected' | 'backgroundElement'>;
};

/**
 * Jedyny przycisk akcji w aplikacji. Powstał, gdy ten sam `Pressable` + `ThemedView` + `ThemedText`
 * pojawił się po raz czwarty (logowanie, rejestracja, Google, wylogowanie) — trzecia kopia stylu to
 * już wzór, nie przypadek. Kolor bierze z motywu przez `type`, odstępy ze `Spacing`; żadnych surowych
 * wartości. Bez `useMemo`/`useCallback` — `reactCompiler` jest włączony.
 */
export function ActionButton({
  label,
  onPress,
  busy = false,
  busyLabel,
  type = 'backgroundSelected',
}: ActionButtonProps) {
  return (
    <Pressable
      disabled={busy}
      onPress={onPress}
      // Dopełnienie naprawy dostępności z S-03: bez ROLI czytnik ekranu ogłaszał ten element jako
      // zwykły tekst, a harness E2E musiał szukać `div[tabindex]` po widocznej etykiecie. Nazwa
      // idzie dwiema drogami, bo `aria-*` nie działa natywnie (patrz `TextField`).
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      accessibilityLabel={busy ? (busyLabel ?? label) : label}
      aria-label={busy ? (busyLabel ?? label) : label}
      style={({ pressed }) => [styles.action, (pressed || busy) && styles.actionMuted]}>
      <ThemedView type={type} style={styles.surface}>
        <ThemedText type="small">{busy ? (busyLabel ?? label) : label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    alignSelf: 'stretch',
  },
  actionMuted: {
    opacity: 0.7,
  },
  surface: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
