# Homepage discovery-call redesign

The homepage leads with property management franchise ownership, active owner
direction, and New Dawn's operating support. The approved New Dawn logo, navy and
gold palette, and arrival-in-America image carry the design. Telecom and insurance
are available at `/other-businesses`; existing supporting pages and portals retain
their current layout.

## Content and conversion flow

- The primary action is consistently **Book a discovery call**, using Dylan's
  existing 30-minute Calendly link. Header, hero, discovery section, and mobile
  sticky placements share `DiscoveryCallLink`.
- The investment starting point, owner responsibilities, and visa qualification
  are visible without opening a panel. Nine native `details` elements provide
  owner, support, technology, team, eligibility, location, investment, financing,
  and FDD detail. They work independently with mouse, touch, Enter, and Space.
- Packages start at $225,000 as advertised on the source homepage; the current
  FDD determines the full property management investment. Escrow and refund
  language refers to the applicable written agreements. Visa and financial
  outcomes are not guaranteed.
- Existing visitor tracking is retained. `discovery_call_click` records the CTA
  placement; it does not claim a completed Calendly booking.
- Footer links retain team, partners, resources, portal, legal, and language access.

## Implementation and verification

`client/src/components/franchise` contains the shared layout, scoped styles,
homepage sections, native disclosures, and booking link. Search-rendered content
in `server/page-shells.ts` and service structured data mirror the new positioning;
the sitemap includes the new secondary page. Keep both visible and search content
in sync when editing copy.

Local validation includes TypeScript, the production build, and the four
`tests/homepage-shell.test.ts` regression tests (also added to CI). Browser checks
covered desktop navigation, nine-panel keyboard operation, independent panels,
CTA destinations, hash navigation, the secondary page including trailing-slash
URLs, and 375px/320px layouts with every panel expanded and no horizontal overflow.
The existing About page and its chat layout were checked separately.

Navigation, homepage, and chat Playwright specs were updated and syntax-checked.
The full browser suite was not run; the focused interactions above were exercised
through the browser tools. Production verification uses read-only requests and
the rendered website, without submitting forms or booking an appointment.

Production read-back also uncovered and corrected an existing Express fallback
issue: the wildcard mount strips `req.path`, so search HTML must use the original
requested URL. Request-level regression coverage checks homepage, secondary page,
query parameters, About metadata, canonical URLs, and static assets.
