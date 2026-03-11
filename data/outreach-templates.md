# NHL Media Outreach — Email Templates

## Merge Fields
- `{{contact_name}}` — Recipient's first name or full name
- `{{team_name}}` — Full team name (e.g. "Buffalo Sabres")
- `{{team_url}}` — Direct link to their team's tracker page (e.g. "https://nhltracker.com/sabres")
- `{{outlet_name}}` — Their publication/show name

---

## Template 1: Cold Outreach

**Subject:** Free tool for {{team_name}} coverage — NHL Tracker

Hi {{contact_name}},

I'm a developer and hockey fan who built NHL Tracker — a free, real-time dashboard for every NHL team. I wanted to share it because I think it could be useful for your {{team_name}} coverage at {{outlet_name}}.

Here's the {{team_name}} page: {{team_url}}

It pulls live data from the NHL API and shows:
- Live scores and game results
- Full standings with playoff odds
- Team stats, streaks, and schedule
- AI-generated blog posts with daily recaps

Buffalo sports radio (WGR 550) recently mentioned it on air and their listeners loved it, so I'm reaching out to media folks in other markets who might find it useful — whether for personal reference, content ideas, or sharing with your audience.

It's completely free, no ads, and works great on mobile. Would love to hear what you think.

Best,
Josh Rabenold
NHL Tracker — {{team_url}}

---

## Template 2: Follow-Up (5-7 days after no response)

**Subject:** Re: Free tool for {{team_name}} coverage — NHL Tracker

Hi {{contact_name}},

Just wanted to bump this in case it got buried — I built a free real-time dashboard for every NHL team and thought it might be useful for your {{team_name}} coverage.

Here's the direct link: {{team_url}}

A few things that might be interesting for your work:
- Playoff odds update daily with Monte Carlo simulations
- Schedule view shows upcoming opponents and recent results at a glance
- Works great on phone during games or pressers

No pressure at all — just thought it could be a handy tool. Happy to answer any questions.

Best,
Josh Rabenold

---

## Template 3: Radio/Podcast Pitch

**Subject:** {{team_name}} data tool — available for on-air use or guest spot

Hi {{contact_name}},

I'm a developer who built NHL Tracker, a free real-time dashboard for every NHL team. I've been listening to {{outlet_name}} and thought this could be a useful resource for your show.

Here's the {{team_name}} page: {{team_url}}

The site has real-time standings, playoff odds (Monte Carlo simulations), and AI-generated daily recaps — all pulled from official NHL data. Buffalo's WGR 550 mentioned it on-air recently and it got a great response from listeners.

A few ways this could work for your show:
- **On-air resource:** Quick reference for standings, stats, and playoff scenarios during broadcasts
- **Listener engagement:** Share the link — fans love checking playoff odds daily
- **Guest segment:** Happy to come on and talk about the data behind playoff odds, team trends, or how the tool works

The site is free, no login required, and works on any device. Would love to chat if you're interested.

Best,
Josh Rabenold
NHL Tracker — {{team_url}}

---

## Usage Notes

### Sending Order
1. Start with Tier 1 teams (bubble teams + large fanbases): Sabres, Bruins, Red Wings, Penguins, Rangers, Islanders, Maple Leafs, Canadiens
2. Then Tier 2 (contenders): Avalanche, Oilers, Hurricanes, Lightning, Stars, Wild, Panthers, Golden Knights
3. Then all remaining teams

### Template Selection
- **Independent bloggers, digital writers** → Template 1 (Cold Outreach)
- **Non-responses after 5-7 days** → Template 2 (Follow-Up)
- **Radio hosts, podcast hosts** → Template 3 (Radio/Podcast Pitch)
- **Beat writers** → Template 1, but they're less likely to respond — focus effort on bloggers and podcasters

### Tips
- Personalize the first line when possible (reference a recent article or episode)
- Send Tuesday-Thursday mornings for best open rates
- Don't send more than ~10 per day to avoid spam flags
- Track status in outreach-contacts.json (not_contacted → contacted → responded → converted)
