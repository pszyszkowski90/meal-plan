import { ThemedText } from '@/components/themed-text';

type GlobalError = { code: string; message: string; longMessage?: string };

/**
 * Błędy Clerka bez `paramName` (`errors.global` z `useSignIn` / `useSignUp`) — te, których nie da się
 * przypiąć do pola. Warunek „czy w ogóle pokazywać" zostaje w ekranie (reset hasła maskuje je na
 * ścieżce bez próby), komponent tylko renderuje listę.
 */
export function GlobalErrors({ errors }: { errors: GlobalError[] | null | undefined }) {
  return errors?.map((error) => (
    <ThemedText key={error.code} type="small" themeColor="textDanger">
      {error.longMessage ?? error.message}
    </ThemedText>
  ));
}
