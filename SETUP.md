# Aisle & Acre v5: going live

v5 is v4 with small fixes: the "For venues" page no longer mentions featured placement, long search descriptions are trimmed, two capitalisation slips are fixed, and the four vineyard venues link to their Thatch & Trail pages.

What's new: a 3D map of Sussex (desktop), a weekly cross-check against the government's approved venues list,
and a monthly check of every venue's own website that flags changes for you to review. No keys or passwords needed.

1. Buy aisleandacre.co.uk if you haven't yet.
2. GitHub: create a private repository called aisle-and-acre. "Add file" → "Upload files" → drag in everything in this
   folder (the site and netlify folders, netlify.toml, package.json).
3. Netlify: "Add new site" → "Import an existing project" → GitHub → aisle-and-acre → Deploy.
   It reads netlify.toml, so there is nothing to fill in.
4. Netlify → Domain management → add aisleandacre.co.uk and follow the DNS steps (add www too).
5. Netlify → Functions:
   - refresh-register → "Run now". Venue pages then show a note when the venue is on the government list.
     It runs again every Monday.
   - check-venues → "Run now". The first run records each venue's page; from next month it flags changes.
6. Netlify → Forms → turn on form detection, so couples' enquiries reach you.
7. Search Console: add aisleandacre.co.uk and submit https://www.aisleandacre.co.uk/sitemap.xml
8. Email: forward hello@aisleandacre.co.uk to your new Aisle & Acre Gmail (most registrars do free forwarding),
   and add it under Gmail → Settings → Accounts → "Send mail as" so you can reply from it.

Quick alternative: dragging just the "site" folder onto Netlify also works, but the weekly and monthly checks
only run through the GitHub route.

Where to see the checks:
- https://www.aisleandacre.co.uk/api/register — which of our venues are on the government list, plus Sussex venues
  on the list we haven't covered yet (your shortlist of venues to add).
- https://www.aisleandacre.co.uk/api/changes — venue pages that changed at the last monthly check.
The evening inbox check reads both and tells you when something needs a look.
