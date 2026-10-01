# Films

Motion-graphics films for FoundKeep's app screens, made in [Remotion](https://www.remotion.dev) and rendered to video. Self-contained: its own `node_modules`, nothing installed at the repo root.

- `src/SignInFilm.tsx` — the sign-in window's 11-second loop: save a reel, it lands in one place, find it again, your agent uses it. Drawn in the window's 360 × 400 points and rendered at 1080 × 1200.
- Images come from the app (`remotion.config.ts` points at `apps/mobile/assets/images`): the sky, the cards in `elements/`, and the sample photos in `film/` (GPT-6 Astra; prompts in its `PROMPTS.md`). The content is made up on purpose: the film ships to every user, so no one's real saves are in it.
- Inter stands in for SF Pro, which can't be built into a video.

```bash
cd design-system/film && npm install
npm run studio                    # preview and scrub in the browser
/usr/bin/node render.mjs          # → apps/mobile/assets/video/sign-in-film.mp4 + .jpg poster
```
