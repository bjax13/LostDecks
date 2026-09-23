# About and feedback

About is a public page for what ShardStash is. Feedback is a footer dialog on every route for product and site comments (not trade-match contact).

## Sub-features

- `about-open` shows the About heading and the two-jobs copy.
- `about-contact` lists the feedback email and Discord places.
- `feedback-open` opens Send site feedback from the footer Feedback button.
- `feedback-close` dismisses the dialog with Close.

## How to get to it (user POV)

- Choose `About` in the document footer on any page.
- Open `/about` directly.
- Choose `Feedback` in the document footer on any page (Home and Account are the usual places collectors notice it).

## Driving it with verify-lost-tales

Preconditions:

- ShardStash is healthy at `http://127.0.0.1:5173`.
- The browser session may be signed in or signed out.
- `doctor` reports `ok=true`.

- **About from footer.** From home, choose About. Run `$VERIFY drive goto --path /` then `$VERIFY drive click --role link --name About`. The heading `About` is visible. Body copy includes tracking what you own and trading extras, plus a mailto link `shardstashinfo@gmail.com`.
- **Direct load.** Open `/about`. Run `$VERIFY drive goto --path /about`. The same heading and footer `About` / `Feedback` remain visible.
- **Feedback dialog.** Open Feedback. Run `$VERIFY drive click --role button --name Feedback`. A dialog heading `Send site feedback` is visible, with copy that this is for product and site feedback, not trade match contact. Close with `$VERIFY drive click --role button --name Close`.
- **Proof.** Capture About and the open dialog. Run `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/about/about.png --full-page`, `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/about/about.aria.txt`, then open Feedback and `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/about/feedback.png --full-page` plus `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/about/feedback.aria.txt`. Artifacts show the About heading, footer About/Feedback, and the Send site feedback dialog.

## Gotchas

- About and Feedback are site chrome, not primary-nav items. Do not look for them under `aria-label="Primary"`.
- Feedback stays a dialog on the current route; it does not navigate to `/about`.
- Discord names and places in the About paragraph and the dialog must match the live copy (`gimpy_12`, `1bjax`, Sanderson Collectors Guild, Story Deck Bazaar). Do not invent extra contact channels.
