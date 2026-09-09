import { useSignIn } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ActionButton } from '@/components/ui/action-button';
import { AuthScreen } from '@/components/ui/auth-screen';
import { GlobalErrors } from '@/components/ui/global-errors';
import { GoogleSignInButton } from '@/components/ui/google-sign-in-button';
import { TextField } from '@/components/ui/text-field';

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  // Poprawne hasło, a mimo to status nieznany temu ekranowi: dashboard włączył krok (MFA,
  // weryfikacja), którego kod nie obsługuje. Bez komunikatu przycisk po prostu „nic nie robi".
  const [unsupportedStep, setUnsupportedStep] = useState(false);
  // Jak w rejestracji: `pending` to stan po odświeżeniu strony — Clerk przywraca rozpoczętą próbę
  // logowania, ale nie wiemy, czy poprzednia wysyłka doszła, więc nie twierdzimy, że tak.
  const [codeDelivery, setCodeDelivery] = useState<'pending' | 'sent' | 'resent' | 'failed'>(
    'pending',
  );

  const busy = fetchStatus === 'fetching';

  /**
   * Logowanie z **nowego urządzenia**. Hasło jest już zweryfikowane
   * (`firstFactorVerification: 'verified'`), ale Clerk chce potwierdzić samego klienta kodem
   * z maila — Device Trust. Nie da się tego obejść konfiguracją: instancja ma
   * `second_factors: []`, `sign_in.second_factor.required: false`
   * i `native_settings.trusted_device_sign_in_enabled: false`, a status mimo to przychodzi.
   * Clerk oferuje dla niego dokładnie jeden czynnik — `email_code` na adres konta.
   *
   * Bez tego kroku konto założone w przeglądarce jest na telefonie nieosiągalne, czyli pożądany
   * wynik S-01 („ten sam stan w przeglądarce i na telefonie") jest nieosiągalny.
   */
  const needsDeviceCode = signIn.status === 'needs_client_trust';

  async function submitPassword() {
    setUnsupportedStep(false);

    const { error } = await signIn.password({ emailAddress, password });
    if (error) {
      return;
    }

    if (signIn.status === 'needs_client_trust') {
      // Hasło przeszło, ale wysyłka kodu może paść osobno (limit Clerka, sieć). Ekran kodu i tak
      // się pokaże — nagłówek musi wtedy powiedzieć, że kod NIE poszedł.
      const { error: sendError } = await signIn.mfa.sendEmailCode();
      setCodeDelivery(sendError ? 'failed' : 'sent');
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

  async function submitDeviceCode() {
    setUnsupportedStep(false);

    const { error } = await signIn.mfa.verifyEmailCode({ code });
    if (error) {
      return;
    }

    if (signIn.status !== 'complete') {
      setUnsupportedStep(true);
      return;
    }

    await signIn.finalize();
  }

  // Clerk pamięta rozpoczętą próbę logowania między odświeżeniami, ale kodu sam nie wysyła drugi
  // raz. Bez tej ścieżki zgubiony mail zostawia logowanie w martwym punkcie.
  async function resendDeviceCode() {
    const { error } = await signIn.mfa.sendEmailCode();
    setCodeDelivery(error ? 'failed' : 'resent');
  }

  const codeTarget = signIn.identifier ?? emailAddress;
  const codeDeliveryText = {
    pending: `Wpisz kod wysłany na ${codeTarget}.`,
    sent: `To nowe urządzenie — wysłaliśmy kod na ${codeTarget}.`,
    resent: `Wysłaliśmy kod ponownie na ${codeTarget} — sprawdź też spam.`,
    failed: `Nie udało się wysłać kodu na ${codeTarget} — użyj linku poniżej.`,
  }[codeDelivery];

  return (
    <AuthScreen>
      <ThemedText type="subtitle">{needsDeviceCode ? 'Potwierdź urządzenie' : 'Zaloguj się'}</ThemedText>

      {needsDeviceCode ? (
        <>
          <ThemedText
            type="small"
            themeColor={codeDelivery === 'failed' ? 'textDanger' : 'textSecondary'}
            style={styles.centerText}>
            {codeDeliveryText}
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

          <Pressable disabled={busy} onPress={resendDeviceCode}>
            <ThemedText type="linkPrimary">Nie dostałem kodu, wyślij ponownie</ThemedText>
          </Pressable>
        </>
      ) : (
        <>
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
        </>
      )}

      <GlobalErrors errors={errors.global} />

      {unsupportedStep ? (
        <ThemedText type="small" themeColor="textDanger">
          Logowanie wymaga dodatkowego kroku, którego aplikacja jeszcze nie obsługuje.
        </ThemedText>
      ) : null}

      <ActionButton
        label={needsDeviceCode ? 'Potwierdź kod' : 'Zaloguj się'}
        busyLabel={needsDeviceCode ? 'Sprawdzam…' : 'Logowanie…'}
        busy={busy}
        onPress={needsDeviceCode ? submitDeviceCode : submitPassword}
      />

      {needsDeviceCode ? null : (
        <>
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
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  centerText: {
    textAlign: 'center',
  },
});
