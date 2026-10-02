# Design log

Every design decision, oldest first: the question, what was tried, what Pritam
picked and why. Shown in the design system as **Design log / The story so far**
(`src/log/DesignLog.stories.js`); the words live in `entries.json`.

Nothing tried is thrown away. A decision's variants either stay in the design
system (`live`: the boards that still show them) or, once retired from the
working tree, stay in git at the commit before they were removed (`archive`),
pinned by a tag:

```bash
git checkout design-log/2026-10-01-element-styles   # the code as it was, all six styles
```

Each archived decision is photographed into `<id>/sheet.jpg` (with
`manifest.json`, the stories in it) by building that day's Storybook in a
temporary worktree:

```bash
/usr/bin/node design-system/scripts/design-log-all.mjs            # any decision without a sheet
/usr/bin/node design-system/scripts/design-log-all.mjs --force <id>  # again, for one
```

To log a new decision: add an entry to `entries.json` (live boards in `live`,
or the archive commit and its `capture` arguments for `design-log.mjs`), tag the
archive commit `design-log/<id>` and push the tag.
