# Edity

An inline editor that lets a Client change the text, numbers and lists of their own static Astro landing page, within limits the Developer sets, and publish the result as a new release of the site.

## Language

### People

**Client**:
The person who edits the content of a Site they own. One or two per Site, all known to the Developer.
_Avoid_: Editor, user, owner

**Developer**:
The person who writes the Site's code and decides which parts of it are editable.
_Avoid_: Admin, maintainer

### Sites

**Site**:
One Astro landing page with its own repository, written by the Developer.
_Avoid_: Project, website, landing

**Migration**:
The one-time change to a Site's source code that moves its editable content into content files and marks it up for the Editor.
_Avoid_: Onboarding, setup, integration

### Editing

**Editor**:
The in-page tool a Client uses to change content on their Site.
_Avoid_: CMS, admin panel, dashboard

**Field**:
One editable value (a text or a number) at a fixed path in a Site's content.
_Avoid_: Property, input, block

**List**:
A bounded, ordered collection of Items that a Client can add to, remove from and reorder. A List is not a Field.
_Avoid_: Array, collection, repeater

**Item**:
One entry in a List, made of Fields and at most one nested List. A plain bullet is an Item with a single text Field.
_Avoid_: Entry, row, element

**Field definitions**:
The Developer's description of which Fields and Lists a page has, and their Limits. Specific to each page of each Site.
_Avoid_: Schema, model, config

**Limit**:
A constraint the Developer puts on what a Client may enter: on a Field, a maximum character count, a maximum line count or a number range; on a List, a minimum and maximum number of Items.
_Avoid_: Rule, validation

### Publishing

**Change**:
One unit of a Draft: either an edit to a Field, or an edit to a List's structure (Items added, removed or reordered), which counts as one Change for the whole List.
_Avoid_: Edit, modification, diff

**Draft**:
The set of changes a Client has made that are not yet published.
_Avoid_: Changeset, pending edits

**Publish**:
The Client's action of sending a Draft so that it becomes a new release of the Site.
_Avoid_: Save, deploy, commit

**Release**:
A tagged, versioned build of a Site, ready to be deployed. Every Publish produces one Release; deploying it is outside Edity.
_Avoid_: Version, build, deployment

**Conflict**:
A Field in a Draft whose stored value no longer matches the value it had when the Client started editing it.
_Avoid_: Clash, collision
