# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/157/files

# TODO 009: Fix Permission Check Crash on Refetch

**Priority:** P0 - CRITICAL
**Estimated Effort:** 20 minutes
**Impact:** Permission checks crash during cache refresh, blocking all user access

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

The Permissions service in the Ruby Forest Admin agent crashes when checking permissions after a cache refetch. This occurs when a collection is removed from the schema between the initial permission check and the cache refresh, causing a nil reference error that blocks all user access.

### The Problem

```ruby
# First check with existence validation
is_allowed = collections_data.key?(collection.name.to_sym) &&
             collections_data[collection.name.to_sym][action].include?(user_data[:roleId])

# Refetch if not allowed
unless is_allowed
  collections_data = get_collections_permissions_data(force_fetch: true)

  # ❌ CRASH: No existence check after refetch!
  is_allowed = collections_data[collection.name.to_sym][action].include?(user_data[:roleId])
end
```

### The Solution

Add the same existence validation after refetch:

```ruby
unless is_allowed
  collections_data = get_collections_permissions_data(force_fetch: true)

  # ✅ Recheck existence after refetch
  if collections_data.key?(collection.name.to_sym) &&
     collections_data[collection.name.to_sym].key?(action)
    is_allowed = collections_data[collection.name.to_sym][action].include?(user_data[:roleId])
  else
    is_allowed = false
  end
end
```

**Time to Fix:** 20 minutes
**Risk:** None - Pure defensive improvement

---

## Bug Description

### Location

**File:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/services/permissions.rb`
**Lines:** 44-50

### Current Code

```ruby
def can?(user_data, collection, action)
  # Get cached permissions
  collections_data = get_collections_permissions_data

  # First check - HAS existence validation ✅
  is_allowed = collections_data.key?(collection.name.to_sym) &&
               collections_data[collection.name.to_sym][action].include?(user_data[:roleId])

  # Refetch if not allowed
  unless is_allowed
    collections_data = get_collections_permissions_data(force_fetch: true)

    # Second check - MISSING existence validation ❌
    is_allowed = collections_data[collection.name.to_sym][action].include?(user_data[:roleId])
  end

  is_allowed
end
```

### Error Scenario

**Timeline of the Bug:**

1. **T0:** User requests access to `bank_accounts` collection
2. **T1:** First permission check: `collections_data.key?(:bank_accounts)` → `true`
3. **T2:** User doesn't have permission → `is_allowed = false`
4. **T3:** Code triggers cache refetch: `get_collections_permissions_data(force_fetch: true)`
5. **T4:** Meanwhile, deployment removes `bank_accounts` from schema
6. **T5:** Refetch returns new permissions without `bank_accounts` collection
7. **T6:** Code tries: `collections_data[:bank_accounts][action]` → **CRASH**
   - `collections_data[:bank_accounts]` returns `nil`
   - `nil[action]` raises `NoMethodError: undefined method '[]' for nil:NilClass`

### Real-World Triggers

**Scenario 1: Rolling Deployment**

```
Server 1: Old schema with collection X
Server 2: New schema without collection X
User hits Server 1 → refetch gets data from Server 2 → CRASH
```

**Scenario 2: Schema Migration**

```
T0: Collection renamed: old_table → new_table
T1: User has permission for old_table (cached)
T2: Refetch happens during migration
T3: new_table exists, old_table doesn't → CRASH
```

**Scenario 3: Permission API Lag**

```
T0: Developer removes collection from code
T1: Schema update sent to Forest Admin
T2: Permission cache still has old collection
T3: API returns updated permissions (no old collection)
T4: Refetch happens → CRASH
```

**Scenario 4: Concurrent Schema Changes**

```
Admin A: Removes collection via UI
Admin B: User tries to access removed collection
Refetch pulls updated schema → CRASH
```

---

## Root Cause Analysis

### Why This Bug Exists

1. **Inconsistent Validation:** First check validates existence, refetch doesn't
2. **Race Condition Window:** Gap between checks allows schema changes
3. **Optimistic Assumption:** Code assumes collection exists after refetch
4. **Copy-Paste Error:** Likely someone simplified the refetch logic

### Code Evolution Theory

**Original code (probably):**

```ruby
def can?(user_data, collection, action)
  collections_data = get_collections_permissions_data

  # Both checks had validation
  is_allowed = safe_check(collections_data, collection, action, user_data)

  unless is_allowed
    collections_data = get_collections_permissions_data(force_fetch: true)
    is_allowed = safe_check(collections_data, collection, action, user_data)
  end

  is_allowed
end
```

**Refactored code (bug introduced):**

```ruby
def can?(user_data, collection, action)
  collections_data = get_collections_permissions_data

  # Inline validation for first check
  is_allowed = collections_data.key?(collection.name.to_sym) &&
               collections_data[collection.name.to_sym][action].include?(user_data[:roleId])

  unless is_allowed
    collections_data = get_collections_permissions_data(force_fetch: true)

    # ❌ Forgot to add validation here (assumed collection still exists)
    is_allowed = collections_data[collection.name.to_sym][action].include?(user_data[:roleId])
  end

  is_allowed
end
```

### Ruby Hash Access Pitfalls

```ruby
hash = { users: { browse: [1, 2, 3] } }

# UNSAFE - crashes if key missing
hash[:bank_accounts][:browse]
# => NoMethodError: undefined method '[]' for nil:NilClass

# SAFE - returns nil if key missing
hash.dig(:bank_accounts, :browse)
# => nil

# SAFE - explicit check
if hash.key?(:bank_accounts) && hash[:bank_accounts].key?(:browse)
  hash[:bank_accounts][:browse]
end
# => nil (no crash)
```

---

## Impact Assessment

### Severity: 🔴 CRITICAL

### What Breaks

1. **User Authentication Flow**

   - Any permission check can crash
   - Blocks all access to resources
   - No graceful degradation
   - Affects 100% of user requests

2. **Deployment Safety**

   - Cannot safely deploy schema changes
   - Rolling deployments become dangerous
   - Must coordinate all servers perfectly
   - Increases deployment complexity

3. **Permission Refetch**

   - SSE cache invalidation triggers refetch
   - Periodic cache refresh triggers refetch
   - Manual permission updates trigger refetch
   - All can cause crashes

4. **Multi-Tenant Environments**
   - Different tenants may have different schemas
   - Cross-tenant requests can crash
   - Shared permission cache causes issues

### Failure Modes

| Trigger                  | Impact                 | Frequency               | Detection Time |
| ------------------------ | ---------------------- | ----------------------- | -------------- |
| Rolling deployment       | All requests fail      | Every deployment        | Immediate      |
| Schema migration         | Specific requests fail | During migrations       | Minutes        |
| Collection removal       | Users lose access      | When accessed           | Immediate      |
| Permission cache refresh | Random crashes         | Periodic (15 min)       | Intermittent   |
| SSE invalidation         | Crash on update        | When permissions change | Immediate      |

### Blast Radius

- **Affected:** Any user accessing removed/renamed collections
- **Duration:** Until server restart or cache expiry
- **User Experience:** "Internal Server Error" (500)
- **Data Loss:** None (read-only operation)
- **Cascading Failures:** Yes (crashes thread/worker)

### Real Production Scenario

```
09:00 AM - Deploy starts (10 servers)
09:01 AM - Server 1-3 updated with new schema (removed old_collection)
09:02 AM - User on Server 4 (old schema) requests old_collection
09:02 AM - First check passes (cached data has old_collection)
09:02 AM - User lacks permission → triggers refetch
09:02 AM - Refetch hits updated permission API (no old_collection)
09:02 AM - Server 4 crashes with NoMethodError
09:02 AM - All users on Server 4 affected (thread pool blocked)
09:03 AM - Health check fails, Server 4 removed from load balancer
09:03 AM - Traffic shifts to other servers
09:03 AM - Same scenario repeats on Server 5, 6, 7...
09:05 AM - Rolling crash across all servers during deployment window
```

**Cost:** Production outage, rollback required, incident post-mortem

---

## Fix Implementation

### Solution 1: Inline Validation (Recommended)

**File:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/services/permissions.rb`

```ruby
def can?(user_data, collection, action)
  collections_data = get_collections_permissions_data

  # First check with existence validation
  is_allowed = collections_data.key?(collection.name.to_sym) &&
               collections_data[collection.name.to_sym].key?(action) &&
               collections_data[collection.name.to_sym][action].include?(user_data[:roleId])

  # Refetch if not allowed
  unless is_allowed
    collections_data = get_collections_permissions_data(force_fetch: true)

    # Recheck with same validation
    if collections_data.key?(collection.name.to_sym) &&
       collections_data[collection.name.to_sym].key?(action)
      is_allowed = collections_data[collection.name.to_sym][action].include?(user_data[:roleId])
    else
      # Collection or action doesn't exist after refetch
      ForestAdminAgent::Facades::Container.logger.log(
        'Debug',
        "Collection '#{collection.name}' or action '#{action}' not found after refetch. " \
        "Available collections: #{collections_data.keys.join(', ')}"
      )
      is_allowed = false
    end
  end

  is_allowed
end
```

**Changes:**

- Added `collections_data[collection.name.to_sym].key?(action)` check to first validation
- Added full existence validation after refetch
- Added debug logging when collection missing after refetch
- Returns `false` instead of crashing

**Lines Changed:** 5 lines added, 1 line modified

---

### Solution 2: Extract to Helper Method (Better Maintainability)

```ruby
def can?(user_data, collection, action)
  collections_data = get_collections_permissions_data

  # First check
  is_allowed = check_permission(collections_data, collection, action, user_data)

  # Refetch if not allowed
  unless is_allowed
    collections_data = get_collections_permissions_data(force_fetch: true)
    is_allowed = check_permission(collections_data, collection, action, user_data)
  end

  is_allowed
end

private

def check_permission(collections_data, collection, action, user_data)
  collection_key = collection.name.to_sym

  # Validate collection exists
  unless collections_data.key?(collection_key)
    ForestAdminAgent::Facades::Container.logger.log(
      'Debug',
      "Collection '#{collection.name}' not found in permissions. " \
      "Available: #{collections_data.keys.join(', ')}"
    )
    return false
  end

  # Validate action exists
  collection_permissions = collections_data[collection_key]
  unless collection_permissions.key?(action)
    ForestAdminAgent::Facades::Container.logger.log(
      'Debug',
      "Action '#{action}' not found for collection '#{collection.name}'. " \
      "Available: #{collection_permissions.keys.join(', ')}"
    )
    return false
  end

  # Check user permission
  role_ids = collection_permissions[action]
  role_ids.include?(user_data[:roleId])
end
```

**Benefits:**

- DRY principle (Don't Repeat Yourself)
- Easier to test in isolation
- Better logging for debugging
- Consistent validation in both checks
- Future-proof for additional validation logic

**Lines Changed:** 40 lines added (including new method), 10 lines simplified

---

### Solution 3: Minimal Fix (Quick Patch)

If time is absolutely critical:

```ruby
def can?(user_data, collection, action)
  collections_data = get_collections_permissions_data

  is_allowed = collections_data.key?(collection.name.to_sym) &&
               collections_data[collection.name.to_sym][action].include?(user_data[:roleId])

  unless is_allowed
    collections_data = get_collections_permissions_data(force_fetch: true)

    # Add existence check
    is_allowed = collections_data.key?(collection.name.to_sym) &&
                 collections_data[collection.name.to_sym]&.key?(action) &&
                 collections_data[collection.name.to_sym][action].include?(user_data[:roleId])
  end

  is_allowed
end
```

**Pros:** Only 2 lines changed, 5-minute fix
**Cons:** Still has code duplication, no logging, uses safe navigation `&.`

---

**Recommendation:** Use **Solution 2** for production quality and maintainability.

---

## Testing Strategy

### Unit Tests

**File:** `agent-ruby/packages/forest_admin_agent/spec/lib/forest_admin_agent/services/permissions_spec.rb`

```ruby
RSpec.describe ForestAdminAgent::Services::Permissions do
  let(:user_data) { { roleId: 1, id: 123 } }
  let(:collection) { double(name: 'bank_accounts') }

  describe '#can?' do
    context 'when collection exists in both checks' do
      let(:permissions_data) do
        {
          bank_accounts: {
            browse: [1, 2, 3],
            edit: [1]
          }
        }
      end

      before do
        allow(described_class).to receive(:get_collections_permissions_data)
          .and_return(permissions_data)
      end

      it 'returns true if user has permission' do
        result = described_class.can?(user_data, collection, 'browse')
        expect(result).to be true
      end

      it 'returns false if user lacks permission' do
        user_data[:roleId] = 999
        result = described_class.can?(user_data, collection, 'browse')
        expect(result).to be false
      end
    end

    context 'when collection removed after first check (CRITICAL BUG)' do
      let(:initial_permissions) do
        {
          bank_accounts: {
            browse: [2, 3]  # User roleId=1 not in list
          }
        }
      end

      let(:refetched_permissions) do
        {
          # bank_accounts collection removed!
          users: {
            browse: [1, 2, 3]
          }
        }
      end

      before do
        # First call returns data with bank_accounts
        # Second call (refetch) returns data without bank_accounts
        allow(described_class).to receive(:get_collections_permissions_data)
          .and_return(initial_permissions, refetched_permissions)
      end

      it 'does not crash and returns false' do
        expect do
          result = described_class.can?(user_data, collection, 'browse')
          expect(result).to be false
        end.not_to raise_error
      end

      it 'logs debug message about missing collection' do
        expect(ForestAdminAgent::Facades::Container.logger).to receive(:log)
          .with('Debug', /Collection 'bank_accounts' not found/)

        described_class.can?(user_data, collection, 'browse')
      end
    end

    context 'when action removed after first check' do
      let(:initial_permissions) do
        {
          bank_accounts: {
            browse: [2, 3],
            edit: [1]
          }
        }
      end

      let(:refetched_permissions) do
        {
          bank_accounts: {
            browse: [1, 2, 3]
            # 'edit' action removed!
          }
        }
      end

      before do
        allow(described_class).to receive(:get_collections_permissions_data)
          .and_return(initial_permissions, refetched_permissions)
      end

      it 'does not crash and returns false' do
        expect do
          result = described_class.can?(user_data, collection, 'edit')
          expect(result).to be false
        end.not_to raise_error
      end

      it 'logs debug message about missing action' do
        expect(ForestAdminAgent::Facades::Container.logger).to receive(:log)
          .with('Debug', /Action 'edit' not found/)

        described_class.can?(user_data, collection, 'edit')
      end
    end

    context 'when collection renamed during check' do
      let(:old_collection) { double(name: 'old_bank_accounts') }
      let(:initial_permissions) do
        {
          old_bank_accounts: {
            browse: [2, 3]
          }
        }
      end

      let(:refetched_permissions) do
        {
          new_bank_accounts: {  # Renamed
            browse: [1, 2, 3]
          }
        }
      end

      before do
        allow(described_class).to receive(:get_collections_permissions_data)
          .and_return(initial_permissions, refetched_permissions)
      end

      it 'does not crash when old name not found' do
        expect do
          result = described_class.can?(user_data, old_collection, 'browse')
          expect(result).to be false
        end.not_to raise_error
      end
    end

    context 'when permissions data is empty after refetch' do
      let(:initial_permissions) do
        {
          bank_accounts: {
            browse: [2, 3]
          }
        }
      end

      let(:refetched_permissions) { {} }

      before do
        allow(described_class).to receive(:get_collections_permissions_data)
          .and_return(initial_permissions, refetched_permissions)
      end

      it 'does not crash and returns false' do
        expect do
          result = described_class.can?(user_data, collection, 'browse')
          expect(result).to be false
        end.not_to raise_error
      end
    end

    context 'when refetch grants permission (happy path)' do
      let(:initial_permissions) do
        {
          bank_accounts: {
            browse: [2, 3]  # User not allowed initially
          }
        }
      end

      let(:refetched_permissions) do
        {
          bank_accounts: {
            browse: [1, 2, 3]  # User now allowed
          }
        }
      end

      before do
        allow(described_class).to receive(:get_collections_permissions_data)
          .and_return(initial_permissions, refetched_permissions)
      end

      it 'returns true after refetch' do
        result = described_class.can?(user_data, collection, 'browse')
        expect(result).to be true
      end

      it 'does not log debug message' do
        expect(ForestAdminAgent::Facades::Container.logger).not_to receive(:log)
          .with('Debug', anything)

        described_class.can?(user_data, collection, 'browse')
      end
    end
  end
end
```

### Integration Tests

**File:** `agent-ruby/packages/forest_admin_agent/spec/integration/permissions_during_deployment_spec.rb`

```ruby
RSpec.describe 'Permissions During Rolling Deployment', type: :integration do
  let(:agent) { ForestAdminAgent::Builder.build(...) }
  let(:user_token) { generate_test_token(roleId: 1) }

  before do
    # Stub Forest Admin permissions API
    stub_request(:get, 'https://api.forestadmin.com/liana/v4/permissions')
  end

  context 'during schema migration' do
    it 'handles collection removal gracefully' do
      # Initial state: collection exists
      stub_permissions_api(collections: { old_table: { browse: [1] } })

      # User makes first request
      get '/forest/old_table', headers: { 'Authorization' => "Bearer #{user_token}" }
      expect(response).to have_http_status(:forbidden)  # Not in roleIds

      # Schema updated: collection removed
      stub_permissions_api(collections: { new_table: { browse: [1] } })

      # Trigger cache refetch (happens automatically)
      ForestAdminAgent::Services::Permissions.invalidate_cache('forest.collections')

      # User makes second request (should not crash)
      expect do
        get '/forest/old_table', headers: { 'Authorization' => "Bearer #{user_token}" }
      end.not_to raise_error

      expect(response).to have_http_status(:forbidden)
    end
  end

  context 'during rolling deployment' do
    it 'handles cross-server schema differences' do
      # Server A: old schema
      stub_permissions_api(collections: { bank_accounts: { browse: [2] } })

      # User request hits Server A
      get '/forest/bank_accounts', headers: { 'Authorization' => "Bearer #{user_token}" }

      # Refetch happens, hits Server B with new schema (no bank_accounts)
      stub_permissions_api(collections: { financial_accounts: { browse: [1] } })

      # Should not crash
      expect do
        get '/forest/bank_accounts', headers: { 'Authorization' => "Bearer #{user_token}" }
      end.not_to raise_error
    end
  end
end
```

### Manual Testing Checklist

- [ ] Test normal permission check (user has permission)
- [ ] Test normal permission check (user lacks permission)
- [ ] Test refetch grants permission (roleId added)
- [ ] Test collection removed between checks (main bug scenario)
- [ ] Test action removed between checks
- [ ] Test collection renamed between checks
- [ ] Test empty permissions after refetch
- [ ] Test nil permissions after refetch
- [ ] Test concurrent requests during schema change
- [ ] Test SSE invalidation triggering refetch
- [ ] Test periodic cache refresh
- [ ] Test manual invalidation via API
- [ ] Verify debug logging for missing collections
- [ ] Verify debug logging for missing actions
- [ ] Deploy new schema and verify no crashes

---

## Deployment Considerations

### Pre-Deployment

1. **Identify Risk Window**

   - Most risky during rolling deployments
   - Schema migrations are high-risk
   - Collection renames/removals are triggers

2. **Current Crash Frequency**

   - Search logs for: `NoMethodError.*permissions`
   - Check Sentry/error tracking for permission crashes
   - Identify affected collections

3. **Communication**
   - Alert team about fix
   - Explain safer deployments after fix
   - Document rolling deployment best practices

### Deployment Strategy

**Option 1: Hotfix During Maintenance Window**

1. Schedule 5-minute maintenance window
2. Deploy fix to all servers simultaneously
3. Restart all servers
4. Resume traffic

**Risk:** Low (5-minute downtime)
**Benefit:** Guaranteed all servers on same version

**Option 2: Rolling Deployment (After Fix)**

1. Deploy fix with rolling strategy
2. Monitor for any permission errors
3. This fix actually enables safe rolling deployments

**Risk:** Very low (fix prevents crashes)
**Benefit:** Zero downtime

**Recommendation:** Option 2 (rolling) since the fix itself enables safe rolling deployments.

### Post-Deployment

1. **Monitor Logs**

   - Watch for debug messages about missing collections
   - Track refetch frequency
   - Verify no NoMethodError in permissions

2. **Metrics to Track**

   - Permission cache hit rate
   - Refetch frequency
   - Number of "collection not found" debug logs
   - Permission check latency

3. **Validation**
   - Test schema change deployment
   - Verify no crashes during collection removal
   - Confirm graceful degradation

### Rollback Plan

If issues arise:

1. **Symptoms:** Permission checks returning false incorrectly
2. **Action:** Revert to previous version
3. **Risk:** Minimal - fix only adds safety

Rollback should NOT be needed - this is a pure defensive fix.

---

## Related Issues

### Similar Bugs in Codebase

1. **IP Whitelist Service** (Issue 1.1)

   - Same pattern: nil reference on API response
   - Also needs existence validation
   - Already documented in TODO_008

2. **Smart Action Checker** (Section 6.1)

   - Similar array access without validation
   - File: `smart_action_checker.rb:88`
   - Should apply same pattern

3. **Any API Response Parsing**
   - Review all `JSON.parse` locations
   - Add validation for nested hash access
   - Use `.dig()` consistently

### Future Improvements

1. **Add Circuit Breaker**

   ```ruby
   def can?(user_data, collection, action)
     @refetch_failures ||= 0

     # Skip refetch if too many recent failures
     if @refetch_failures > 5
       return check_permission(get_collections_permissions_data, ...)
     end

     # ... existing logic with refetch
   rescue => e
     @refetch_failures += 1
     false
   end
   ```

2. **Add Metrics**

   ```ruby
   def can?(user_data, collection, action)
     start_time = Time.now
     result = perform_permission_check(...)

     StatsD.timing('permissions.check', Time.now - start_time)
     StatsD.increment('permissions.refetch') if refetch_occurred
     StatsD.increment('permissions.missing_collection') if collection_not_found

     result
   end
   ```

3. **Add Warning for Frequent Refetches**

   ```ruby
   def can?(user_data, collection, action)
     @refetch_count ||= 0

     result = check_with_refetch(...)

     if @refetch_count > 100
       ForestAdminAgent::Facades::Container.logger.log(
         'Warn',
         "Excessive permission refetches detected: #{@refetch_count}. " \
         "Consider increasing cache duration."
       )
     end

     result
   end
   ```

4. **Cache Per Collection**
   Instead of invalidating entire cache, invalidate per collection:
   ```ruby
   def get_collections_permissions_data(collection: nil, force_fetch: false)
     if collection
       @cache[collection] = fetch_from_api if force_fetch || @cache[collection].nil?
       @cache[collection]
     else
       @cache[:all] = fetch_from_api if force_fetch || @cache[:all].nil?
       @cache[:all]
     end
   end
   ```

---

## Implementation Checklist

### Development Phase

- [ ] Create feature branch: `fix/permission-check-refetch-crash`
- [ ] Implement Solution 2 (extract helper method)
- [ ] Add `check_permission` private method
- [ ] Add debug logging for missing collections
- [ ] Add debug logging for missing actions
- [ ] Add action key existence check to first validation
- [ ] Ensure consistent validation in both checks

### Testing Phase

- [ ] Write unit tests for all scenarios (7 test cases)
- [ ] Write integration tests for deployment scenarios
- [ ] Test with concurrent requests
- [ ] Test with rolling deployment simulation
- [ ] Run existing test suite (ensure no regressions)
- [ ] Manual testing with real schema changes
- [ ] Verify debug logging output

### Review Phase

- [ ] Self-review code changes
- [ ] Check logging is helpful for debugging
- [ ] Verify no breaking changes
- [ ] Peer code review
- [ ] Security review (fail-closed behavior)

### Deployment Phase

- [ ] Merge to main branch
- [ ] Tag release version
- [ ] Deploy to staging
- [ ] Test schema changes in staging
- [ ] Deploy to production (rolling)
- [ ] Monitor logs for 2 hours
- [ ] Verify no permission crashes

### Documentation Phase

- [ ] Update CHANGELOG.md
- [ ] Document in deployment guide
- [ ] Add to incident post-mortem if this caused outage
- [ ] Update troubleshooting docs

---

## Success Criteria

### Functional

- ✅ No NoMethodError in permission checks
- ✅ Graceful handling of removed collections
- ✅ Graceful handling of removed actions
- ✅ Safe rolling deployments
- ✅ Safe schema migrations
- ✅ Consistent behavior in both check paths

### Non-Functional

- ✅ Fix deployed within 1 hour
- ✅ Zero downtime deployment
- ✅ No customer impact
- ✅ Test coverage >95%
- ✅ Clear debug logging for issues
- ✅ Enables safer future deployments

---

## Appendix: Permission Data Structure

### Expected Structure

```ruby
{
  bank_accounts: {
    browse: [1, 2, 3],      # Role IDs allowed to browse
    read: [1, 2],           # Role IDs allowed to read
    edit: [1],              # Role IDs allowed to edit
    add: [1],               # Role IDs allowed to add
    delete: [1],            # Role IDs allowed to delete
    export: [1, 2]          # Role IDs allowed to export
  },
  transactions: {
    browse: [1, 2, 3],
    read: [1, 2, 3],
    # ... other actions
  }
}
```

### Edge Cases

**Empty permissions:**

```ruby
{}  # No collections
```

**Collection with no actions:**

```ruby
{
  bank_accounts: {}  # Collection exists but no actions defined
}
```

**Action with no roles:**

```ruby
{
  bank_accounts: {
    browse: []  # No roles allowed (deny all)
  }
}
```

**Partial permissions:**

```ruby
{
  bank_accounts: {
    browse: [1, 2, 3]
    # Other actions missing (should deny by default)
  }
}
```

---

**TODO End**

_Priority: P0 - Fix immediately_
_Estimated Time: 20 minutes development + 40 minutes testing/deployment_
_Risk: None - Pure defensive improvement_
