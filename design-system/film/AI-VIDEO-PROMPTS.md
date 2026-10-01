# Sign-in film: prompts for AI video tools

The film in the sign-in window, made in Remotion here (`src/SignInFilm.tsx`), as prompts for trying the same idea in AI video tools (Veo, Sora, Kling, Runway, Luma). Copy a prompt as it is; the stills beside it in the downloads are the matching frames from our film, for tools that start from an image.

**What it must be:** 10–12 seconds, a seamless loop, no sound. Shape 9:10 (1080 × 1200), or make it 9:16 and crop the middle. Slow, soft camera moves and eases; nothing bounces or snaps. A bright blue sky with cumulus clouds behind a modern phone with a light, calm app on screen.

**Watch for:** these tools still garble small on-screen text. Either start from our stills (image-to-video), or let the tool make the motion and drop our real screens in afterwards. No app or social logos (no Instagram, TikTok, YouTube or X marks), no real people's faces, no brand names on products.

## Master prompt (one shot, the whole loop)

> A seamless 11-second looping motion-graphics product film, 9:10 vertical. A bright blue summer sky with soft cumulus clouds, gently out of focus, fills the frame. In the centre, slightly below middle and cropped by the bottom edge, floats a sleek modern smartphone with thin black bezels, softly lit, drifting a few pixels up and down. On its screen: someone is watching a short cooking video of tomato pasta; a white share sheet glides up, a dark app icon is tapped with a soft ripple, and a small white pill reading "Saved" drops in at the top. The screen then dissolves into a calm, light, pale-blue photo library app. From the left and right edges of the frame, floating white cards — a vertical video card, a square photo card with a heart, a social post card, an article page — arc gracefully through the sky into the phone and settle into a tidy two-column grid; small mint tags pop onto each card. The camera eases in towards a search bar at the top of the screen as a word is typed; non-matching cards fade away and three food photos slide to the top. A white chat sheet rises from the bottom: a dark message bubble, then an answer bubble with a small violet sparkle lists three food photos and a soft green check appears. Everything dissolves back to the pasta video, and the loop begins again. Clean Apple-style UI, generous white space, soft shadows, natural daylight, premium, calm, smooth eased motion, no fast cuts, no bounce, 30 fps.

**Negative / avoid:** logos, brand names, watermarks, readable fine print, distorted text, extra fingers or hands, people's faces, cluttered UI, neon colours, dark mode, glitch effects, fast cuts, whip pans, camera shake, bouncing animations, lens flares.

## Scene by scene (about 2.7 seconds each)

Use each still as the start frame; for a loop, give scene 4 the scene 1 still as its end frame.

**1 — Share** (`sign-in-film-1-share.png`)
> Smartphone floating in a soft-focus blue cumulus sky. On screen, a short cooking video of tomato pasta with basil plays, the camera slowly pushing in. A white share sheet glides up from the bottom with a small preview of the video and a row of four rounded app icons; the first, a dark icon with a white bookmark, is tapped with a gentle blue ripple. The sheet slides away and a small white pill with a green check drops in at the top. Smooth, eased, calm. 9:10, no logos, no text other than short labels.

**2 — One place** (`sign-in-film-2-one-place.png`)
> The phone now shows a light, pale-blue photo library app with a large title and a two-column grid. From the left and right edges of the frame, floating white cards — a vertical video card, a square photo card with a red heart, a social post card, an article page — arc through the blue sky into the phone and settle exactly into the grid, each shrinking into place. Small mint tags pop onto each card one after another. Gentle drift, soft shadows, eased motion. 9:10.

**3 — Find** (`sign-in-film-3-find.png`)
> The camera eases in towards the search bar at the top of the phone screen; the field gains a blue outline and a short word is typed. The grid reflows smoothly: cards that don't match shrink and fade, and three food photos — pasta, ramen, tacos — glide up into the top rows. The camera eases back out. Calm, precise, smooth. 9:10.

**4 — Your agent** (`sign-in-film-4-agent.png`)
> A white sheet rises from the bottom of the phone screen over the library, with a small glowing pearl orb and a title. A dark chat bubble types out a short request; three soft dots pulse; an answer bubble with a small violet sparkle appears and lists three food photos one by one, then a soft green check pill. The camera lifts slightly to follow. Then everything dissolves back to the pasta video from the start. Smooth, eased, premium. 9:10.

## Notes per tool

- **Google Veo 3:** 9:16 or 16:9 only — make 9:16 and crop. Turn sound off. Use the master prompt; Veo handles the camera language well.
- **OpenAI Sora:** set 9:10 directly (or 4:5). Storyboard mode: one card per scene above.
- **Kling (2.x):** image-to-video with start and end frames; scene 1 still as both start and end gives a loop.
- **Runway (Gen-4):** start from a scene still; add "smooth eased motion, no camera shake" to each.
- **Luma (Ray 2):** keyframes from the stills, and its loop option for a seamless loop.

Send back anything you like; it can replace or join our film in `apps/mobile/assets/video`.
