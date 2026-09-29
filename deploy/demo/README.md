# FoundKeep live demo

The design system's **Live** entries run the real app and dashboard, clickable,
inside the simulator's frames, against a throwaway backend with the sample world.

| Port | Service | |
|---|---|---|
| 8817 | `foundkeep-demo-backend` | the backend (`apps/backend`), data in `~/.local/share/foundkeep-demo/data`, loopback |
| 8819 | `foundkeep-demo-site` | the dashboard, a packaged release in `~/.local/share/foundkeep-demo/site/current`, loopback |
| 8818 | `foundkeep-demo-gateway` | `gateway.mjs`: the app's web build at `/app/`, everything else to the dashboard; public as https://omni--8818.getbb.app |

The app's web build calls foundkeep.app; the gateway rewrites those requests to
its own origin, so both products share one origin and one backend. Only the
Storybook (https://omni--8814.getbb.app) may frame the demo.

```sh
deploy/demo/build.sh          # from the main checkout: build dashboard + app releases
deploy/demo/install.sh        # install/refresh the three user services
bb connect expose 8818        # once: the public URL
/usr/bin/node deploy/demo/seed.mjs   # reset the demo account to the sample world
```

The demo account's password is in `~/.local/share/foundkeep-demo/state.json`
(mode 600). It only opens this throwaway instance. The web version of the app is
close to iOS but not exact; TestFlight and the Android build stay the last check.
