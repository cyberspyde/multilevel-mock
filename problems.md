# Problems to Fix

## Critical / High Priority

- [x] Fix unoptimized DB queries in AI grading - multiple sequential queries
- [x] Add AI response validation - parsing could crash on unexpected format
- [x] Remove console statements from production code

## Medium Priority

- [x] Fix type safety - replace `any` types in admin page
- [x] Fix type safety - replace `any` types in speaking result page
- [x] Fix type safety - replace `any` types in AI grade route
- [x] Cache Whisper module import - stop importing on every request
- [x] Add timeout for Whisper transcription requests
- [x] Add completion notification for background transcription
- [x] Clean up unused/outdated types.ts file

## Low Priority

- [ ] Refactor large buildGradingPrompt function (500+ lines) - Optional, code works fine
