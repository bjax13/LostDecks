# Site info

The document footer on every page links to About, Privacy, and Terms, and opens a feedback dialog for product notes.

## Sub-features

- `site-about` shows the About page from the footer.
- `site-privacy` shows the Privacy Policy page from the footer.
- `site-terms` shows the Terms of Use page from the footer.
- `site-feedback` opens Send site feedback and closes it without leaving the page.

## How to get to it (user POV)

- Choose `About`, `Privacy`, or `Terms` in the document footer from any route.
- Choose `Feedback` in the document footer.
- Open `/about`, `/privacy`, or `/terms` directly.
- On `/auth/register`, the consent line links `Terms` and `Privacy Policy` to the same pages.

## Driving it with verify-lost-tales

Preconditions:

- ShardStash is healthy at `http://127.0.0.1:5173`.
- The browser session may be signed in or signed out.
- `doctor` reports `ok=true`.

- **About.** From home, choose About. Run `$VERIFY drive goto --path /` and `$VERIFY drive click --role link --name About --exact`. The heading `About` is visible.
- **Privacy.** Choose Privacy. Run `$VERIFY drive click --role link --name Privacy --exact`. The heading `Privacy Policy` is visible.
- **Terms.** From home, choose Terms with an exact name. Run `$VERIFY drive goto --path /` and `$VERIFY drive click --role link --name Terms --exact`. The heading `Terms of Use` is visible. Without `--exact`, `Terms` also matches an in-page `Terms of Use` link on the privacy page.
- **Feedback.** Return home and open the dialog. Run `$VERIFY drive goto --path /` and `$VERIFY drive click --role button --name Feedback --exact`. Heading `Send site feedback` is visible. Close with `$VERIFY drive click --role button --name Close --exact`.
- **Proof.** Capture About. Run `$VERIFY drive goto --path /about`, `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/site/about.png --full-page`, and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/site/about.aria.txt`. Artifacts show heading `About` and the footer links.

## Gotchas

- `Back` without `--exact` matches footer `Feedback`. Use `--exact` when the wizard Back button is the target.
- Footer `Terms` and a body link named `Terms of Use` both match `Terms` unless `--exact` is set.
- The Submit feedback control in the corner is absent unless PostHog is configured. The footer `Feedback` button is the path this map drives.
- Google sign-in and account deletion are not part of this page. Deletion lives on Account Settings.
