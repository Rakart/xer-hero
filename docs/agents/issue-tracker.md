# Issue tracker

This repo has no hosted issue tracker. Issues live as markdown files in `docs/wayfinder/`.

## Wayfinding operations

How the `wayfinder` skill's concepts map onto this tracker.

### Layout

```
docs/wayfinder/
  map.md                  the map — one per effort
  tickets/
    NNN-slug.md           child tickets of the map
    assets/               research notes, prototypes, anything a ticket produces
```

`NNN` is a zero-padded sequence number, allocated by taking the highest existing
number and adding one. It is the ticket's identity — the equivalent of an issue
number.

### Ticket front-matter

Every ticket file starts with YAML front-matter:

```yaml
---
id: 007
title: The storefront card and browse grid
type: prototype        # research | prototype | grilling | task  (the wayfinder:<type> label)
status: open           # open | closed | out-of-scope
assignee:              # empty means unclaimed; set to claim
blocked_by: [006]      # ids of tickets that must close first
---
```

The map itself carries `type: map` and no `blocked_by`.

### Claiming

A session claims a ticket by setting `assignee` and committing that change
**before** doing any work, so a concurrent session skips it. An open ticket with
an empty `assignee` is unclaimed.

### The frontier

Open, unblocked, unclaimed tickets:

```bash
# every open ticket and what blocks it
grep -H -e '^status:' -e '^blocked_by:' -e '^title:' docs/wayfinder/tickets/*.md

# ids of closed tickets (a blocker is cleared when its id appears here)
grep -l '^status: closed' docs/wayfinder/tickets/*.md
```

A ticket is unblocked when every id in its `blocked_by` belongs to a closed
ticket. Take the lowest-numbered frontier ticket unless the user names one.

### Resolving

1. Append a `## Resolution` section to the ticket file — this is the resolution
   comment.
2. Set `status: closed` in the front-matter.
3. Append a one-line pointer to **Decisions so far** in `map.md`, linking the
   ticket by its title.

Assets a ticket produces go in `docs/wayfinder/tickets/assets/` and are linked
from the ticket, not pasted into it.

### Out of scope

Set `status: out-of-scope`, leave the body as-is, and add a line to the map's
**Out of scope** section. It never appears in **Decisions so far**.

### Migrating to GitHub Issues

If this repo later gets a GitHub remote, the natural upgrade is: map → issue
labelled `wayfinder:map`, tickets → sub-issues, `blocked_by` → native issue
dependencies. Rewrite this section when that happens.
