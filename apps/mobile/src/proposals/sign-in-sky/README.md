# Sign in · Sky ideas

Pritam’s final direction keeps the reference layout: physical floating objects around the edges, the glowing FoundKeep mark and white headline centred, provider buttons at the bottom, then email. These five proposals vary the objects, their arrangement, copy and sky tones. The earlier typographic/card layouts were replaced.

All objects are generated imagery; text, controls and layout are React Native. They enter from their nearest edge over 1.65 seconds, with a soft exponential ease-out, no spring or overshoot, then continuous sine drift with independent periods. The emblem and headline settle in the centre; buttons rise last. Reduced motion shows the completed composition.

## Variants and copy

Story title: `Proposals/Sign in · Sky ideas`.

| Story ID | Idea | Copy A (shown) | Copy B |
| --- | --- | --- | --- |
| `proposals-sign-in-·-sky-ideas--found-things` | Six keepsakes, balanced around the reference composition. | Meet FoundKeep, a place for things worth keeping. | Everything you find. A place to keep it. |
| `proposals-sign-in-·-sky-ideas--worth-keeping` | A highlighted note and open folder lead, with warm paper and apricot accents. | That’s a keeper. Give it a place to stay. | For the things you’ll want to find again. |
| `proposals-sign-in-·-sky-ideas--curiosity` | Saved webpages and highlights, on a slightly more cobalt sky. | Follow your curiosity. Keep what you find. | Good ideas start with a little “I’ll keep that.” |
| `proposals-sign-in-·-sky-ideas--little-moments` | Photos, video and a jade voice memo, with faint photographic clouds. | A thought. A photo. A little moment. Keep it here. | Some things are too good to scroll past. |
| `proposals-sign-in-·-sky-ideas--your-corner` | Four larger keepsakes at the corners; a quieter centre and photographic sky. | Your own corner for everything worth keeping. | Found out there. Kept right here. Just for you. |

The middle dot is part of each Storybook ID (URL-encode it as `%C2%B7` when needed).

## Assets

See [the exact GPT image prompts](../../../assets/images/sign-in-sky/PROMPTS.md). The six objects are independently cropped transparent WebPs, 400 × 400 and 17–29 KB each. The optional cloudscape is 800 × 1200, 34 KB. Existing FoundKeep mark geometry is unchanged.

## Behaviour and accessibility

- Real provider discovery through the session client, Google before Apple, routing to `/oauth/complete` with `intent: sign-in`.
- Existing `EmailSheet` and `gradient()` reused; failed provider discovery leaves email available.
- One ScrollView contains the hero and actions. Object bands frame the content and grow apart with larger text. Small phones and 200% text scroll instead of placing the headline under the buttons. Text scaling is uncapped.
- Dark footer ink uses a controlled pale ground. White headlines use saturated blue, including a low-opacity cloud layer for variants 4–5.
- Native animation driver everywhere except web. Every animation cleans up on unmount or motion preference changes.
- Story-only `MotionBoundary` makes the reduced-motion toolbar reliable: RN Web captures its media-query object before the simulator overrides `matchMedia`.

## Verification

App Storybook (`hub app`) build and mobile `tsc --noEmit` pass. Render checks pass all five stories at default settings, dark/200% text, iPhone SE, and reduced motion. Browser interaction checks at actual 375 × 667, at both 100% and 200%, verify both provider routes, email open/close, reachable controls and no horizontal text overflow. Reduced-motion capture remains stationary after providers finish loading.

Checks use React Native Web in Storybook, not native device binaries or live OAuth completion. These are review proposals only: no production or dev deployment and no running shared Storybook service changes.

Contact sheets remain on the authoring host:

- `/tmp/sky-ideas.png`
- `/tmp/sky-ideas-large-text.png`
- `/tmp/sky-ideas-se.png`
