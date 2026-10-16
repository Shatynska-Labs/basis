# 01. Product Vision

**Status:** draft v0.3 · **Date:** 2026-10-17

## Essence

**Basis** is a product for building the regular habits that form the foundation of a person's life.
It automates tracking wherever possible and helps people perform important actions consistently
without excessive effort. Habits can belong to any life area: health, household, finances,
learning, creativity.

## Problem

Most meaningful life changes are not one-off efforts but regular actions sustained over months.
Such plans usually fall apart not for lack of knowledge but because of:

- all-or-nothing logic: one missed day resets the streak and creates a sense of failure;
- trying to change too much at once;
- manual tracking that quickly becomes tedious;
- goals set without regard to the person's real starting level;
- lack of outside support.

Existing habit trackers are mostly binary (done / not done), built around daily streaks, and
weakly integrated with the data users' devices already collect.

## Target audience

1. **Users** — people who want to build a durable system of regular actions and value
   automation and a gentle yet disciplined approach.
2. **Observers** — people the user invites to see their progress and support them.
3. **Coaches** (later) — professionals (e.g., a nutritionist or trainer) with extended access,
   granted with the user's consent.

## First life area: health

The product's first use cases are health habits, because this area offers the most data for
automation and the strongest need for long-term regularity:

- physical activity and sleep — credited automatically from wearables via Health Connect;
- nutrition — regular meal times and AI assessment of meal photos based on the Harvard Healthy Eating Plate;
- results — weight (trend), body measurements, progress photos, lab results.

The product core (habit rules, evaluation, weekly logic, observers) is area-agnostic from the
start, so other life areas can be supported later.

## What the product does

- credits habits automatically from device data, with manual input as a fallback;
- evaluates adherence through tiers and weekly goals rather than a binary daily check-off;
- raises the bar gradually, based on real data;
- uses AI where content understanding is needed (photos, weekly reviews);
- lets observers see progress within the granted access;
- stores long-term results so the effect of habits is visible.

## Principles

1. **Hard to "fail".** Every habit has `min / target / stretch` tiers.
2. **The week matters more than the day.** Goals are phrased as "N days out of 7".
3. **Never miss twice.** One miss is normal; two in a row trigger a gentle nudge.
4. **Missing data is not failure.**
5. **Start from the real baseline.** A calibration period, then gradual habit enablement.
6. **Automation over manual input.**
7. **AI evaluates the result, not the person.** Supportive tone; the human has the final say.
8. **Quality over counting.** E.g., in nutrition — plate composition, not calories.
9. **Private by default,** with granular access for observers.
10. **Trends, not individual data points.**

## What the product deliberately does NOT do

- count calories or macros;
- diagnose or give medical advice;
- penalize missing data;
- publish user data openly — sharing is by invitation only;
- initiate bank transfers (the Stake module only calculates and verifies).

## What success looks like

- users keep using the product daily after 3 months;
- weekly goals are met in at least 60% of weeks;
- most credits happen automatically, without manual input;
- long-term indicators (e.g., weight trend) move in the desired direction.

## Responsibility in the health area

The product does not replace medical consultation. Onboarding for habits involving intense
activity recommends consulting a doctor first, and activity goals are defined by heart-rate
zones rather than by type of exercise.
