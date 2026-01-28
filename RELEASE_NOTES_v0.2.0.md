# @openlabels/oli-hardhat v0.2.0 — Release Notes

Release date: 2026-01-28

## Highlights

- **CAIP‑10 label encoding**: Label data is now encoded as CAIP‑10 (`<namespace>:<reference>:<address>`), matching the updated on‑chain schema and OLI Python tooling.
- **Chain‑aware address validation**: Non‑EVM chains no longer fail EVM checksum validation. Address checks now respect CAIP‑2 chain prefixes.
- **Dedicated Hardhat attestation marker**: Hardhat‑originated attestations use recipient `0x0000000000000000000000000000000000000003` for clean provenance tracking.
- **Improved CLI inputs**: `oli:submit-label` and `oli:validate-label` accept CAIP‑10 directly; `chainId` is now optional when CAIP‑10 is provided.
- **Schema defaults updated**: Default Label Pool schema updated to the CAIP‑10 schema hash.

## Changes by area

### Attestation encoding & schema
- Label data now encodes **CAIP‑10** instead of raw chain_id. This aligns with the latest OLI schema and the updated oli‑python reference.
- Default `labelPoolSchema` switched to:
  - `0xcff83309b59685fdae9dad7c63d969150676d51d8eeda66799d1c4898b84556a`

### Recipient marker
- All onchain/offchain label + trust attestations from this plugin use:
  - `0x0000000000000000000000000000000000000003`
  - This distinguishes Hardhat‑originated attestations from other tooling (e.g., python = `0x...1`, frontend = `0x...2`).

### Validation improvements
- `validateLabel` now validates **by chain**:
  - `eip155:*` → EVM checksum validation
  - non‑EVM → CAIP‑10 address constraints (length + no `:`)
- CAIP‑2 parsing is now generic, not hard‑coded to a short prefix list.

### CLI enhancements
- `oli:submit-label` and `oli:validate-label` now accept CAIP‑10 as the address input.
- `chainId` positional arg is now **optional** and defaults to `auto` when CAIP‑10 is provided.

### Read behavior
- Reads now accept CAIP‑10 in `getLabels` helpers and normalize appropriately.

## Migration notes

- If you were previously encoding label data with raw `chainId`, update your expectations: the `data` field now stores **CAIP‑10**.
- If your workflows rely on `recipient == address`, note that recipient is now the marker address for plugin‑originated attestations. The OLI API still returns the labeled address as recipient in responses.
- If you pass CAIP‑10 to the CLI, you may omit `chainId` entirely.

## Compatibility

- No breaking changes to the public API surface for standard usage.
- Existing `address + chainId` inputs continue to work unchanged.
- Bulk inputs now accept `caip10`/`caip_10` fields in addition to `address + chain_id`.

## Files & key updates

- `src/encoding.ts` — CAIP‑10 label data encoding
- `src/validation.ts` — chain‑aware validation
- `src/client.ts` — CAIP‑10 data + recipient marker
- `src/index.ts` — optional chainId for CAIP‑10 inputs
- `src/constants.ts` — updated schema default + recipient marker
- `README.md` — updated examples and notes

---

If you need a changelog entry or a release tag/commit prepared, let me know.
