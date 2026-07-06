# Empty states & launch gating — July 2026

Nothing in Arcaevo pretends to have data it doesn't. Every "no data yet" surface is a
designed state with the same voice as the rest of the product: honest, calm, and clear
about what unlocks it. Never a spinner where a sentence would do; never a guessed number.

## iOS + watchOS — Day-one mode

`Prototype.dc.html` has a **DAY-ONE MODE** toggle at the bottom of the rail (also the
`dayOneMode` tweak). It shows the designed empty variants for the nine data screens:

| Screen | Empty state |
|---|---|
| Member home | Dashed "—" ring, "Your baseline starts tonight", sample-at-the-lab card, Watch data marked ALREADY FLOWING, dashed "while you wait" upload nudge |
| Readiness | "Three nights first." — NIGHT 1 OF 3 progress, collecting… rows, "why the wait" honesty card |
| Fusion timeline | Watch line already drawing, dashed hollow circles where blood anchors will land, upload CTA |
| Results | "No results yet — and that's on schedule." — received/processing/review status, how-results-arrive note |
| Insights | "Nothing worth saying yet." — plus one muted EXAMPLE card; "silence is a feature" |
| Experiments | "Your first comes with your results." — muted example suggestion, disabled unlock pill |
| Timeline (Your data) | "Nothing on file yet." — dashed placeholder chart, upload / type-by-hand CTAs |
| Watch — Today | Dashed ring, "Learning you", first readiness after three nights |
| Watch — Experiment | "None running." — start on iPhone after results |

Design rules: dashed strokes (`stroke-dasharray` rings, dashed borders) always mean
"not yet"; an em-dash `—` where the number will be; the copy says *when* it unlocks and
*what to do meanwhile* (usually: nothing, or add past bloodwork). Empty screens still get
the full motion treatment. No haptics fire on empty surfaces.

## Marketing site

- **Careers** (`Careers.dc.html`): no roles are open. The board renders a designed empty
  state (dashed card, mark glyph, "Nothing open right now.", open-application CTA +
  journal pointer). Re-open by adding entries to the `roles` array in the file's logic —
  the empty state hides automatically.
- **Pricing — early-access gate** (`Pricing.dc.html`, `earlyAccessMode` tweak, default ON):
  while kit fulfilment and the nurse rota aren't live, Essential and Performance CTAs
  become **"Get early access →"** with a `NOT ON SALE YET` mono note, anchoring to an
  early-access form (name, email, Eircode routing key, plan chips → confirmation state).
  Nobody can start a checkout for a plan that can't be fulfilled. Fusion (software-only)
  stays purchasable. The Home CTA mirrors this ("Get early access" secondary button).
  Flip `earlyAccessMode` off at launch: the original Start CTAs return and the form
  section disappears.

Production note: the form posts name/email/routing-key + plan interest; one email on
area opening, founding-member pricing honoured — same promise as the in-app waitlist
(`waitlist` screen in the prototype). Keep the copy identical across both.
