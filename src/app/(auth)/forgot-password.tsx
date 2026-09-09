import { isClerkAPIResponseError, useSignIn } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ActionButton } from '@/components/ui/action-button';
import { AuthScreen } from '@/components/ui/auth-screen';
import { GlobalErrors } from '@/components/ui/global-errors';
import { TextField } from '@/components/ui/text-field';

/**
 * Reset hasła bez opuszczania aplikacji: adres → kod z maila → nowe hasło.
 *
 * Kolejność wynika z SDK, nie z planu: `resetPasswordEmailCode.sendCode()` rzuca, gdy nie ma próby
 * logowania, więc najpierw `signIn.create({ identifier })`. Po `verifyCode` status przechodzi
 * w `needs_new_password`; jeśli `submitPassword` odrzuci hasło (polityka instancji), ponowna próba
 * pomija weryfikację kodu — kod jest już zużyty. Po `finalize()` sesja jest aktywna i na `/` odsyła
 * bramka grupy `(auth)`; ten ekran nie nawiguje sam (plan v2.4).
 *
 * Ochrona przed wyliczaniem kont jest **wyłącznie po stronie tego ekranu** i nie ma czym jej zastąpić.
 * Clerk ma dwa tryby (Protect → Rules → User enumeration protection): *bulk* jest na instancji
 * włączony, ale to same limity częstotliwości i istnienia konta nie ukrywa; *strict* ukrywa, lecz
 * wymaga, żeby hasło **nie było** pierwszą strategią logowania — a nasze logowanie zaczyna się od
 * `signIn.password()`. Dopóki to się nie zmieni, ten kod jest jedynym mechanizmem, nie pasem
 * bezpieczeństwa.
 *
 * Dla nieznanego adresu Clerk zwraca `form_identifier_not_found`; ekran przechodzi wtedy do kroku
 * kodu z tym samym tekstem co dla konta istniejącego, a każdy kod odrzuca komunikatem identycznym
 * jak dla kodu błędnego. Granice maski: 422 z FAPI widać w zakładce Network, a zamaskowane
 * odrzucenie kodu nie robi żądania, więc nie mruga stanem `busy`.
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
  const [codeResent, setCodeResent] = useState(false);

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
    // Konto istnieje, ale kodu nie da się wysłać (np. tylko Google, bez czynnika hasła; limit
    // wysyłek) — z zewnątrz musi wyglądać jak adres nieznany, inaczej różnica odpowiedzi zdradza
    // stan konta. Błąd zostaje w `errors.global`, ale na zamaskowanym kroku go nie renderujemy.
    setAttemptExists(!sendError);
    setStep('code');
  }

  // Zgubiony mail nie może zmuszać do powrotu na sign-in (jak w rejestracji, plan v2.3). Pod maską
  // (brak próby) nic nie wysyłamy, a wynik prawdziwej wysyłki celowo pomijamy — inny komunikat
  // dla konta istniejącego zdradzałby jego istnienie; nagłówek i tak mówi „jeśli konto istnieje".
  async function resendCode() {
    if (attemptExists) {
      await signIn.resetPasswordEmailCode.sendCode();
    }
    setCodeRejected(false);
    setCodeResent(true);
  }

  async function submitNewPassword() {
    setCodeRejected(false);
    setCodeResent(false);

    if (!attemptExists) {
      setCodeRejected(true);
      return;
    }

    if (signIn.status !== 'needs_new_password') {
      const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code });
      if (error) {
        // Każde odrzucenie kodu (błędny, wygasły, za dużo prób) jedną treścią — inaczej różnica
        // komunikatu zdradza, że próba istnieje, a treść bez `paramName` byłaby po angielsku.
        setCodeRejected(true);
        return;
      }
    }

    const { error: passwordError } = await signIn.resetPasswordEmailCode.submitPassword({ password });
    if (passwordError) {
      return;
    }

    await signIn.finalize();
  }

  const codeError = codeRejected ? CODE_REJECTED : undefined;
  // Po udanym `verifyCode` kod jest zużyty i ponowna próba go nie wysyła — pole zamrożone, żeby
  // edycja nie była po cichu ignorowana.
  const codeAccepted = signIn.status === 'needs_new_password';
  // Na zamaskowanym kroku (brak próby albo odrzucony kod) błędy globalne Clerka zostają w ukryciu —
  // ich treść zdradzałaby, czy próba istnieje.
  const showGlobalErrors = (step === 'email' || attemptExists) && !codeRejected && !codeResent;

  return (
    <AuthScreen>
      <ThemedText type="subtitle">{step === 'code' ? 'Ustaw nowe hasło' : 'Nie pamiętam hasła'}</ThemedText>

      {step === 'code' ? (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            {codeResent
              ? `Jeśli konto ${emailAddress} istnieje, wysłaliśmy kod ponownie — sprawdź też spam.`
              : `Jeśli konto ${emailAddress} istnieje, wysłaliśmy na nie kod. Wpisz go i ustaw nowe hasło.`}
          </ThemedText>

          <TextField
            label="Kod z wiadomości"
            value={code}
            onChangeText={setCode}
            error={codeError}
            editable={!codeAccepted}
            keyboardType="number-pad"
            autoCapitalize="none"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
          />

          {codeAccepted ? null : (
            <Pressable disabled={busy} onPress={resendCode}>
              <ThemedText type="linkPrimary">Nie dostałem kodu, wyślij ponownie</ThemedText>
            </Pressable>
          )}

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

      {showGlobalErrors ? <GlobalErrors errors={errors.global} /> : null}

      <ActionButton
        label={step === 'code' ? 'Zmień hasło' : 'Wyślij kod'}
        busy={busy}
        onPress={step === 'code' ? submitNewPassword : submitEmail}
      />

      {/* Wejście tu jest zawsze z sign-in, więc powrót to `back()`; `push` budowałby stos
          sign-in → forgot → sign-in. Bezpośrednie wejście z adresu nie ma dokąd wracać. */}
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.push('/sign-in'))}>
        <ThemedText type="linkPrimary">Wróć do logowania</ThemedText>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  centerText: {
    textAlign: 'center',
  },
});
