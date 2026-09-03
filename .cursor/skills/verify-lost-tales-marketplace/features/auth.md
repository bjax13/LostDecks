# Sign in

Sign in lets a collector create a session with email and password, register a new account, reset a password, or use the quick-sign-in modal, then reach auth-gated pages.

## Sub-features

- `auth-login-page` signs in from `/auth/login` and shows a signed-in nav.
- `auth-login-redirect` sends Collection, Matches, and Account visitors to login, then back after success.
- `auth-modal` opens from Quick sign in or Home Sign In and closes on success.
- `auth-register` creates an account from `/auth/register` and lands on Collection.
- `auth-forgot` submits the reset form on `/auth/forgot`.
- `auth-logout` returns the primary nav to Sign in.

## How to get to it (user POV)

- Choose `Sign in` in the primary navigation.
- Choose `Quick sign in` in the primary navigation.
- Choose `Sign In` on the Home hero (signed out).
- Follow Collection, Matches, or Account while signed out (redirect to `/auth/login`).
- Choose `Need an account? Sign up` on the login page.
- Choose `Forgot password?` on the login page.
- Open `/auth/login`, `/auth/register`, or `/auth/forgot` directly.

## Driving it with verify-lost-tales

Preconditions:

- Lost Tales Marketplace is healthy at `http://127.0.0.1:5173`.
- The browser session is signed out.
- Seed user `collector.one@example.com` / `replace-me-local-only` exists.
- `doctor` reports `ok=true`.

- **Login page.** Open sign in. Run `$VERIFY drive click --role link --name "Sign in" --scope nav`. The heading `Sign in to Lost Tales Marketplace` is visible with Email and Password fields.
- **Successful login.** Submit the seeded collector. Run `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only`. Primary nav shows `Hi, Collector One` and a `Sign out` button. Default landing is `/collections` with heading `Your Collection`.
- **Logout.** Sign out. Run `$VERIFY drive logout`. Primary nav shows `Sign in` again.
- **Gated redirect.** Choose Collection while signed out. Run `$VERIFY drive click --role link --name Collection --scope nav`. The login heading is visible (not Collection). After `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only`, heading `Your Collection` appears.
- **Quick sign in modal.** Sign out, then open the modal. Run `$VERIFY drive logout`, `$VERIFY drive click --role button --name "Quick sign in" --scope nav`. Heading `Sign In` is visible (modal, not the login page h1). Close with `$VERIFY drive click --role button --name ×`.
- **Register page.** Open sign up. Run `$VERIFY drive goto --path /auth/register`. The heading `Create your Lost Tales account` is visible with Display Name, Email, and Password.
- **Forgot password.** Open reset. Run `$VERIFY drive goto --path /auth/forgot`. The heading `Reset your password` is visible. Fill `$VERIFY drive fill --label Email --value collector.one@example.com` and `$VERIFY drive click --role button --name "Send reset email"`. The page shows `Check your inbox for a password reset link.` (emulator does not deliver mail; the in-app confirmation is the proof).
- **Proof.** Capture the signed-in collection landing after login. Run `$VERIFY drive login --email collector.one@example.com --password replace-me-local-only`, `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/auth/signed-in-collection.png --full-page`, and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/auth/signed-in-collection.aria.txt`. Artifacts show `Hi, Collector One`, `Sign out`, and `Your Collection`.

## Gotchas

- `$VERIFY drive login` fills `/auth/login` and presses `Sign In`. It is the same user path as the labeled steps, not an Auth REST shortcut.
- Login `Sign In` and modal `Sign In` are different headings. After a gated redirect the page heading includes `Lost Tales Marketplace`; the modal heading is exactly `Sign In`.
- Google is visible as `Google` under `Or continue with`. Skip it on emulators; the popup is not the email/password path.
- Registering a new random email mutates emulator Auth. Prefer the seeded user unless proving `auth-register`. If you register, use a unique address and `$VERIFY seed` afterward.
- Nav shows `Checking session…` briefly on load. Wait for `Sign in` or `Sign out` before clicking auth controls.
