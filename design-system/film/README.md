# Films

Motion-graphics films for FoundKeep's app screens, made in [Remotion](https://www.remotion.dev) and rendered to video. Self-contained: its own `node_modules`, nothing installed at the repo root.

- `src/SignInFilm.tsx` — the sign-in window's 11-second loop: share a reel you're watching, it lands in one place as other finds fly in, find it again, your agent uses it. The phone shows the app's real library (its palette and layout). Drawn in the window's 360 × 400 points and rendered at 1080 × 1200, twice: `SignInFilm` (sky lightly softened, for the light page) and `SignInFilmSoft` (sky far more blurred, for the sky page).
- `AI-VIDEO-PROMPTS.md` — the same film as prompts for AI video tools (Veo, Sora, Kling, Runway, Luma).
- `src/PollFilm.tsx` + `poll.mjs` — the shortlisted sign-in screens side by side at 1920 × 1080, numbered, to post and ask. The screens are captured from the running design system frame by frame (`../scripts/capture-story.mjs`: the page's clock is frozen and stepped, videos are seeked to match), so the poll shows the real screens.
- Everything is drawn at full resolution each frame, with flat (2D) transforms only; the app's films are downsampled from 4K masters (3456 × 3840) so small text stays sharp.
- Images come from the app (`remotion.config.ts` points at `apps/mobile/assets/images`): the sky, the cards in `elements/`, and the sample photos in `film/` (GPT-6 Astra; prompts in its `PROMPTS.md`). The content is made up on purpose: the film ships to every user, so no one's real saves are in it.
- Inter stands in for SF Pro, which can't be built into a video.

```bash
cd design-system/film && npm install
npm run studio                    # preview and scrub in the browser
/usr/bin/node render.mjs          # → 4K masters in downloads/, the app's copies in apps/mobile/assets/video
                                  #   (+ .jpg posters), scene stills and the AI prompts in downloads/ (served at /downloads)
/usr/bin/node poll.mjs            # → downloads/sign-in-poll-1080p.mp4 (needs the design system running on :8814)
```
