# Live editing shares presence and whole Fields, not keystrokes

From version two, people on the same page see each other's cursors and hover, the Field someone is typing in is held for them, and its new value reaches everyone in the same Proposal when they leave it. A Field is already the unit of a Change, so it can also be the unit of who is working on what: nobody types in one Field at the same time as someone else, so nothing is merged letter by letter and no shared document has to be stored. The connection is a WebSocket inside `edity-server` with rooms in memory, because one or two Clients per Site will not outgrow one replica.

## Considered Options

- **Presence only**: rejected because values would reach other people only when a Draft is sent.
- **Full co-editing with a CRDT such as Yjs**: rejected because it needs a server that stores each shared document between visits.
- **A hosted service such as Liveblocks or Ably**: rejected because Client names and content would pass through a third party, and it is an ongoing bill.
- **A separate Elixir service with Phoenix Presence**: not chosen for now. The current recommendation is against it at scale too, because it adds a third language for one Developer and still runs in the same cluster, so availability does not improve.
- **Cloudflare Durable Objects from the start**: not chosen for now, because it adds TypeScript code outside the Go server before anything needs it. It is the current recommendation if live editing outgrows `edity-server`.

## Consequences

Rooms are the only state the server holds, and they are disposable: after a restart, browsers reconnect. Saved values live only in GitHub. The server commits to a Proposal at most once every 30 seconds, marked `[skip ci]`, and browsers keep values until a commit is confirmed. A Proposal's Preview rebuilds only on request and at Merge.

Two choices keep a later move cheap: the live code is its own package importing nothing from publishing, and the Editor connects with a short-lived ticket from `edity-server` rather than the session cookie. If restarts cut live sessions too often, the same code can run as a second Deployment. What comes after that is a recommendation to revisit at scale, not a decision: look at it again when live editing has to survive cluster maintenance, when more than one replica is needed, or when in-progress saves hit GitHub's limit of 500 content-generating requests an hour. The recommendation today is Durable Objects, holding in-progress values in the room's own storage and committing only at checkpoints. The number of connections alone is not a reason to revisit it.
