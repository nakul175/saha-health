# Observe the acknowledged routine save before checking receipts

The published PR224 failed both attempts of its new two-client case: the test matched the previous word "unsaved" as "saved" before checking the final receipt. Retained actual CI trace records that premature successful matcher. Only two waits now require the existing exact message "Server draft saved and read back." No production code or database/history/version/assertion/golden/minimum is changed.

Actual target1 passes; full original39 yields38pass/1fail/0flaky. All10 new conflict cases pass,48 accessibility scans find0violations. The old receipt-uncertain screenshot still differs2973pixels/3% against original2% and remains failed. It has not been replaced or waived. CI successor qualification remains pending; no full local UI pass, formal approval, main merge or deployment is claimed.

Initial title filter selected0 tests, then the correct discovered case ran. Direct CLI did not produce the guessed ui-playwright-result.json filename, so initial capture preserved target rawlog/result but failed before saving targettrace. Current full-run reports/screens/context are preserved. Source-based compilation identities are separately archived, not asserted equivalent to an earlier build.
