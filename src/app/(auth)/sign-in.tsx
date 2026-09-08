import { useSignIn } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionButton } from '@/components/ui/action-button';
import { GoogleSignInButton } from '@/components/ui/google-sign-in-button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  // Poprawne hasło, a mimo to `status !== 'complete'`: dashboard włączył krok (MFA, weryfikacja),
  // którego ten ekran nie obsługuje. Bez komunikatu przycisk po prostu „nic nie robi".
  const [unsupportedStep, setUnsupportedStep] = useState(false);

  const busy = fetchStatus === 'fetching';

  async function submit() {
    setUnsupportedStep(false);

    const { error } = await signIn.password({ emailAddress, password });
    if (error) {
      return;
    }

    // Drugi czynnik i logowanie społecznościowe są wyłączone w dashboardzie, więc poprawne hasło
    // domyka logowanie od razu. Każdy inny status znaczy, że dashboard rozjechał się z kodem.
    if (signIn.status !== 'complete') {
      setUnsupportedStep(true);
      return;
    }

    // Po `finalize()` sesja staje się aktywna i bramka grupy `(auth)` sama odsyła na `/`.
    // Nawigacja po zmianie sesji ma jednego właściciela — patrz `(auth)/_layout.tsx`.
    await signIn.finalize();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Zaloguj się</ThemedText>

        <TextField
          label="E-mail"
          value={emailAddress}
          onChangeText={setEmailAddress}
          error={errors.fields.identifier?.message}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />

        <TextField
          label="Hasło"
          value={password}
          onChangeText={setPassword}
          error={errors.fields.password?.message}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
        />

        {errors.global?.map((error) => (
          <ThemedText key={error.code} type="small" themeColor="textDanger">
            {error.longMessage ?? error.message}
          </ThemedText>
        ))}

        {unsupportedStep ? (
          <ThemedText type="small" themeColor="textDanger">
            Logowanie wymaga dodatkowego kroku, którego aplikacja jeszcze nie obsługuje.
          </ThemedText>
        ) : null}

        <ActionButton label="Zaloguj się" busyLabel="Logowanie…" busy={busy} onPress={submit} />

        <ThemedText type="small" themeColor="textSecondary">
          albo
        </ThemedText>

        <GoogleSignInButton label="Zaloguj się przez Google" />

        <Pressable onPress={() => router.push('/forgot-password')}>
          <ThemedText type="linkPrimary">Nie pamiętam hasła</ThemedText>
        </Pressable>

        <Pressable onPress={() => router.push('/sign-up')}>
          <ThemedText type="linkPrimary">Nie mam jeszcze konta</ThemedText>
        </Pressable>
      </SafeAreaView>
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
