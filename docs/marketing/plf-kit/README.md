# PLF LTP Launch Kit (Implemented)

This kit operationalizes the PLF onboarding sequence into runnable assets.

## What is included

- `templates/day-1.md` ... `templates/day-7.md` — copy-ready message drafts
- `scorecard-template.csv` — daily conversion tracker
- `scripts/marketing/generatePlfCampaign.js` — generates a campaign packet with your project/team metadata

## Generate your campaign packet

```bash
npm run -s marketing:plf:generate -- --project "LTP Pilot" --owner "Platform Team"
```

Output:
- `artifacts/marketing/plf-campaign-<timestamp>/`
  - `day-1.md` ... `day-7.md`
  - `scorecard.csv`
  - `campaign-summary.md`

## Recommended usage

1. Generate a packet.
2. Edit only placeholders and audience specifics.
3. Use one CTA per day.
4. Track activation/evidence in the scorecard.
