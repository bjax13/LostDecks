# About and feedback

About explains what ShardStash is for. The footer on every page opens that page and a site-feedback dialog with the public email and Discord contacts.

## Sub-features

- `site-about` shows the About heading and the short product description.
- `site-feedback` opens Send site feedback from the footer Feedback button and closes it.
- `site-feedback-fab` shows Submit feedback only when PostHog is configured. The default verification launch leaves that button out.

## How to get to it (user POV)

- Choose `About` in the page footer from any route, including Home.
- Open `/about` directly.
- Choose `Feedback` in the page footer. The dialog stays on the current page.
- Choose `Submit feedback` when that button is on the page (PostHog survey configured).

## Driving it with verify-lost-tales

Preconditions:

- ShardStash is healthy at `http://127.0.0.1:5173`.
- The browser session may be signed out.
- `doctor` reports `ok=true`.
- PostHog is not configured (launch sets an empty `VITE_POSTHOG_KEY`), so `Submit feedback` is absent.

- **About.** From Home, choose About. Run `$VERIFY drive goto --path /` and `$VERIFY drive click --role link --name About`. Heading `About` is visible. Expect it with `$VERIFY drive expect --role heading --name About --exact`. The page mentions Story Deck and ChasmFriends.
- **Site feedback.** Choose Feedback. Run `$VERIFY drive click --role button --name Feedback`. A dialog named `Send site feedback` is visible, with heading `Send site feedback`, and the body mentions product and site feedback, `shardstashinfo@gmail.com`, Sanderson Collectors Guild, and Story Deck Bazaar. Close with `$VERIFY drive click --role button --name Close`.
- **No survey button.** Confirm the PostHog control is absent. Run `$VERIFY drive count --role button --name "Submit feedback"`. The count is 0.
- **Proof.** Capture About with the feedback dialog open. Run `$VERIFY drive click --role button --name Feedback`, `$VERIFY drive screenshot --path /tmp/lost-tales-verify/artifacts/site/feedback.png --full-page`, and `$VERIFY drive snapshot --path /tmp/lost-tales-verify/artifacts/site/feedback.aria.txt`. Artifacts show `About` and `Send site feedback`.

## Gotchas

- `About matching settings` on Account is a different control. Use the footer link `About`, and `--exact` on the About heading.
- Footer `Feedback` is the mailto/Discord dialog. It is not the trade-match contact on a Matches card.
- `Submit feedback` renders only when `VITE_POSTHOG_KEY` is set. Launch clears that variable, so a count of 0 is the expected emulator result. Do not treat the missing button as a broken footer.
