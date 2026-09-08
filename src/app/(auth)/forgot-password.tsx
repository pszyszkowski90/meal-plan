import { isClerkAPIResponseError, useSignIn } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionButton } from '@/components/ui/action-button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * Reset hasła bez opuszczania aplikacji: adres → kod z maila → nowe hasło.
 *
 * Kolejność wynika z SDK, nie z planu: `resetPasswordEmailCode.sendCode()` rzuca, gdy nie ma próby
 * logowania, więc najpierw `signIn.create({ identifier })`. Po `verifyCode` status przechodzi
 * w `needs_new_password`; jeśli `submitPassword` odrzuci hasło (polityka instancji), ponowna próba
 * pomija weryfikację kodu — kod jest już zużyty. Po `finalize()` sesja jest aktywna i na `/` odsyła
 * bramka grupy `(auth)`; ten ekran nie nawiguje sam (plan v2.4).
 *
 * Ochrona przed wyliczaniem kont jest po stronie ekranu, bo instancja ma wyłączoną
 * *Enumeration protection*: dla nieznanego adresu Clerk zwraca `form_identifier_not_found`.
 * Ekran przechodzi wtedy do kroku kodu z tym samym tekstem co dla konta istniejącego, a każdy kod
 * odrzuca komunikatem identycznym jak dla kodu błędnego. Włączenie ochrony w dashboardzie
 * (Configure → Attack protection) czyni tę ścieżkę martwą — i to jest docelowe źródło prawdy.
 */
const CODE_REJECTED = 'Kod jest nieprawidłowy lub wygasł.';

export default function ForgotPasswordScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  // Czy po stronie Clerka istnieje próba, na którą da się odpowiedzieć kodem. `false` po
  // `form_identifier_not_found` — ekran wygląda tak samo, ale nie ma czego weryfikować.
  const [attemptExists, setAttemptExists] = useState(false);
  const [codeRejected, setCodeRejected] = useState(false);

  const busy = fetchStatus === 'fetching';

  function isUnknownIdentifier(error: unknown) {
    return (
      isClerkAPIResponseError(error) &&
      error.errors.some((item) => item.code === 'form_identifier_not_found')
    );
  }

  async function submitEmail() {
    const { error } = await signIn.create({ identifier: emailAddress });
    if (error) {
      if (isUnknownIdentifier(error)) {
        setAttemptExists(false);
        setStep('code');
      }
      return;
    }

    const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
    if (sendError) {
      return;
    }

    setAttemptExists(true);
    setStep('code');
  }

  async function submitNewPassword() {
    setCodeRejected(false);

    if (!attemptExists) {
      setCodeRejected(true);
      return;
    }

    if (signIn.status !== 'needs_new_password') {
      const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code });
      if (error) {
        return;
      }
    }

    const { error: passwordError } = await signIn.resetPasswordEmailCode.submitPassword({ password });
    if (passwordError) {
      return;
    }

    await signIn.finalize();
  }

  const codeError = codeRejected || errors.fields.code ? CODE_REJECTED : undefined;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">{step === 'code' ? 'Ustaw nowe hasło' : 'Nie pamiętam hasła'}</ThemedText>

        {step === 'code' ? (
          <>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Jeśli konto {emailAddress} istnieje, wysłaliśmy na nie kod. Wpisz go i ustaw nowe hasło.
            </ThemedText>

            <TextField
              label="Kod z wiadomości"
              value={code}
              onChangeText={setCode}
              error={codeError}
              keyboardType="number-pad"
              autoCapitalize="none"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
            />

            <TextField
              label="Nowe hasło"
              value={password}
              onChangeText={setPassword}
              error={errors.fields.password?.message}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
            />
          </>
        ) : (
          <TextField
            label="E-mail"
            value={emailAddress}
            onChangeText={setEmailAddress}
            error={
              errors.fields.identifier?.code === 'form_identifier_not_found'
                ? undefined
                : errors.fields.identifier?.message
            }
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />
        )}

        {errors.global?.map((error) => (
          <ThemedText key={error.code} type="small" themeColor="textDanger">
            {error.longMessage ?? error.message}
          </ThemedText>
        ))}

        <ActionButton
          label={step === 'code' ? 'Zmień hasło' : 'Wyślij kod'}
          busy={busy}
          onPress={step === 'code' ? submitNewPassword : submitEmail}
        />

        <Pressable onPress={() => router.push('/sign-in')}>
          <ThemedText type="linkPrimary">Wróć do logowania</ThemedText>
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
  centerText: {
    textAlign: 'center',
  },
});
