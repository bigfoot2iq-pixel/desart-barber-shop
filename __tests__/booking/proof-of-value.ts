// Proof-of-value: verify that removing COALESCE from the overlap constraint
// and RPC causes the test suites to go red.
//
// To run manually:
// 1. Edit supabase/migrations/014_booked_slots_and_overlap_guard.sql
//    - Line 23: change COALESCE(a.professional_id, a.preferred_professional_id) → a.professional_id
//    - Line 28: change COALESCE(a.professional_id, a.preferred_professional_id) → a.professional_id
//    - Line 43: change COALESCE(professional_id, preferred_professional_id) → professional_id
// 2. Run: supabase db push
// 3. Run: pnpm jest __tests__/booking
//    Expected failures:
//    - RPC tests 6.1, 6.3, 6.6, 6.10 (unassigned appointments with preferred_professional_id
//      only will not be returned by the RPC)
//    - Overlap tests 7.1, 7.2, 7.6 (appointments with only preferred_professional_id set
//      will not be caught by the EXCLUDE constraint)
// 4. Restore the migration file and run: supabase db push
//
// Observation (from manual verification):
// Removing COALESCE causes the RPC to miss unassigned appointments that only have
// preferred_professional_id set (the normal customer booking path). This means the
// UI would show available time slots that are actually already booked, leading to
// double-bookings. The overlap constraint would also fail to prevent two customers
// from booking the same barber via preferred_professional_id.
//
// This file exists as documentation — the actual regression test is the test suite
// itself, which will catch this if the migration is ever changed.

export {};
