import { useSignIn } from '@clerk/expo';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GoogleSignInButton } from '@/components/ui/google-sign-in-button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');

  const busy = fetchStatus === 'fetching';

  async function submit() {
    const { error } = await signIn.password({ emailAddress, password });
    if (error) {
      return;
    }

    // Drugi czynnik i logowanie społecznościowe są wyłączone w dashboardzie, więc poprawne hasło
    // domyka logowanie od razu. Każdy inny status znaczy, że dashboard rozjechał się z kodem.
    if (signIn.status !== 'complete') {
      return;
    }

    await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        // Clerk może mieć jeszcze zadanie do domknięcia — wtedy nie przekierowujemy.
        if (session.currentTask) {
          return;
        }
        // `decorateUrl` dokłada parametr odświeżający ciasteczko przy ITP Safari; wynik jest
        // wyliczany w runtime, więc `typedRoutes` nie może go sprawdzić.
        router.replace(Platform.OS === 'web' ? (decorateUrl('/') as Href) : '/');
      },
    });
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

        <Pressable
          disabled={busy}
          onPress={submit}
          style={({ pressed }) => [styles.action, (pressed || busy) && styles.actionMuted]}>
          <ThemedView type="backgroundSelected" style={styles.actionSurface}>
            <ThemedText type="small">{busy ? 'Logowanie…' : 'Zaloguj się'}</ThemedText>
          </ThemedView>
        </Pressable>

        <ThemedText type="small" themeColor="textSecondary">
          albo
        </ThemedText>

        <GoogleSignInButton label="Zaloguj się przez Google" />

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
  action: {
    alignSelf: 'stretch',
  },
  actionMuted: {
    opacity: 0.7,
  },
  actionSurface: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
});
