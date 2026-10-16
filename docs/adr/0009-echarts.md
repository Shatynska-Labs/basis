# ADR-0009: ECharts for web charts

**Status:** accepted · **Date:** 2026-10-17

## Context

We need a weight trend with a moving average over raw points, habit adherence heatmaps, and several metrics on one time axis.

## Decision

**Apache ECharts** via `echarts-for-react`.

## Alternatives considered

- Recharts — easier to start with, but fewer out-of-the-box capabilities for heatmaps and complex combined charts.

## Consequences

+ A wide range of chart types, good performance.
− A steeper learning curve (large options object).
