// Default seed for LOCAL mode only (when Supabase isn't configured). In the
// deployed multi-user app each account loads its own transactions from the DB,
// so no personal data is baked into the source. Uses the demo sample.
export { SAMPLE_CSV as REAL_TXNS_CSV } from "./transactions";
