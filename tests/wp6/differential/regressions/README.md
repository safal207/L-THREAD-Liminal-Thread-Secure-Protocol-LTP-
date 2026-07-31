# WP6 minimized regression corpus

Every crash, panic, timeout, uncontrolled resource-growth case, or four-SDK differential disagreement discovered by WP6 must be reduced to the smallest input that still reproduces the defect.

The minimized input is committed here with:

- stable case ID;
- originating seed and workflow run;
- affected SDK(s);
- expected fail-closed verdict;
- linked issue and fixing pull request;
- no secrets, keys, private payloads, or raw production traffic.

The shared deterministic corpus in `tests/wp6/differential/corpus.ts` is the executable seed corpus. This directory remains intentionally empty until a discovered defect produces a minimized permanent fixture.
