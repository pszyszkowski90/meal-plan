import * as WebBrowser from 'expo-web-browser';
import { StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';

/**
 * Lądowanie po powrocie z Google. Na webie `startSSOFlow` otwiera okno wyskakujące, a Clerk odsyła
 * je właśnie tutaj; `maybeCompleteAuthSession()` przekazuje adres z powrotem do okna, które flow
 * rozpoczęło, i pozwala mu się domknąć. Wywołanie musi być w zakresie modułu, bo strona zamyka się
 * natychmiast po załadowaniu.
 *
 * Na iOS i Androidzie ta trasa nie jest w praktyce oglądana — sesja przeglądarki wraca do aplikacji
 * sama — a `maybeCompleteAuthSession()` zwraca tam `{ type: 'failed' }` zamiast rzucać. Podczas
 * prerenderu (`output: "server"`) `window` nie istnieje i implementacja webowa też zwraca `failed`,
 * więc eksport się nie wywraca.
 *
 * Adres tej trasy — webowy oraz ten z Expo Go — musi być na białej liście przekierowań w Clerku,
 * inaczej callback wróci bez `rotating_token_nonce` i logowania nie da się domknąć.
 */
WebBrowser.maybeCompleteAuthSession();

export default function SsoCallbackScreen() {
  return <ThemedView type="background" style={styles.neutral} />;
}

const styles = StyleSheet.create({
  neutral: {
    flex: 1,
  },
});
