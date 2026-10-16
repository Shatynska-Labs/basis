# ADR-0008: Stake module: virtual balance + monobank confirmation

**Status:** accepted · **Date:** 2026-10-17

## Context

Material incentives (rewards/penalties) are desired. Neither Privat24 (only a business API, "Autoclient", for sole proprietors/companies) nor monobank offers a public API for initiating card transfers for individuals. monobank's personal API provides statements, balance, and a transaction webhook.

## Decision

The server **never moves money**. The `stake` context keeps a virtual ledger; weekly settlement is performed by the user; the **monobank personal API webhook** detects the transfer to the jar and marks the week as settled (via an anti-corruption layer). Other banks — manual confirmation. The mono token is encrypted; only relevant transactions are stored. Mechanics from the competitive analysis (buffer, 7-day change horizon, referee, lottery reward, planned fade-out) are part of the module design.

## Alternatives considered

- Privat24 for Business "Autoclient" — mixes business and personal funds, gives the server the right to move money, unclear qualified e-signature requirements.
- No bank integration at all — remains as a fallback.

## Consequences

+ Minimal risk: a compromised server gives no access to funds.
+ The weekly transfer ritual is motivating in itself.
− Requires discipline to make the transfer; mitigated by reminders and a referee-observer.
− The jar transfer's description format in statements must be validated in a prototype.
