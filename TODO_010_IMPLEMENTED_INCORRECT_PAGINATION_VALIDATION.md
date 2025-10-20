# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# IMPLEMENTED: https://github.com/ForestAdmin/agent-ruby/pull/156

# TODO 010: Fix Incorrect Pagination Validation Logic

**Priority:** P0 - HIGH
**Estimated Effort:** 5 minutes
**Impact:** Invalid pagination parameters pass validation, causing SQL errors or unexpected results

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Bug Description](#bug-description)
3. [Root Cause Analysis](#root-cause-analysis)
4. [Impact Assessment](#impact-assessment)
5. [Fix Implementation](#fix-implementation)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Considerations](#deployment-considerations)
8. [Related Issues](#related-issues)

---

## Executive Summary

The pagination validation logic in the Ruby Forest Admin agent uses incorrect boolean logic (`||` instead of `&&`), allowing invalid pagination parameters to pass validation. This causes database errors, incorrect query results, and potential security issues.

### The Problem

```ruby
# Current code - WRONG LOGIC!
unless !items_per_pages.to_s.match(/\A[+]?\d+\z/).nil? || !page.to_s.match(/\A[+]?\d+\z/).nil?
  raise ForestException, "Invalid pagination [limit: #{items_per_pages}, skip: #{page}]"
end

# Translates to: "unless (A is valid) OR (B is valid)"
# Only raises if BOTH are invalid
# Should raise if EITHER is invalid
```

### The Bug in Action

```ruby
items_per_page = "abc"  # ❌ Invalid
page = 1                # ✅ Valid

# Current logic evaluates to:
# unless (false || true) => unless true => does NOT raise
# Bug: Invalid parameter passes validation!

# Should evaluate to:
# unless (false && true) => unless false => RAISES
# Fixed: Invalid parameter caught!
```

### The Solution

```ruby
# Fix: Change || to &&
page_valid = !page.to_s.match(/\A[+]?\d+\z/).nil?
limit_valid = !items_per_pages.to_s.match(/\A[+]?\d+\z/).nil?

unless page_valid && limit_valid
  raise ForestException, "Invalid pagination [limit: #{items_per_pages}, skip: #{page}]"
end
```

**Time to Fix:** 5 minutes
**Risk:** None - Fixes broken validation

---

## Bug Description

### Location

**File:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/utils/query_string_parser.rb`
**Lines:** 68-70

### Current Code

```ruby
def self.parse_pagination(args)
  items_per_pages = args.dig(:params, :data, :attributes, :all_records_subset_query, :size) ||
                    args.dig(:params, :page, :size) || DEFAULT_ITEMS_PER_PAGE

  page = args.dig(:params, :data, :attributes, :all_records_subset_query, :number) ||
         args.dig(:params, :page, :number) || DEFAULT_PAGE_TO_SKIP

  # ❌ BUG: Using OR (||) instead of AND (&&)
  unless !items_per_pages.to_s.match(/\A[+]?\d+\z/).nil? || !page.to_s.match(/\A[+]?\d+\z/).nil?
    raise ForestException, "Invalid pagination [limit: #{items_per_pages}, skip: #{page}]"
  end

  offset = (page.to_i - 1) * items_per_pages.to_i

  Page.new(offset: offset, limit: items_per_pages.to_i)
end
```

### Error Scenarios

#### Scenario 1: Invalid Page Size (Passes When It Shouldn't)

```ruby
# Request: GET /forest/bank_accounts?page[size]=abc&page[number]=1

items_per_page = "abc"  # ❌ Invalid (not a number)
page = 1                # ✅ Valid

# Validation check:
page_valid = !"abc".match(/\A[+]?\d+\z/).nil?     # => false (invalid)
limit_valid = !"1".match(/\A[+]?\d+\z/).nil?      # => true (valid)

# Current logic:
unless false || true     # => unless true => does NOT raise ❌
  raise ForestException
end

# Result: Invalid parameter passes validation!
# SQL generated: LIMIT 0 (since "abc".to_i => 0)
```

#### Scenario 2: Invalid Page Number (Passes When It Shouldn't)

```ruby
# Request: GET /forest/bank_accounts?page[size]=50&page[number]=invalid

items_per_page = 50         # ✅ Valid
page = "invalid"            # ❌ Invalid (not a number)

# Validation check:
page_valid = !"invalid".match(/\A[+]?\d+\z/).nil?  # => false (invalid)
limit_valid = !"50".match(/\A[+]?\d+\z/).nil?      # => true (valid)

# Current logic:
unless false || true     # => unless true => does NOT raise ❌
  raise ForestException
end

# Result: Invalid parameter passes validation!
# Offset calculated: (0 - 1) * 50 = -50 (negative offset!)
```

#### Scenario 3: Malicious Input

```ruby
# Request: GET /forest/bank_accounts?page[size]=50&page[number]='; DROP TABLE users--

items_per_page = 50                    # ✅ Valid
page = "'; DROP TABLE users--"         # ❌ Invalid (SQL injection attempt)

# Current logic: PASSES validation (only checks one param)
# Converted to int: "'; DROP TABLE users--".to_i => 0
# Used in query: OFFSET 0 (SQL injection fails due to to_i, but validation should catch it)
```

#### Scenario 4: Both Invalid (Correctly Raises)

```ruby
# Request: GET /forest/bank_accounts?page[size]=abc&page[number]=xyz

items_per_page = "abc"  # ❌ Invalid
page = "xyz"            # ❌ Invalid

# Validation check:
page_valid = !"xyz".match(/\A[+]?\d+\z/).nil?     # => false (invalid)
limit_valid = !"abc".match(/\A[+]?\d+\z/).nil?    # => false (invalid)

# Current logic:
unless false || false    # => unless false => RAISES ✅
  raise ForestException
end

# Result: Correctly raises exception
```

### Truth Table Analysis

| Page Valid | Limit Valid | Current Behavior (` |          | `)         | Expected Behavior (`&&`) | Correct? |
| ---------- | ----------- | ------------------- | -------- | ---------- | ------------------------ | -------- |
| ✅ Valid   | ✅ Valid    | Pass ✅             | Pass ✅  | ✅ Yes     |
| ✅ Valid   | ❌ Invalid  | **Pass ❌**         | Raise ✅ | ❌ **BUG** |
| ❌ Invalid | ✅ Valid    | **Pass ❌**         | Raise ✅ | ❌ **BUG** |
| ❌ Invalid | ❌ Invalid  | Raise ✅            | Raise ✅ | ✅ Yes     |

**Result:** 2 out of 4 cases are incorrect (50% failure rate)

---

## Root Cause Analysis

### Why This Bug Exists

1. **Double Negative Logic:** Using `!match().nil?` is confusing
2. **Copy-Paste Error:** Likely copied from another validation and changed operator incorrectly
3. **Insufficient Testing:** No test coverage for mixed valid/invalid parameters
4. **Code Review Miss:** Complex boolean logic not caught in review

### Boolean Logic Explanation

**Current Code:**

```ruby
unless !A.nil? || !B.nil?
  raise
end
```

Translates to:

```
unless (A is valid OR B is valid)
  raise
end
```

Which means:

```
raise only if (A is invalid AND B is invalid)
```

**Should Be:**

```ruby
unless !A.nil? && !B.nil?
  raise
end
```

Translates to:

```
unless (A is valid AND B is valid)
  raise
end
```

Which means:

```
raise if (A is invalid OR B is invalid)
```

### De Morgan's Laws

```
NOT (A OR B) = (NOT A) AND (NOT B)
NOT (A AND B) = (NOT A) OR (NOT B)

Current code:
unless (A OR B)        # Raise if NOT (A OR B) = (NOT A) AND (NOT B)
                       # Both must be invalid to raise

Correct code:
unless (A AND B)       # Raise if NOT (A AND B) = (NOT A) OR (NOT B)
                       # Either invalid will raise
```

---

## Impact Assessment

### Severity: 🔴 HIGH

### What Breaks

1. **Invalid Queries**

   - Invalid page size becomes `LIMIT 0` (returns empty results)
   - Invalid page number becomes `OFFSET -50` or `OFFSET 0`
   - Users see wrong data without knowing why

2. **Silent Failures**

   - No error message to user
   - Difficult to debug (looks like valid request)
   - Frontend pagination breaks mysteriously

3. **Database Performance**

   - `LIMIT 0` queries are wasteful
   - Negative offsets might cause DB errors (depending on adapter)
   - Unexpected query patterns

4. **Security Implications**
   - Validation bypass (though SQL injection mitigated by `.to_i`)
   - Unexpected behavior can be exploited
   - DoS via invalid parameters still possible

### Failure Modes

| Input                | Current Behavior                     | Impact           | Frequency        |
| -------------------- | ------------------------------------ | ---------------- | ---------------- |
| `size=abc&number=1`  | Passes validation, returns 0 records | Empty page       | Common (typos)   |
| `size=50&number=abc` | Passes validation, OFFSET 0          | Wrong page       | Common (typos)   |
| `size=-50&number=1`  | Passes validation, LIMIT 0           | Empty page       | Rare (malicious) |
| `size=50&number=-1`  | Passes validation, OFFSET -100       | Error/wrong data | Rare (malicious) |
| `size=1.5&number=1`  | Passes validation, LIMIT 1           | Unexpected       | Rare             |
| `size=0&number=1`    | Passes validation, LIMIT 0           | Empty page       | Occasional       |

### Real-World Scenario

```
User: "I'm on page 2 but seeing the same records as page 1"

Debug:
- Frontend sends: ?page[number]=2a (typo: 2a instead of 2)
- Backend validates: page valid? NO, size valid? YES
- Current logic: passes (only checks if ONE is valid)
- Converts to: page.to_i => 0
- Query: OFFSET -50 (0-1)*50 = -50
- Database: Returns first page (treats negative offset as 0)
- User sees: Same data as page 1

Root cause: Validation bug allowed invalid parameter
```

### Database-Specific Behavior

**PostgreSQL:**

```sql
SELECT * FROM bank_accounts LIMIT 0 OFFSET -50;
-- Returns 0 rows (LIMIT 0 overrides everything)
```

**MySQL:**

```sql
SELECT * FROM bank_accounts LIMIT 0 OFFSET -50;
-- Error: "You have an error in your SQL syntax"
```

**SQLite:**

```sql
SELECT * FROM bank_accounts LIMIT 0 OFFSET -50;
-- Returns 0 rows (negative offset treated as 0)
```

---

## Fix Implementation

### Solution 1: Clear Logic with Variables (Recommended)

**File:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/utils/query_string_parser.rb`

```ruby
def self.parse_pagination(args)
  items_per_pages = args.dig(:params, :data, :attributes, :all_records_subset_query, :size) ||
                    args.dig(:params, :page, :size) || DEFAULT_ITEMS_PER_PAGE

  page = args.dig(:params, :data, :attributes, :all_records_subset_query, :number) ||
         args.dig(:params, :page, :number) || DEFAULT_PAGE_TO_SKIP

  # Validate both parameters
  page_valid = !page.to_s.match(/\A[+]?\d+\z/).nil?
  limit_valid = !items_per_pages.to_s.match(/\A[+]?\d+\z/).nil?

  unless page_valid && limit_valid
    raise ForestException, "Invalid pagination [limit: #{items_per_pages}, skip: #{page}]"
  end

  offset = (page.to_i - 1) * items_per_pages.to_i

  Page.new(offset: offset, limit: items_per_pages.to_i)
end
```

**Benefits:**

- Clear variable names
- Easy to debug (can inspect `page_valid` and `limit_valid`)
- Correct logic with `&&`
- More readable

**Changes:** 3 lines added, 1 line modified

---

### Solution 2: Inline Fix (Minimal Change)

```ruby
def self.parse_pagination(args)
  items_per_pages = args.dig(:params, :data, :attributes, :all_records_subset_query, :size) ||
                    args.dig(:params, :page, :size) || DEFAULT_ITEMS_PER_PAGE

  page = args.dig(:params, :data, :attributes, :all_records_subset_query, :number) ||
         args.dig(:params, :page, :number) || DEFAULT_PAGE_TO_SKIP

  # Fix: Change || to &&
  unless !items_per_pages.to_s.match(/\A[+]?\d+\z/).nil? && !page.to_s.match(/\A[+]?\d+\z/).nil?
    raise ForestException, "Invalid pagination [limit: #{items_per_pages}, skip: #{page}]"
  end

  offset = (page.to_i - 1) * items_per_pages.to_i

  Page.new(offset: offset, limit: items_per_pages.to_i)
end
```

**Benefits:**

- Only 1 character changed (`||` → `&&`)
- Minimal diff
- Quick to review

**Drawbacks:**

- Still uses double negative (harder to read)

**Changes:** 1 character changed

---

### Solution 3: Positive Logic (Most Readable)

```ruby
def self.parse_pagination(args)
  items_per_pages = args.dig(:params, :data, :attributes, :all_records_subset_query, :size) ||
                    args.dig(:params, :page, :size) || DEFAULT_ITEMS_PER_PAGE

  page = args.dig(:params, :data, :attributes, :all_records_subset_query, :number) ||
         args.dig(:params, :page, :number) || DEFAULT_PAGE_TO_SKIP

  # Validate using positive logic
  page_invalid = page.to_s.match(/\A[+]?\d+\z/).nil?
  limit_invalid = items_per_pages.to_s.match(/\A[+]?\d+\z/).nil?

  if page_invalid || limit_invalid
    raise ForestException, "Invalid pagination [limit: #{items_per_pages}, skip: #{page}]"
  end

  offset = (page.to_i - 1) * items_per_pages.to_i

  Page.new(offset: offset, limit: items_per_pages.to_i)
end
```

**Benefits:**

- No double negatives
- Easier to understand
- Correct logic with `||`

**Changes:** 3 lines added, 1 line removed

---

### Solution 4: Extract to Validator (Best for Future)

```ruby
def self.parse_pagination(args)
  items_per_pages = args.dig(:params, :data, :attributes, :all_records_subset_query, :size) ||
                    args.dig(:params, :page, :size) || DEFAULT_ITEMS_PER_PAGE

  page = args.dig(:params, :data, :attributes, :all_records_subset_query, :number) ||
         args.dig(:params, :page, :number) || DEFAULT_PAGE_TO_SKIP

  # Use validator
  validate_pagination_params!(page, items_per_pages)

  offset = (page.to_i - 1) * items_per_pages.to_i

  Page.new(offset: offset, limit: items_per_pages.to_i)
end

private

def self.validate_pagination_params!(page, limit)
  errors = []

  unless page.to_s.match?(/\A[+]?\d+\z/)
    errors << "page must be a positive integer (got: #{page})"
  end

  unless limit.to_s.match?(/\A[+]?\d+\z/)
    errors << "limit must be a positive integer (got: #{limit})"
  end

  return if errors.empty?

  raise ForestException, "Invalid pagination: #{errors.join(', ')}"
end
```

**Benefits:**

- Best error messages
- Testable in isolation
- Easier to extend
- Most maintainable

**Changes:** 20 lines added

---

**Recommendation:** Use **Solution 1** for production (clear, debuggable, minimal change) or **Solution 2** for hotfix (fastest).

---

## Testing Strategy

### Unit Tests

**File:** `agent-ruby/packages/forest_admin_agent/spec/lib/forest_admin_agent/utils/query_string_parser_spec.rb`

```ruby
RSpec.describe ForestAdminAgent::Utils::QueryStringParser do
  describe '.parse_pagination' do
    context 'when both parameters are valid' do
      let(:args) do
        {
          params: {
            page: {
              size: '50',
              number: '2'
            }
          }
        }
      end

      it 'returns valid Page object' do
        page = described_class.parse_pagination(args)
        expect(page.limit).to eq(50)
        expect(page.offset).to eq(50)  # (2-1) * 50
      end
    end

    context 'when page size is invalid but page number is valid (BUG SCENARIO)' do
      let(:args) do
        {
          params: {
            page: {
              size: 'abc',      # ❌ Invalid
              number: '1'       # ✅ Valid
            }
          }
        }
      end

      it 'raises ForestException' do
        expect do
          described_class.parse_pagination(args)
        end.to raise_error(ForestException, /Invalid pagination/)
      end
    end

    context 'when page number is invalid but page size is valid (BUG SCENARIO)' do
      let(:args) do
        {
          params: {
            page: {
              size: '50',       # ✅ Valid
              number: 'invalid' # ❌ Invalid
            }
          }
        }
      end

      it 'raises ForestException' do
        expect do
          described_class.parse_pagination(args)
        end.to raise_error(ForestException, /Invalid pagination/)
      end
    end

    context 'when both parameters are invalid' do
      let(:args) do
        {
          params: {
            page: {
              size: 'abc',      # ❌ Invalid
              number: 'xyz'     # ❌ Invalid
            }
          }
        }
      end

      it 'raises ForestException' do
        expect do
          described_class.parse_pagination(args)
        end.to raise_error(ForestException, /Invalid pagination/)
      end
    end

    context 'with negative page number' do
      let(:args) do
        {
          params: {
            page: {
              size: '50',
              number: '-1'      # ❌ Invalid (negative)
            }
          }
        }
      end

      it 'raises ForestException' do
        expect do
          described_class.parse_pagination(args)
        end.to raise_error(ForestException, /Invalid pagination/)
      end
    end

    context 'with zero page size' do
      let(:args) do
        {
          params: {
            page: {
              size: '0',        # ❌ Invalid (zero)
              number: '1'
            }
          }
        }
      end

      it 'raises ForestException' do
        expect do
          described_class.parse_pagination(args)
        end.to raise_error(ForestException, /Invalid pagination/)
      end
    end

    context 'with float values' do
      let(:args) do
        {
          params: {
            page: {
              size: '50.5',     # ❌ Invalid (float)
              number: '1'
            }
          }
        }
      end

      it 'raises ForestException' do
        expect do
          described_class.parse_pagination(args)
        end.to raise_error(ForestException, /Invalid pagination/)
      end
    end

    context 'with SQL injection attempt' do
      let(:args) do
        {
          params: {
            page: {
              size: '50',
              number: "'; DROP TABLE users--"  # ❌ Invalid
            }
          }
        }
      end

      it 'raises ForestException' do
        expect do
          described_class.parse_pagination(args)
        end.to raise_error(ForestException, /Invalid pagination/)
      end
    end

    context 'with special characters' do
      let(:args) do
        {
          params: {
            page: {
              size: '50!@#',    # ❌ Invalid
              number: '1'
            }
          }
        }
      end

      it 'raises ForestException' do
        expect do
          described_class.parse_pagination(args)
        end.to raise_error(ForestException, /Invalid pagination/)
      end
    end

    context 'with leading plus sign (valid)' do
      let(:args) do
        {
          params: {
            page: {
              size: '+50',      # ✅ Valid (+ allowed by regex)
              number: '+1'      # ✅ Valid
            }
          }
        }
      end

      it 'returns valid Page object' do
        page = described_class.parse_pagination(args)
        expect(page.limit).to eq(50)
        expect(page.offset).to eq(0)
      end
    end

    context 'with whitespace' do
      let(:args) do
        {
          params: {
            page: {
              size: ' 50 ',     # ❌ Invalid (whitespace)
              number: '1'
            }
          }
        }
      end

      it 'raises ForestException' do
        expect do
          described_class.parse_pagination(args)
        end.to raise_error(ForestException, /Invalid pagination/)
      end
    end
  end
end
```

### Integration Tests

**File:** `agent-ruby/packages/forest_admin_agent/spec/integration/pagination_validation_spec.rb`

```ruby
RSpec.describe 'Pagination Validation', type: :request do
  let(:user_token) { generate_test_token }

  describe 'GET /forest/:collection with invalid pagination' do
    context 'with invalid page size' do
      it 'returns 400 Bad Request' do
        get '/forest/bank_accounts?page[size]=abc&page[number]=1',
            headers: { 'Authorization' => "Bearer #{user_token}" }

        expect(response).to have_http_status(:bad_request)
        expect(json_response['errors'][0]['detail']).to match(/Invalid pagination/)
      end
    end

    context 'with invalid page number' do
      it 'returns 400 Bad Request' do
        get '/forest/bank_accounts?page[size]=50&page[number]=invalid',
            headers: { 'Authorization' => "Bearer #{user_token}" }

        expect(response).to have_http_status(:bad_request)
        expect(json_response['errors'][0]['detail']).to match(/Invalid pagination/)
      end
    end

    context 'with valid pagination' do
      it 'returns 200 OK' do
        get '/forest/bank_accounts?page[size]=50&page[number]=1',
            headers: { 'Authorization' => "Bearer #{user_token}" }

        expect(response).to have_http_status(:ok)
      end
    end
  end
end
```

### Manual Testing Checklist

- [ ] Test with valid page and size
- [ ] Test with invalid page size (string)
- [ ] Test with invalid page number (string)
- [ ] Test with both invalid
- [ ] Test with negative page number
- [ ] Test with negative page size
- [ ] Test with zero page size
- [ ] Test with zero page number
- [ ] Test with float values
- [ ] Test with special characters
- [ ] Test with SQL injection strings
- [ ] Test with whitespace
- [ ] Test with leading plus sign (+50)
- [ ] Test with very large numbers (overflow)
- [ ] Verify error messages are clear

---

## Deployment Considerations

### Pre-Deployment

1. **Review Current Logs**

   - Search for "Invalid pagination" errors
   - Check if bug has caused issues in production
   - Identify frequency of invalid parameters

2. **Risk Assessment**
   - Low risk: Fix makes validation stricter
   - No breaking changes (valid requests unaffected)
   - Only catches previously-missed invalid requests

### Deployment Strategy

**Option 1: Hotfix (Recommended)**

1. Deploy fix immediately
2. No feature flag needed (pure bug fix)
3. Zero risk to valid requests

**Timeline:**

- Development: 5 minutes
- Testing: 15 minutes
- Review: 5 minutes
- Deploy: 5 minutes
- **Total: 30 minutes**

**Option 2: Standard Release**

Include in next regular release.

### Post-Deployment

1. **Monitor Error Rates**

   - Watch for increase in "Invalid pagination" errors
   - Indicates previously-silent failures now being caught
   - Expected and good (bug being caught)

2. **User Reports**

   - May receive reports of "new errors"
   - Actually existing errors now being reported
   - Provide clear explanation

3. **Metrics**
   - Track invalid pagination attempts
   - Identify if bots/scrapers using invalid params
   - Consider rate limiting if abuse detected

### Rollback Plan

If issues arise:

1. **Symptoms:** Valid requests being rejected
2. **Action:** Revert to previous version
3. **Risk:** Extremely low (fix only corrects validation)

Rollback should NOT be needed - fix only makes validation stricter for invalid inputs.

---

## Related Issues

### Similar Bugs to Check

1. **Filter Validation**

   - Check if filter parameter validation has similar issue
   - File: `condition_tree_parser.rb`

2. **Sort Validation**

   - Check sort parameter validation
   - File: `query_string_parser.rb`

3. **Search Validation**
   - Check search parameter validation
   - File: `query_string_parser.rb`

### Future Improvements

1. **Add Maximum Page Size**

   ```ruby
   MAX_PAGE_SIZE = 1000

   if items_per_pages.to_i > MAX_PAGE_SIZE
     raise ForestException, "Page size cannot exceed #{MAX_PAGE_SIZE}"
   end
   ```

2. **Add Better Error Messages**

   ```ruby
   errors = []
   errors << "page[number] must be a positive integer" unless page_valid
   errors << "page[size] must be a positive integer" unless limit_valid
   raise ForestException, errors.join(', ') if errors.any?
   ```

3. **Add Parameter Sanitization**
   ```ruby
   def self.sanitize_integer(value, default)
     return default if value.nil?
     Integer(value)
   rescue ArgumentError
     raise ForestException, "Invalid integer: #{value}"
   end
   ```

---

## Implementation Checklist

### Development Phase

- [ ] Create feature branch: `fix/pagination-validation-logic`
- [ ] Implement Solution 1 (clear logic with variables)
- [ ] Change `||` to `&&` in validation
- [ ] Add intermediate variables for clarity
- [ ] Verify regex pattern is correct

### Testing Phase

- [ ] Write unit tests for all scenarios (11 test cases)
- [ ] Write integration tests for HTTP requests
- [ ] Run existing test suite
- [ ] Manual testing with curl/Postman
- [ ] Test edge cases (negatives, zeros, floats)

### Review Phase

- [ ] Self-review code changes
- [ ] Verify truth table is correct
- [ ] Check error messages are clear
- [ ] Peer code review
- [ ] Logic verification by second developer

### Deployment Phase

- [ ] Merge to main branch
- [ ] Tag release version
- [ ] Deploy to staging
- [ ] Test in staging
- [ ] Deploy to production
- [ ] Monitor error logs

### Documentation Phase

- [ ] Update CHANGELOG.md
- [ ] Document validation rules
- [ ] Add to troubleshooting guide

---

## Success Criteria

### Functional

- ✅ Invalid page numbers are rejected
- ✅ Invalid page sizes are rejected
- ✅ Valid pagination still works
- ✅ Clear error messages
- ✅ No SQL errors from invalid params

### Non-Functional

- ✅ Fix deployed within 30 minutes
- ✅ Zero customer impact (only catches invalid requests)
- ✅ Test coverage 100% for validation logic
- ✅ Logic verified by multiple developers

---

## Appendix: Regex Pattern Explanation

### Current Pattern

```ruby
/\A[+]?\d+\z/
```

**Breakdown:**

- `\A` - Start of string (not line)
- `[+]?` - Optional plus sign (note: minus not allowed)
- `\d+` - One or more digits
- `\z` - End of string (not line)

**Matches:**

- `"1"` ✅
- `"123"` ✅
- `"+50"` ✅
- `"0"` ✅ (though should be rejected logically)

**Does NOT Match:**

- `"-1"` ❌ (no minus in pattern)
- `"1.5"` ❌ (no decimal point)
- `"abc"` ❌ (not digits)
- `" 50"` ❌ (leading space)
- `"50 "` ❌ (trailing space)

### Potential Enhancement

```ruby
/\A[1-9]\d*\z/  # Positive integers only (no leading zeros, no zero)
```

This would reject:

- `"0"` (zero page size/number)
- `"+50"` (leading plus)
- `"007"` (leading zeros)

Consider for future improvement.

---

## Truth Table Reference

### Current Logic (WRONG)

```
A = page valid
B = limit valid

unless A || B
  raise
end

Raise if: NOT (A OR B) = (NOT A) AND (NOT B)
```

| A   | B   | A OR B | NOT (A OR B) | Raises? |
| --- | --- | ------ | ------------ | ------- |
| T   | T   | T      | F            | No      |
| T   | F   | T      | F            | No ❌   |
| F   | T   | T      | F            | No ❌   |
| F   | F   | F      | T            | Yes     |

### Fixed Logic (CORRECT)

```
unless A && B
  raise
end

Raise if: NOT (A AND B) = (NOT A) OR (NOT B)
```

| A   | B   | A AND B | NOT (A AND B) | Raises? |
| --- | --- | ------- | ------------- | ------- |
| T   | T   | T       | F             | No      |
| T   | F   | F       | T             | Yes ✅  |
| F   | T   | F       | T             | Yes ✅  |
| F   | F   | F       | T             | Yes     |

---

**TODO End**

_Priority: P0 - Fix immediately_
_Estimated Time: 5 minutes development + 25 minutes testing/deployment_
_Risk: None - Pure bug fix_
