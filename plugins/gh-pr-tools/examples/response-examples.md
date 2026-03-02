# Response Examples

Examples of good PR responses to guide when helping authors address reviewer feedback.

Good responses are concise, evidence-based, and respectful.

## Example 1: Dependency/Import Question

**Reviewer comment:**
> Missing import for `ValidationError`? I see you're using it on line 45.

**Good response:**
```
`ValidationError` is re-exported from `src/utils/index.ts` (line 12) which is already
imported on line 3. The import chain:

  CheckoutForm.tsx:3 -> src/utils/index.ts:12 -> src/errors/ValidationError.ts

Verified with: `grep -rn "ValidationError" src/utils/index.ts`
```

**Why this works:**
- Provides the import chain as evidence
- Shows the verification command
- Doesn't just say "it's already imported" - shows how

---

## Example 2: Design Choice Challenge

**Reviewer comment:**
> Why not use a Map instead of a plain object here? Map has better performance for frequent additions/deletions.

**Good response:**
```
Considered that. Plain object works better here because:
1. Keys are always strings (user IDs) - no benefit from Map's key flexibility
2. We serialize this to JSON for the API call on line 78 - Map requires manual conversion
3. The collection is small (< 100 entries) and short-lived - performance difference is negligible

If the dataset grows significantly, happy to switch to Map with a toJSON helper.
```

**Why this works:**
- Shows you considered the suggestion
- Explains concrete reasoning (serialization constraint)
- Invites further discussion
- Doesn't dismiss the idea

---

## Example 3: Accepting and Fixing

**Reviewer comment:**
> Missing error handling - `fetch` can throw on network errors.

**Good response:**
```
Good catch! Added try/catch with logging in latest push.
```

**Why this works:**
- Brief acknowledgment
- Confirms action taken
- No over-explanation needed

---

## Example 4: Test Verification Question

**Reviewer comment:**
> Did you run the integration tests? This touches the auth flow.

**Good response:**
```
Ran the auth integration suite - all 24 tests passing:

$ npm test -- --grep "auth"
  auth flow
    ✓ login with valid credentials (142ms)
    ✓ login with invalid credentials (89ms)
    ✓ token refresh (201ms)
    ... 21 more passing

The change is backward-compatible - the new parameter has a default value,
so existing callers are unaffected.

If you'd like, I can add a specific test for the new token rotation path.
```

**Why this works:**
- Shows test results
- Explains why the change is safe (backward compatible)
- Offers to add more tests if desired

---

## Example 5: Scope Expansion Request

**Reviewer comment:**
> While you're here, could you also add input sanitization for the other form fields?

**Good response (if small):**
```
Good idea - added sanitization for name and address fields in the latest push.
```

**Good response (if large):**
```
That would touch several other components and expand the scope significantly
(CheckoutForm, ProfileForm, SettingsForm all have similar fields).

Want me to add it to this PR, or create a follow-up issue?
I'd recommend a follow-up so this PR stays focused on the validation changes.
```

**Why this works:**
- Defaults to doing the work if it's small
- For larger additions, explains scope impact and asks for direction
- Suggests a follow-up rather than refusing

---

## Example 6: Clarifying Confusion

**Reviewer comment:**
> I don't understand why you're removing the caching here. Won't that hurt performance?

**Good response:**
```
The removal is intentional. The cache was masking a bug:

1. `getUserProfile()` cached the response for 5 minutes
2. When a user updates their profile, the cache served stale data
3. The "profile not updating" bug (#1234) was caused by this

With the cache removed:
- Profile updates are immediately visible
- API response time increases by ~50ms (acceptable for this endpoint)
- If we need caching later, we can add it with proper invalidation

The fix for #1234 is documented in the PR description.
```

**Why this works:**
- Explains the mechanism (cache masking a bug)
- Links to the issue being fixed
- Acknowledges the trade-off (50ms latency increase)
- Suggests a path forward (cache with invalidation)

---

See also: [Addressing PR Review Feedback](../reference/addressing-feedback.md) for the investigation methodology.
