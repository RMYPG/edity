# 34. Manage the Release on Publish variable as code

Status: needs-triage
Repo: RMYPG/platform
Milestone: After v1
Blocked by: 27
Covers: N8 (see the [spec](../spec.md))

## What to build

Ticket 27's workflow releases a Publish only on Sites whose `EDITY_PUBLISHER_LOGINS` repository variable lists the publisher App's login. Today that variable is set by hand with `gh variable set`. An organization variable is not an option, because RMYPG is on GitHub Free and the Sites are private. Manage the variable as code in `platform`, in a separate Pulumi stack for GitHub repository settings, so the change that adds a Site to `platform` also sets it. The work is tracked in [RMYPG/platform#58](https://github.com/RMYPG/platform/issues/58).

## Acceptance criteria

- [ ] Connecting a Site sets its `EDITY_PUBLISHER_LOGINS` from the same `platform` change that adds the Site, with no `gh variable set` step
- [ ] The stack takes over the value set by hand on `edity-sandbox` on 2026-10-25
- [ ] The "Add a Site to Edity" checklist from RMYPG/platform#42 has no manual variable step

## Notes

Until then, set the variable by hand once the App is installed on a Site:

```sh
gh variable set EDITY_PUBLISHER_LOGINS --repo RMYPG/<site> --body 'edity-publisher[bot]'
```

After ticket 28, `edity-sandbox` takes `edity-publisher-dev[bot]`, or `edity-publisher[bot],edity-publisher-dev[bot]` while both Apps are installed.

Alternative considered: default the workflow to `edity-publisher[bot]` when the variable is unset, and set the variable only on the sandbox. Client Sites would then need no step at all, but this goes against ticket 27's "instead of hard-coding".
