# 02. Competitive Analysis

**Status:** v0.2 · **Research date:** 2026-10-13, updated 2026-10-17

Goal: understand what already exists on the market, define Basis's positioning, and adopt the best ideas.

## Summary

No existing product covers the problem as a whole. Assembling an equivalent from off-the-shelf
apps would take at least four of them (habits + social + plate + lab results), and none has the
key logic: `min/target` tiers, weekly goals, meal time windows, and gradual habit enablement.

## Overview by category

### Habit trackers with automatic data

| Product | What it has | What it lacks |
|---|---|---|
| **Habitify** | Native Health Connect integration (since Nov 2025): steps, sleep, and workout minutes credited to habits automatically | No time windows, tiers, "never miss twice", or nutrition |
| **Habit Tracker – Track your day** (iOS) | Transparent source status: sync active / permission missing / manual override for the day | Apple Health only |
| **Fitsly** (coaching) | Health Connect data rules: steps = daily total as computed by Health Connect; sleep = only asleep stages when the device records them | B2B for coaches |

**Adopt:** source status next to each habit; the same aggregation rules as Health Connect, so
numbers match what users see in Samsung Health.

### Social accountability

| Product | What it has | Limitations |
|---|---|---|
| **HabitShare** | Different habits shared with different groups, private habits, encouragement (GIFs), contacts notified on check-off | Observers must install the app |
| **Samsung Health Together** | Group challenges of up to 10 people; challenge participants walk ~22% more on average | Walking only |

**Adopt:** granular access per habit/section; observer reactions; group challenges (later).
Basis's advantage: observers view progress on the web via a link, without installing anything.

### Nutrition from photos

| Product | Approach |
|---|---|
| **Ate / AteMate** | Calorie-free photo food journal; AI tags; prompts "why did you eat, where, with whom, how did you feel"; dashboard for coaches/nutritionists |
| **Platr** (iOS) | Assessment based on the Harvard Healthy Eating Plate, but also calories and macros |
| **SnapFood AI** | A grade plus one line: what's good, what to watch, one realistic tip; streaks reward showing up, not perfection |
| **Calories Are Nothing, Clean Diet, MyFoodyAI** | A single overall "health score" per meal |

Research basis: a meal-quality index from photos with 9 components (meat/substitutes, cooking
method, vegetables, whole foods, variety, ultra-processed food, fruit, carbohydrates, fats)
showed moderate, significant agreement between expert ratings from photos
(Steluti et al., Proceedings of the Nutrition Society, 2020).

**Adopt:** component-based scoring rather than a single number; "what's good / what to improve /
one tip" format; optional "why did I eat" reflection; coach role.

### All-in-one platforms

| Product | What it has | How Basis differs |
|---|---|---|
| **Noom** | AI food logging, steps, psychology lessons, communities, coaching, GLP-1 programs | Calorie-centric |
| **Gyroscope** | Fat-loss protocol as a daily checklist, AI coach, food photos, ~$39/month | Calories, iOS focus, expensive |
| **Exist.io** | Correlations between metrics (needs ≥3 weeks of data, updated weekly), honest "correlation, not causation" framing | Not a habit tracker |

**Adopt:** correlations in the weekly review, phrased as "coincides with".

### Lab results

A saturated market (Labin, SnapLabs, Biomark, BloodTrends, etc.): OCR from photos/PDFs,
biomarker trends, AI explanations, doctor reports, retest reminders.

**Decision:** MVP supports manual entry of key indicators only. OCR and AI interpretation are out of MVP scope.

### Material incentives

| Product | Mechanics | What's valuable | Limitations |
|---|---|---|---|
| **stickK** | A "contract with your future self": goal, deadline, optional money stake. A referee (friend, colleague) verifies reports, and their word outweighs the user's. A lost stake goes to a friend, a charity, or an "anti-charity" — an organization the user opposes (the most popular choice) | Referee with the final say; choice of penalty destination | Manual reporting; no public effectiveness data |
| **Beeminder** | A graph with a "bright red line" — the minimum trajectory toward the goal. Crossing it means being charged. Getting ahead builds a **buffer** of safe days. **Akrasia horizon:** making a goal easier, adding breaks, quitting, or lowering the stake only takes effect after 7 days | Buffer instead of a rigid daily requirement; protection against impulsive "I'll ease off, today is hard" | Complex for non-technical users; punishment-focused |
| **DietBet / WayBetter** (StepBet, etc.) | Participants pay into a shared pot; those who reach the goal (e.g., −4% body weight in 4 weeks) split it. Weigh-ins are verified by scale photos with a keyword within a 48-hour window; video audits possible. The service keeps 10–25% of the pot | Group format where winnings come from those who didn't make it; photo-with-code verification | Betting on an **outcome** (weight) over a short period encourages fast rather than sustainable weight loss; fees |
| **Pact (GymPact)** — shut down | Penalties for missed workouts, payouts from the penalty pool to those who met goals. In 2017 the FTC found that tens of thousands of users were charged despite meeting goals or canceling, and no one received the promised payouts; the company refunded over $940K | Cautionary example | Trust in money mechanics is destroyed by the first erroneous charge |

**Research.** In a randomized trial (Volpp et al., JAMA, 2008), both a deposit contract (own money
at risk) and a **lottery** (a chance to win for reaching the goal) produced significantly more
weight loss than the control group: about half of participants in both incentive groups reached
the 16 lb / 16 week target versus ~10% of controls. After incentives stopped, participants
partially regained weight, though they remained lighter than at baseline.

**Takeaways for the Stake module:**
- **Stake on behavior, not outcomes.** Credits are for weekly habit goals, not kilograms; this avoids encouraging dangerously fast weight loss.
- **Safety buffer** (Beeminder): a week completed with a margin earns a "buffer day" that automatically covers one future miss without penalty.
- **7-day change horizon** (Beeminder): lowering a goal, reducing the stake, or disabling penalties takes effect after a week; tightening applies immediately.
- **Referee with the final say** (stickK): in disputed cases (manual check-offs) the referee-observer decides.
- **Choice of penalty destination** (stickK): a friend, a charity, or an "anti-charity".
- **Lottery reward** (Volpp): instead of a fixed amount, a chance at a larger bonus; variable rewards are no less effective.
- **Planned fade-out** (Volpp): money is scaffolding, not foundation. Once a habit has been stable for several weeks, the module suggests gradually reducing the stake so the habit holds without external incentives.
- **Transparency above all** (Pact): a full ledger with an explanation for every entry; the server never holds or charges money; any disputed entry can be challenged.
- **Group pot** (DietBet) — a possible format for group challenges, but requires legal review (gambling characteristics, Ukrainian regulation).

## Candidate ideas

| # | Idea | Source | Where |
|---|---|---|---|
| 1 | Post-meal reflection ("why did I eat?", optional) | Ate | MVP candidate |
| 2 | "Coach" observer role (access to the food journal) | Ate Coach Dashboard | Post-MVP |
| 3 | Group challenges | Samsung Health Together | Product expansion |
| 4 | Correlations in the weekly review | Exist.io | Post-MVP |
| 5 | Doctor report (export for a period) | Labin, Biomark | Post-MVP |
| 6 | Data source status next to each habit | Habit Tracker | MVP |
| 7 | Material incentives (Stake) | stickK, Beeminder | Right after MVP |
| 8 | Safety buffer and 7-day change horizon for Stake | Beeminder | Together with Stake |
| 9 | Lottery reward and planned stake fade-out | Volpp et al., 2008 | Together with Stake |
| 10 | Group pot for challenges | DietBet / WayBetter | Product expansion, after legal review |

## What we deliberately don't do

- calorie and macro counting;
- lab-result OCR in the first version;
- money stakes on outcomes (weight) instead of behavior;
- holding or charging funds on the server.

## Sources

- https://feedback.habitify.me/changelog/habitify-android-2910-automate-your-habits-with-health-connect
- https://appgoblin.info/apps/6772600216
- https://www.fitsly.com/help/article/health-data-in-habits-and-metrics
- https://apps.apple.com/app/id1048191045 (HabitShare)
- https://foodandnutrition.org/from-the-magazine/habitshare-ios-version-2-1-30/
- https://samsungmobilepress.com/articles/achieve-your-new-years-resolution-with-new-group-challenge-feature-in-samsung-health
- https://app.dealroom.co/companies/youate
- https://apps.apple.com/us/app/-/id6753956656 (Platr)
- https://apps.apple.com/app/id6737444729 (SnapFood AI)
- https://resolve.cambridge.org/core/journals/proceedings-of-the-nutrition-society/article/development-of-quality-index-to-classify-meal-healthiness-through-photos-first-step-for-app-of-meal-assessment-using-machine-learning/52945E4E1FDD1572382DE4BA43BDC206
- https://apps.apple.com/ru/app/634598719 (Noom)
- https://www.g2.com/products/gyroscope/discuss
- https://athletechnews.com/gyroscope-v8-glp1-smart-health-tracking
- https://exist.io/page/faqs/
- https://apps.apple.com/app/id6759573257 (Labin)
- https://apps.apple.com/app/id776128765 (stickK)
- https://blog.beeminder.com/roadwidth
- https://help.beeminder.com/article/45-what-is-the-akrasia-horizon
- https://www.mymoneyblog.com/dietbet-review.html
- https://www.engadget.com/2017/09/22/fitness-app-company-settles-ftc-nearly-1-million/
- https://www.medicalnewstoday.com/articles/132895.php (Volpp et al., JAMA 2008)
