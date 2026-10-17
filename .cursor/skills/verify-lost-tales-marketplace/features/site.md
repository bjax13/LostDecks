# Site footer

The document footer on every route links to About, Privacy, and Terms, and opens a site feedback dialog (not trade-match contact).

## Sub-features

- `site-about` shows the About page and two-jobs copy.
- `site-privacy-terms` shows Privacy Policy and Terms of Use.
- `site-feedback-open` opens Send site feedback from the footer.
- `site-feedback-close` dismisses the dialog.

## How to get to it (user POV)

- Choose `About`, `Privacy`, or `Terms` in the document footer on any page.
- Choose `Feedback` in the document footer on any page.

## Driving it with verify-lost-tales

Preconditions:

- ShardStash is healthy at `http://127.0.0.1:5173`.
- `doctor` reports `ok=true`.

- **About.** Run `$VERIFY drive goto --path /about`. The heading `About` is visible and copy includes `ShardStash has two jobs`.
- **Privacy and Terms.** Run `$VERIFY drive goto --path /privacy` and expect heading `Privacy Policy`. Run `$VERIFY drive goto --path /terms` and expect heading `Terms of Use`.
- **Feedback dialog.** From home, run `$VERIFY drive goto --path /`, `$VERIFY drive click --testid site-feedback-open`, `$VERIFY drive expect --testid site-feedback-dialog`. Dialog heading `Send site feedback` and copy `not trade match contact` are visible. Close with `$VERIFY drive click --role button --name Close` inside the dialog.
- **Proof.** Run `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/site/footer-feedback.png --full-page` after opening the feedback dialog.

## Gotchas

- Footer lives in `site-footer` (`data-testid`). Scope feedback actions to that footer or use `site-feedback-open` / `site-feedback-dialog` test ids.
- PostHog in-app survey FAB is separate from footer feedback; launch leaves `VITE_POSTHOG_KEY` empty so Submit feedback FAB stays hidden.
