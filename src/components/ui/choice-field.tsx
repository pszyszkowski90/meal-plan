import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export type ChoiceOption<T extends string | number> = {
  value: T;
  label: string;
  /** Druga linia pod etykietą — np. słowny opis poziomu aktywności. */
  hint?: string;
};

export type ChoiceFieldProps<T extends string | number> = {
  /** Etykieta nad polem — jak w `TextField`, pole bez etykiety nie istnieje w tym repo. */
  label: string;
  /** `null` znaczy „nic jeszcze nie wybrano" — pusty formularz profilu zaczyna właśnie tak. */
  value: T | null;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
  /** Komunikat błędu renderowany pod polem; `null` znaczy „bez błędu". */
  error?: string | null;
};

/**
 * Prymityw wyboru jednej opcji z kilku — rodzeństwo `TextField`: etykieta nad polem, błąd pod
 * polem, kolory wyłącznie z motywu (`ThemedView type`), odstępy i promienie ze `Spacing`.
 *
 * Powstał, bo w S-02 pojawia się dwa razy (płeć, poziom aktywności 1–5), a S-03 (liczba posiłków)
 * użyje go trzeci raz. `flexWrap: 'wrap'` jest konieczny: pięć poziomów aktywności nie mieści się
 * w jednym rzędzie na telefonie.
 *
 * Semantyka dostępności to grupa przycisków radio — `accessibilityRole="radio"` plus
 * `accessibilityState={{ checked }}`, żeby czytnik ekranu mówił „wybrane", a nie tylko „przycisk".
 */
export function ChoiceField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  error,
}: ChoiceFieldProps<T>) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>

      {/*
        Grupa miała poprawną ROLĘ, ale nie miała NAZWY (ustalenie F6): czytnik ekranu mówił
        „grupa przycisków radio", nie zdradzając, czego dotyczy wybór. Nazwa idzie dwiema drogami
        z tego samego powodu co w `TextField` — `aria-*` nie działa natywnie.
      */}
      <ThemedView
        style={styles.options}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        aria-label={label}>
        {options.map((option) => {
          const checked = option.value === value;

          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              accessibilityLabel={option.hint ? `${option.label} — ${option.hint}` : option.label}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView
                type={checked ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.option}>
                <ThemedText type={checked ? 'smallBold' : 'small'}>{option.label}</ThemedText>
                {option.hint ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {option.hint}
                  </ThemedText>
                ) : null}
              </ThemedView>
            </Pressable>
          );
        })}
      </ThemedView>

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
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
