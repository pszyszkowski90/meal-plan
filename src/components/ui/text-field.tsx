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
 *
 * **Nazwa dostępnościowa idzie DWIEMA drogami i obie są konieczne** (ustalenie F6 przeglądu S-02,
 * uzupełnione badaniem 13.09.2026). Do tej pory pole nie miało żadnej: etykieta była osobnym
 * tekstem obok, więc czytnik ekranu czytał „pole edycji", a harness E2E musiał rozróżniać pola po
 * `inputmode` i kolejności w formularzu.
 *
 *   * `accessibilityLabel` — jedyne, co działa NATYWNIE. Atrybuty `aria-*` na iOS i Androidzie
 *     nie istnieją, więc sama wersja webowa zostawiłaby czytnik na urządzeniu bez zmian.
 *   * `aria-label` — droga webowa. Podana wprost, a nie zostawiona tłumaczeniu React Native Web,
 *     żeby nazwa nie zależała od tego, które propsy ta warstwa akurat mapuje.
 *
 * `aria-invalid` i `aria-errormessage` domykają błąd: pole w błędzie ma być rozpoznawalne bez
 * czytania tekstu pod nim. Obie wartości są nadpisywalne przez `rest` — wywołujący, który wie
 * lepiej, nie musi walczyć z prymitywem.
 */
export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>

      <TextInput
        accessibilityLabel={label}
        aria-label={label}
        aria-invalid={error ? true : undefined}
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
