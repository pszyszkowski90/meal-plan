import { useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionButton } from '@/components/ui/action-button';
import { GoogleSignInButton } from '@/components/ui/google-sign-in-button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function SignUpScreen() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  // Co wiemy o wysyłce kodu. `pending` to stan po odświeżeniu strony: Clerk przywraca rozpoczętą
  // rejestrację, ale my nie wiemy, czy poprzednia wysyłka doszła — więc nie twierdzimy, że tak.
  const [codeDelivery, setCodeDelivery] = useState<'pending' | 'sent' | 'resent' | 'failed'>(
    'pending',
  );

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

    // Konto już istnieje, ale wysyłka kodu może paść osobno (limit Clerka, sieć). Wtedy ekran kodu
    // i tak się pokaże — nagłówek musi powiedzieć, że kod NIE poszedł, a nie że „wysłaliśmy".
    const { error: sendError } = await signUp.verifications.sendEmailCode();
    setCodeDelivery(sendError ? 'failed' : 'sent');
  }

  // Clerk pamięta rozpoczętą rejestrację, więc po odświeżeniu strony użytkownik wraca na ekran kodu
  // — ale kod sam się nie wysyła drugi raz. Bez tej ścieżki zgubiony mail to martwy punkt.
  async function resendCode() {
    const { error } = await signUp.verifications.sendEmailCode();
    setCodeDelivery(error ? 'failed' : 'resent');
  }

  const codeTarget = signUp.emailAddress ?? emailAddress;
  const codeDeliveryText = {
    pending: `Wpisz kod wysłany na ${codeTarget}.`,
    sent: `Wysłaliśmy kod na ${codeTarget}.`,
    resent: `Wysłaliśmy kod ponownie na ${codeTarget} — sprawdź też spam.`,
    failed: `Nie udało się wysłać kodu na ${codeTarget} — użyj linku poniżej.`,
  }[codeDelivery];

  async function submitCode() {
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) {
      return;
    }

    // Po `finalize()` sesja staje się aktywna i bramka grupy `(auth)` sama odsyła na `/`.
    // Nawigacja po zmianie sesji ma jednego właściciela — patrz `(auth)/_layout.tsx`.
    await signUp.finalize();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">{needsCode ? 'Potwierdź e-mail' : 'Załóż konto'}</ThemedText>

        {needsCode ? (
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

            <Pressable disabled={busy} onPress={resendCode}>
              <ThemedText type="linkPrimary">Nie dostałem kodu, wyślij ponownie</ThemedText>
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

        <ActionButton
          label={needsCode ? 'Potwierdź kod' : 'Załóż konto'}
          busy={busy}
          onPress={needsCode ? submitCode : submitAccount}
        />

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
});
