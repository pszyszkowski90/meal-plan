import { useSignUp } from '@clerk/expo';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GoogleSignInButton } from '@/components/ui/google-sign-in-button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function SignUpScreen() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeResent, setCodeResent] = useState(false);

  const busy = fetchStatus === 'fetching';
  // Świeży `signUp` raportuje `missing_requirements` jeszcze przed utworzeniem, więc o kroku
  // decyduje `unverifiedFields` — pusta lista znaczy „konto jeszcze nie powstało".
  const needsCode =
    signUp.status === 'missing_requirements' && signUp.unverifiedFields.includes('email_address');

  async function submitAccount() {
    const { error } = await signUp.password({ emailAddress, password });
    if (error) {
      return;
    }

    setCodeResent(false);
    await signUp.verifications.sendEmailCode();
  }

  // Clerk pamięta rozpoczętą rejestrację, więc po odświeżeniu strony użytkownik wraca na ekran kodu
  // — ale kod sam się nie wysyła drugi raz. Bez tej ścieżki zgubiony mail to martwy punkt.
  async function resendCode() {
    const { error } = await signUp.verifications.sendEmailCode();
    setCodeResent(!error);
  }

  async function submitCode() {
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) {
      return;
    }

    await signUp.finalize({
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
        <ThemedText type="subtitle">{needsCode ? 'Potwierdź e-mail' : 'Załóż konto'}</ThemedText>

        {needsCode ? (
          <>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Wysłaliśmy kod na {signUp.emailAddress ?? emailAddress}.
            </ThemedText>

            <TextField
              label="Kod z wiadomości"
              value={code}
              onChangeText={setCode}
              error={errors.fields.code?.message}
              keyboardType="number-pad"
              autoCapitalize="none"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
            />

            <Pressable disabled={busy} onPress={resendCode}>
              <ThemedText type="linkPrimary">
                {codeResent ? 'Kod wysłany ponownie — sprawdź też spam' : 'Nie dostałem kodu, wyślij ponownie'}
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <TextField
              label="E-mail"
              value={emailAddress}
              onChangeText={setEmailAddress}
              error={errors.fields.emailAddress?.message}
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
              autoComplete="new-password"
              textContentType="newPassword"
            />
          </>
        )}

        {errors.global?.map((error) => (
          <ThemedText key={error.code} type="small" themeColor="textDanger">
            {error.longMessage ?? error.message}
          </ThemedText>
        ))}

        {errors.fields.captcha ? (
          <ThemedText type="small" themeColor="textDanger">
            {errors.fields.captcha.message}
          </ThemedText>
        ) : null}

        <Pressable
          disabled={busy}
          onPress={needsCode ? submitCode : submitAccount}
          style={({ pressed }) => [styles.action, (pressed || busy) && styles.actionMuted]}>
          <ThemedView type="backgroundSelected" style={styles.actionSurface}>
            <ThemedText type="small">
              {needsCode ? 'Potwierdź kod' : 'Załóż konto'}
            </ThemedText>
          </ThemedView>
        </Pressable>

        {needsCode ? null : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              albo
            </ThemedText>

            <GoogleSignInButton label="Zarejestruj się przez Google" />

            <Pressable onPress={() => router.push('/sign-in')}>
              <ThemedText type="linkPrimary">Mam już konto</ThemedText>
            </Pressable>
          </>
        )}

        {/*
          Kotwica CAPTCHA. Na Expo web Clerk montuje w tym węźle widget Smart CAPTCHA i bez niego
          rejestracja kończy się błędem; na iOS i Androidzie ten krok jest pomijany, więc brak
          kotwicy objawiłby się wyłącznie na webie.
        */}
        <View nativeID="clerk-captcha" />
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
  centerText: {
    textAlign: 'center',
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
