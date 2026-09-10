// No jest-dom here: its bundled type augmentation for vitest's `expect`
// (toBeInTheDocument, toHaveAttribute, etc.) didn't type-check correctly
// against vitest 5.0.0's Assertion type shape after two different attempts
// to register it (tsconfig `types` entry, then an explicit triple-slash
// reference — both failed the same way). Tests use plain DOM assertions
// instead (element.getAttribute(...), toBeTruthy(), etc.) rather than
// fighting that version-compatibility gap — see individual test files.
