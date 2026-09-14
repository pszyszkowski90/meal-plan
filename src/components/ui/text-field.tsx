import { useId } from 'react';
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
 * **Błąd jest POWIĄZANY z polem, a nie tylko narysowany pod nim.** `aria-invalid` mówi, że pole
 * jest w błędzie; `aria-errormessage` wskazuje element z treścią tego błędu, dzięki czemu czytnik
 * ekranu przeczyta powód, a nie samo „niepoprawne". Identyfikator generuje `useId()`, bo prymityw
 * nie wie, ile razy wystąpi na ekranie — dwa pola z tym samym `id` wskazywałyby ten sam komunikat.
 *
 * `aria-describedby` idzie obok celowo, mimo że powiela powiązanie: wsparcie dla
 * `aria-errormessage` w czytnikach ekranu jest do dziś nierówne, a `describedby` działa wszędzie.
 * Kosztuje jeden atrybut, a jest różnicą między „przeczytany powód" a „wiadomo, że coś nie gra".
 *
 * Wszystkie trzy są nadpisywalne przez `rest` — wywołujący, który wie lepiej, nie musi walczyć
 * z prymitywem.
 */
export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const errorId = useId();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>

      <TextInput
        accessibilityLabel={label}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? errorId : undefined}
        aria-describedby={error ? errorId : undefined}
        style={[
          styles.input,
          { backgroundColor: theme.backgroundElement, color: theme.text },
          style,
        ]}
        placeholderTextColor={theme.textSecondary}
        {...rest}
      />

      {error ? (
        <ThemedText id={errorId} nativeID={errorId} type="small" themeColor="textDanger">
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
