# CatClash User System

## Voting System
- Users see two cats.
- Vote is stored client-side and server-side.
- Matches are not repeated once voted (unless debug reset).

## Arena Flow
- Deck loads 6 matches per page.
- When page_complete = true, new page is fetched.
- Match refresh respects fair rotation rules.

## Debug Controls
- ?debug=1 enables manual refresh/reset.
- Debug features must never expose admin secrets.
