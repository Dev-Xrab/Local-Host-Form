# Performance report — 2026-11-13

Baseline web export completed in about 30 seconds on this audit machine. Reported bundles include the main web entry at 4.2 MB, common bundle at 1.1 MB, and `html2canvas` at 202 KB. The phone HTTP harness accepted an approximately 8 MB JSON body in 127–137 ms across observed runs; this is a local synthetic check, not a throughput benchmark. Production bundle sizes are uncompressed output sizes as printed by Expo.

No startup/memory/CPU profiler, database query benchmark, large gradebook data set, concurrent submission load or network trace was run. No performance optimization is claimed. Establish reproducible baseline and compare before changing code for speed. Prioritize correctness and historical data integrity issues first.
