# Version two publishes through Proposals and a Next Release

Version one's Publish goes straight from a Draft to a commit on `main` and a Release, so nobody sees a real build first, several people can't work side by side, and an edit that lands between someone's look and the Release ships unseen. From version two, a Client's work goes into a Proposal (a branch and pull request with its own Preview), Proposals are merged into the Next Release (`main`, with one Preview everyone shares), and Publish turns the exact commit people looked at into a Release. Version one keeps ADR-0003's direct Publish until this is built, so the pilot can show what Clients really need first.

## Considered Options

- **One open Preview per Site, which every send adds to**: rejected because one person's pending Change could not ship without another's, and several pieces of work need to stay in progress at once.
- **Changes going straight into the Next Release, with no Proposals**: rejected because no piece of work could be looked at on its own.
- **Reconciling Proposals with Git's merge or rebase**: rejected because Git does not understand Fields: edits on neighbouring lines collide, and formatting causes false conflicts.
- **A commit that bumps `package.json` at Publish**: rejected because the released commit and its image would differ from what people looked at.
- **Bumping `package.json` at every Merge**: rejected because a Next Release holding only Developer commits could not be published, and every Proposal would touch the same file.

## Consequences

This replaces ADR-0003's "a Publish makes one commit to `main`" and the version one spec's exclusion of approval steps. The rest of ADR-0003 stands: Edity only observes deployment, and `main` must stay releasable.

Publish names a commit and is refused if `main` has moved since, so the person looks again. Release tags that commit and promotes its `sha-<commit>` image, the same image the Next Release Preview runs. The version comes from the latest tag, not from `package.json`, and the Developer's manual releases pass minor or major as an input. A Release is started by Publish, no longer by CI passing on a bot's commit.

Proposals are reconciled per Field. For each Field or List a Proposal changed, the server compares where it started, the Proposal now and the Next Release now: a change only the Proposal made carries over, and one both made is a Conflict the Client resolves. A Proposal behind the Next Release must be updated before it can be merged. Any Client with the Site's role may Merge and Publish.

The steps after editing live in a separate app, the Hub, on its own hostname. The Editor stays on the Site's own origin (ADR-0001). Previews sit behind the Zitadel login through Cloudflare Access, because Clients are not on Tailscale.
