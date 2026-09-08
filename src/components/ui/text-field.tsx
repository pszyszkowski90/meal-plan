import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = TextInputProps & {
  /** Etykieta nad polem — pole bez etykiety nie istnieje w tym repo. */
  label: string;
  /** Komunikat błędu renderowany pod polem; `null` znaczy „bez błędu". */
  error?: string | null;
};

/**
 * Prymityw pola formularza. Kolor bierze z `useTheme()`, odstęp i promień ze `Spacing` — żadnej
 * surowej wartości w `StyleSheet`. `secureTextEntry`, `keyboardType`, `autoComplete` i pozostałe
 * propsy `TextInput` przechodzą dalej bez zmian.
 */
export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>

      <TextInput
        style={[
          styles.input,
          { backgroundColor: theme.backgroundElement, color: theme.text },
          style,
        ]}
        placeholderTextColor={theme.textSecondary}
        {...rest}
      />

      {error ? (
        <ThemedText type="small" themeColor="textDanger">
          {error}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
    alignSelf: 'stretch',
  },
  input: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    fontSize: 16,
    lineHeight: 24,
  },
});
