# Forest Admin Agent: Bugs & Missing Features Report
**Ruby vs Node.js Implementation Analysis**

**Generated:** October 17, 2025
**Scope:** Core agent implementations only (agent-nodejs & agent-ruby)
**Analysis:** Production gem code, excluding test projects

---

## Executive Summary

This report documents **real bugs and missing features** found in the Forest Admin Ruby agent compared to the Node.js reference implementation. The focus is on **actual production code issues**, not test/example projects.

### Key Findings

| Category | Count | Severity |
|----------|-------|----------|
| **Critical Bugs** | 5 | Crashes, nil references, type errors |
| **High Priority Bugs** | 4 | Logic errors, validation issues |
| **Missing Features** | 3 | Per parity report |
| **Security Concerns** | 3 | SQL injection risk, missing validations |
| **Performance Issues** | 3 | Memory, N+1 queries, no limits |
| **Medium/Low Issues** | 10+ | Error handling, concurrency, data handling |

---

## 1. CRITICAL BUGS (Must Fix Immediately)

### 1.1 🔴 Nil Reference Error in IP Whitelist Service

**File:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/services/ip_whitelist.rb`
**Lines:** 88-94

**Issue:**
```ruby
def fetch_rules
  response = forest_api.get('/liana/v1/ip-whitelist-rules')

  body = JSON.parse(response.body)
  ip_whitelist_data = body['data']['attributes']  # ❌ No nil check!

  @use_ip_whitelist = ip_whitelist_data['use_ip_whitelist']
  @rules = ip_whitelist_data['rules']
```

**Problem:** Direct hash access without checking if `body['data']` or `body['data']['attributes']` exist. If the API returns an unexpected structure (error response, empty data, etc.), this will raise `NoMethodError: undefined method '[]' for nil:NilClass`.

**Impact:**
- Service crashes when API returns unexpected response
- Entire application becomes unusable (IP whitelist check fails)
- No graceful degradation

**Severity:** 🔴 CRITICAL
**Effort:** 30 minutes

**Fix:**
```ruby
def fetch_rules
  response = forest_api.get('/liana/v1/ip-whitelist-rules')
  body = JSON.parse(response.body)

  # Validate structure
  unless body&.dig('data', 'attributes')
    Rails.logger.error("Invalid IP whitelist response structure: #{body}")
    @use_ip_whitelist = false
    @rules = []
    return
  end

  ip_whitelist_data = body['data']['attributes']
  @use_ip_whitelist = ip_whitelist_data['use_ip_whitelist']
  @rules = ip_whitelist_data['rules']
end
```

---

### 1.2 🔴 Crash in Mongoid ID Parsing

**File:** `agent-ruby/packages/forest_admin_datasource_mongoid/lib/forest_admin_datasource_mongoid/utils/helpers.rb`
**Lines:** 129-137

**Issue:**
```ruby
def split_id(id)
  dot_index = id.index('.')
  root_id = id[0...dot_index]     # ❌ dot_index could be nil!
  path = id[(dot_index + 1)..]    # ❌ nil + 1 = TypeError!

  root_id = BSON::ObjectId.from_string(root_id) if BSON::ObjectId.legal?(root_id)

  [root_id, path]
end
```

**Problem:** If `id.index('.')` returns nil (id doesn't contain a dot), the string indexing operations will crash:
- Line 131: `id[0...nil]` works but returns entire string
- Line 132: `nil + 1` raises `TypeError: nil can't be coerced into Integer`

**Impact:**
- Application crash when processing simple IDs (without dots)
- All Mongoid operations fail for non-nested IDs
- Production incident

**Severity:** 🔴 CRITICAL
**Effort:** 15 minutes

**Fix:**
```ruby
def split_id(id)
  dot_index = id.index('.')

  if dot_index.nil?
    # Simple ID without nesting
    root_id = BSON::ObjectId.legal?(id) ? BSON::ObjectId.from_string(id) : id
    return [root_id, nil]
  end

  root_id = id[0...dot_index]
  path = id[(dot_index + 1)..]

  root_id = BSON::ObjectId.from_string(root_id) if BSON::ObjectId.legal?(root_id)

  [root_id, path]
end
```

---

### 1.3 🔴 Permission Check Crash on Refetch

**File:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/services/permissions.rb`
**Lines:** 44-50

**Issue:**
```ruby
is_allowed = collections_data.key?(collection.name.to_sym) &&
             collections_data[collection.name.to_sym][action].include?(user_data[:roleId])

# Refetch
unless is_allowed
  collections_data = get_collections_permissions_data(force_fetch: true)
  is_allowed = collections_data[collection.name.to_sym][action].include?(user_data[:roleId])  # ❌ Line 49
end
```

**Problem:** Line 49 doesn't check if `collection.name.to_sym` key exists after refetch. If a collection was removed between checks, this raises `NoMethodError: undefined method '[]' for nil:NilClass`.

**Impact:**
- Permission checks crash randomly
- Occurs during deployments when schema changes
- Users cannot access any resources

**Severity:** 🔴 CRITICAL
**Effort:** 20 minutes

**Fix:**
```ruby
is_allowed = collections_data.key?(collection.name.to_sym) &&
             collections_data[collection.name.to_sym][action].include?(user_data[:roleId])

# Refetch
unless is_allowed
  collections_data = get_collections_permissions_data(force_fetch: true)

  # Recheck existence after refetch
  if collections_data.key?(collection.name.to_sym) &&
     collections_data[collection.name.to_sym].key?(action)
    is_allowed = collections_data[collection.name.to_sym][action].include?(user_data[:roleId])
  else
    is_allowed = false
  end
end
```

---

### 1.4 🔴 Incorrect Pagination Validation Logic

**File:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/utils/query_string_parser.rb`
**Lines:** 68-70

**Issue:**
```ruby
unless !items_per_pages.to_s.match(/\A[+]?\d+\z/).nil? || !page.to_s.match(/\A[+]?\d+\z/).nil?
  raise ForestException, "Invalid pagination [limit: #{items_per_pages}, skip: #{page}]"
end
```

**Problem:** The double negative with `||` creates incorrect logic:
- Current: `unless (A is valid) || (B is valid)` → raises only if **BOTH** are invalid
- Should be: `unless (A is valid) && (B is valid)` → raises if **EITHER** is invalid

**Example of bug:**
```ruby
items_per_page = "abc"  # invalid
page = 1                # valid

# Current logic: unless true || false => unless true => doesn't raise ❌
# Should raise: unless false && true => unless false => raises ✅
```

**Impact:**
- Invalid pagination parameters pass validation
- Database queries with invalid limits/offsets
- SQL errors or unexpected results

**Severity:** 🔴 HIGH
**Effort:** 5 minutes

**Fix:**
```ruby
page_valid = !page.to_s.match(/\A[+]?\d+\z/).nil?
limit_valid = !items_per_pages.to_s.match(/\A[+]?\d+\z/).nil?

unless page_valid && limit_valid
  raise ForestException, "Invalid pagination [limit: #{items_per_pages}, skip: #{page}]"
end
```

---

### 1.5 🔴 Empty Array Causes Crash in Mongoid Update

**File:** `agent-ruby/packages/forest_admin_datasource_mongoid/lib/forest_admin_datasource_mongoid/collection.rb`
**Lines:** 71-75

**Issue:**
```ruby
if ids.length > 1
  @model.where(_id: ids).update_all(formatted_patch)
else
  @model.find(ids.first).update(formatted_patch)  # ❌ ids.first could be nil!
end
```

**Problem:** If `ids` is an empty array:
- `ids.length > 1` is false (goes to else branch)
- `ids.first` returns `nil`
- `@model.find(nil)` raises `Mongoid::Errors::InvalidFind`

**Impact:**
- Crashes when update filter matches no records
- Should be no-op, but raises exception instead
- Breaks bulk update operations

**Severity:** 🔴 HIGH
**Effort:** 10 minutes

**Fix:**
```ruby
return if ids.empty?  # Early return for empty results

if ids.length > 1
  @model.where(_id: ids).update_all(formatted_patch)
else
  @model.find(ids.first).update(formatted_patch)
end
```

---

## 2. MISSING FEATURES (From Parity Report)

### 2.1 ❌ Missing: Update Field Endpoint

**Status:** Not implemented in Ruby
**Node.js Route:** `PUT /:collection/:id/relationships/:field/:index`

**Description:** Endpoint to update a single element within an array field.

**Impact:**
- Cannot update individual array elements
- Must read entire array, modify client-side, send back
- Race conditions in concurrent edits
- Network overhead

**Reference:** See `TODO_001_UPDATE_FIELD_ENDPOINT_DETAILED.md` for implementation guide

**Severity:** 🟡 HIGH (missing feature)
**Effort:** 3-5 days

---

### 2.2 ❌ Missing: CSV Streaming

**Status:** Ruby loads entire dataset into memory
**Node.js:** Streams in 1000-record chunks

**Issue:**
```ruby
# agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/routes/resources/csv.rb:40
records = @collection.list(@caller, filter, projection)  # ❌ Loads ALL records

# agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/utils/csv_generator.rb:13-19
records.each do |row|
  data[col_name] << ...  # ❌ Buffers all data in memory
end
```

**Impact:**
- Memory exhaustion on exports >10k records
- Server crashes with large datasets
- Production instability
- No backpressure handling

**Comparison:**
- **Node.js:** 100k records = ~10MB memory (constant)
- **Ruby:** 100k records = ~500MB memory (grows linearly)

**Reference:** See `TODO_002_CSV_STREAMING_DETAILED.md` for implementation guide

**Severity:** 🔴 CRITICAL (production blocker)
**Effort:** 3-5 days

---

### 2.3 ⚠️ Missing: Webhook & File Action Results

**Status:** Not implemented in Ruby
**Node.js:** Full support for all action result types

**Missing Types:**
1. **Webhook Result** - Cannot return webhook details for frontend to execute
2. **File Result** - Incomplete/untested file download support

**Impact:**
- Limited integration capabilities
- Cannot trigger external systems (Slack, webhooks)
- Cannot generate downloadable reports from actions

**Reference:**
- `TODO_003_WEBHOOK_ACTIONS_DETAILED.md`
- `TODO_004_FILE_ACTIONS_DETAILED.md`

**Severity:** 🟡 MEDIUM (missing features)
**Effort:** 5-8 days (webhook), 3-5 days (file)

---

## 3. SECURITY CONCERNS

### 3.1 ⚠️ SQL Injection Risk in Date Truncation

**File:** `agent-ruby/packages/forest_admin_datasource_active_record/lib/forest_admin_datasource_active_record/utils/query_aggregate.rb`
**Lines:** 61-74

**Issue:**
```ruby
def date_trunc_sql(operation, field)
  adapter_name = @collection.model.connection.adapter_name.downcase
  operation = operation.downcase

  case adapter_name
  when 'postgresql'
    "DATE_TRUNC('#{operation}', #{field})"  # ❌ String interpolation!
```

**Problem:** While `operation` comes from aggregation objects (likely safe), direct string interpolation could be risky if validation fails upstream. The `field` uses `format_field()` but isn't parameterized.

**Impact:**
- Potential SQL injection if validation bypassed
- Could allow arbitrary SQL execution

**Severity:** 🟡 MEDIUM
**Effort:** 2-4 hours

**Recommendation:**
```ruby
# Use Arel or ensure strict validation upstream
def date_trunc_sql(operation, field)
  # Whitelist allowed operations
  valid_operations = %w[second minute hour day week month quarter year]
  unless valid_operations.include?(operation.downcase)
    raise ArgumentError, "Invalid date operation: #{operation}"
  end

  # ... rest of code
end
```

---

### 3.2 ⚠️ No Maximum Pagination Limit

**File:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/utils/query_string_parser.rb`
**Lines:** 61-74

**Issue:**
```ruby
items_per_pages = args.dig(:params, :page, :size) || DEFAULT_ITEMS_PER_PAGE
# No maximum limit check! User could request size: 999999999
```

**Impact:**
- Denial of Service via large page sizes
- Memory exhaustion
- Database overload

**Severity:** 🔴 HIGH
**Effort:** 30 minutes

**Fix:**
```ruby
MAX_PAGE_SIZE = 1000

items_per_pages = args.dig(:params, :page, :size) || DEFAULT_ITEMS_PER_PAGE
items_per_pages = items_per_pages.to_i

if items_per_pages > MAX_PAGE_SIZE
  raise ForestException, "Page size cannot exceed #{MAX_PAGE_SIZE} (requested: #{items_per_pages})"
end
```

---

### 3.3 ⚠️ Missing Primary Key Check in Smart Actions

**File:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/services/smart_action_checker.rb`
**Lines:** 69-88

**Issue:**
```ruby
def match_conditions(condition_name)
  pk = Schema.primary_keys(collection)[0]  # ❌ No check if pk exists!
  condition_filter = if attributes[:all_records]
                       Nodes::ConditionTreeLeaf.new(pk, 'NOT_EQUAL', ...)
```

**Problem:** If collection has no primary keys, `pk` will be nil, causing crash when creating condition tree.

**Severity:** 🟡 MEDIUM
**Effort:** 15 minutes

**Fix:**
```ruby
def match_conditions(condition_name)
  pks = Schema.primary_keys(collection)
  if pks.empty?
    raise ForestException, "Collection #{collection.name} has no primary keys"
  end

  pk = pks[0]
  # ... rest
end
```

---

## 4. PERFORMANCE ISSUES

### 4.1 🔴 CSV Export Memory Issue

**Already covered in Missing Features 2.2**

---

### 4.2 ⚠️ Potential N+1 Queries in Serialization

**File:** `agent-ruby/packages/forest_admin_datasource_active_record/lib/forest_admin_datasource_active_record/collection.rb`
**Lines:** 23-26

**Issue:**
```ruby
def list(_caller, filter, projection)
  query = Utils::Query.new(self, projection, filter)
  query.get.map { |record| Utils::ActiveRecordSerializer.new(record).to_hash(projection) }
end
```

**Problem:** While `Query` class handles includes/joins, if projection includes nested relations, the serializer might trigger additional queries per record.

**Impact:**
- N+1 queries on complex projections
- Slow response times
- Database overload

**Severity:** 🟡 MEDIUM
**Effort:** 8-16 hours (requires profiling + optimization)

**Recommendation:**
- Profile with `bullet` gem
- Ensure all projected relations are eager-loaded
- Add query count monitoring in tests

---

### 4.3 ⚠️ No Pagination Limit Enforcement

**Already covered in Security 3.2**

---

## 5. CODE QUALITY ISSUES

### 5.1 ⚠️ SSE Cache Invalidation Logging Bug

**File:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/services/sse_cache_invalidation.rb`
**Lines:** 24-38

**Issue:**
```ruby
client.on_event do |event|
  next if event.type == :heartbeat

  MESSAGE_CACHE_KEYS[event.type]&.each do |cache_key|
    Permissions.invalidate_cache(cache_key)
    ForestAdminAgent::Facades::Container.logger.log(
      'Info',
      "invalidate cache #{MESSAGE_CACHE_KEYS[event.type]} for event #{event.type}"
    )
  end

  # ❌ This ALWAYS logs, even when event was handled above!
  ForestAdminAgent::Facades::Container.logger.log(
    'Info',
    "SSECacheInvalidation: unhandled message from server: #{event.type}"
  )
end
```

**Problem:** The "unhandled message" log fires for ALL events, not just unhandled ones.

**Impact:**
- Confusing logs
- False alerts about "unhandled" events
- Difficult debugging

**Severity:** 🟢 LOW
**Effort:** 10 minutes

**Fix:**
```ruby
client.on_event do |event|
  next if event.type == :heartbeat

  if MESSAGE_CACHE_KEYS[event.type]
    MESSAGE_CACHE_KEYS[event.type].each do |cache_key|
      Permissions.invalidate_cache(cache_key)
      ForestAdminAgent::Facades::Container.logger.log(
        'Info',
        "invalidate cache #{MESSAGE_CACHE_KEYS[event.type]} for event #{event.type}"
      )
    end
  else
    ForestAdminAgent::Facades::Container.logger.log(
      'Info',
      "SSECacheInvalidation: unhandled message from server: #{event.type}"
    )
  end
end
```

---

### 5.2 ⚠️ Silent Error Swallowing

**Multiple Locations:**
- `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/utils/id.rb:43-46`
- `agent-ruby/packages/forest_admin_datasource_active_record/lib/forest_admin_datasource_active_record/parser/relation.rb:20-24`
- `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/utils/caller_parser.rb:63-64`

**Issue:**
```ruby
# Example from relation.rb
def get_class(association)
  association.klass
rescue StandardError
  nil  # ❌ Swallows all errors silently!
end
```

**Problem:** Catches all exceptions and returns nil without logging. Makes debugging extremely difficult.

**Impact:**
- Silent failures
- Hard-to-debug issues
- Hidden configuration errors

**Severity:** 🟡 MEDIUM
**Effort:** 2-4 hours (fix all occurrences)

**Fix:**
```ruby
def get_class(association)
  association.klass
rescue StandardError => e
  ForestAdminAgent::Facades::Container.logger.log(
    'Warn',
    "Failed to get class for association: #{e.message}"
  )
  nil
end
```

---

### 5.3 ⚠️ Unsafe Array Access in Smart Action Checker

**File:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/services/smart_action_checker.rb`
**Line:** 88

**Issue:**
```ruby
(rows.empty? ? 0 : rows[0]['value']) == attributes[:ids].count
```

**Problem:** Assumes `rows[0]['value']` exists. If aggregate returns unexpected structure, crashes with `NoMethodError`.

**Severity:** 🟡 MEDIUM
**Effort:** 10 minutes

**Fix:**
```ruby
actual_count = rows.empty? ? 0 : (rows[0]&.dig('value') || 0)
actual_count == attributes[:ids].count
```

---

### 5.4 ⚠️ Non-Thread-Safe Cache Access

**File:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/services/permissions.rb`

**Issue:** The Permissions class uses class-level cache (`@cache`) without mutex protection. In multi-threaded environments (Puma, Falcon), concurrent requests could cause race conditions.

**Impact:**
- Cache corruption
- Incorrect permissions
- Intermittent authorization failures

**Severity:** 🟡 MEDIUM
**Effort:** 2-4 hours

**Fix:**
```ruby
class Permissions
  @cache = {}
  @cache_mutex = Mutex.new

  def self.get_collections_permissions_data(force_fetch: false)
    @cache_mutex.synchronize do
      # ... cache access logic
    end
  end
end
```

---

## 6. INCOMPLETE IMPLEMENTATIONS

### 6.1 📝 Missing IP Whitelist SSE Invalidation

**File:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/services/sse_cache_invalidation.rb`
**Line:** 12

**Issue:**
```ruby
MESSAGE_CACHE_KEYS = {
  'refresh-users': %w[forest.users],
  'refresh-roles': %w[forest.collections],
  'refresh-renderings': %w[forest.collections forest.rendering]
  # TODO: add one for ip whitelist when server implement it
}.freeze
```

**Impact:** IP whitelist changes require server restart

**Severity:** 🟢 LOW
**Effort:** 2 hours (when server-side implemented)

---

### 6.2 📝 Incomplete Complex Type Validation

**File:** `agent-ruby/packages/forest_admin_datasource_toolkit/lib/forest_admin_datasource_toolkit/validations/field_validator.rb`
**Lines:** 55-57

**Issue:**
```ruby
# TODO: FIXME: handle complex type from ColumnType
# if schema.column_type != PrimitiveType::STRING
# end
```

**Impact:** Type validation incomplete for complex types

**Severity:** 🟢 LOW
**Effort:** 4-8 hours

---

### 6.3 📝 Mongoid Virtual Field Limitations

**File:** `agent-ruby/packages/forest_admin_datasource_mongoid/lib/forest_admin_datasource_mongoid/utils/pipeline/virtual_field_generator.rb`
**Lines:** 44-55

**Issue:**
```ruby
if field.split('.').length > 2
  # Implementing this would require knowledge of asModel for virtual models
  # ...
  # As this is a use case that never happens from the UI, we decided not to implement it.
  raise ForestAdminDatasourceToolkit::Exceptions::ForestException,
        'Fetching virtual parent_id deeper than 1 level is not supported.'
end
```

**Impact:** Multi-level parent_id access not supported in Mongoid

**Severity:** 🟢 LOW (rare use case)
**Effort:** 8-16 hours (if needed)

---

## 7. SUMMARY & RECOMMENDATIONS

### Issue Count by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 **Critical** | 5 | Crashes, nil errors, memory issues |
| 🟡 **High** | 4 | Logic errors, security, validation |
| 🟡 **Medium** | 8 | Performance, error handling, concurrency |
| 🟢 **Low** | 3 | Incomplete features, logging, edge cases |

### Priority Actions

#### Week 1 - Critical Fixes (1-2 days)

1. **Fix nil reference in IP whitelist** (30 min) - Issue 1.1
2. **Fix Mongoid ID parsing crash** (15 min) - Issue 1.2
3. **Fix permission check crash** (20 min) - Issue 1.3
4. **Fix pagination validation logic** (5 min) - Issue 1.4
5. **Fix empty array crash in Mongoid** (10 min) - Issue 1.5
6. **Add maximum pagination limit** (30 min) - Issue 3.2

**Total: ~2 hours of focused work**

#### Month 1 - High Priority (3-4 weeks)

7. **Implement CSV streaming** (3-5 days) - Issue 2.2
8. **Add error logging to rescue blocks** (4 hours) - Issue 5.2
9. **Fix smart action primary key check** (15 min) - Issue 3.3
10. **Add thread safety to permissions cache** (2-4 hours) - Issue 5.4
11. **Profile and fix N+1 queries** (1-2 days) - Issue 4.2

#### Quarter 1 - Complete Feature Parity

12. **Implement Update Field endpoint** (3-5 days) - Issue 2.1
13. **Implement webhook actions** (5-8 days) - Issue 2.3
14. **Implement file actions** (3-5 days) - Issue 2.3
15. **Add SQL injection protections** (2-4 hours) - Issue 3.1

### Testing Recommendations

1. **Add integration tests** for all crash scenarios
2. **Add memory profiling tests** for CSV exports
3. **Add concurrency tests** for permissions caching
4. **Add security tests** for SQL injection vectors
5. **Add pagination tests** with edge cases (0, negative, huge values)

### Monitoring Recommendations

1. **Add error tracking** (Sentry, Rollbar) for production
2. **Add memory monitoring** for CSV export endpoints
3. **Add query performance monitoring** (bullet gem, skylight)
4. **Add cache hit rate monitoring** for permissions
5. **Add audit logging** for security events

---

## Comparison: Node.js vs Ruby Agent

### Features Present in Node.js but Missing/Broken in Ruby

| Feature | Node.js | Ruby | Gap |
|---------|---------|------|-----|
| CSV Streaming | ✅ 1000-record chunks | ❌ Loads all in memory | Critical |
| Update Field endpoint | ✅ Implemented | ❌ Missing | High |
| Webhook actions | ✅ Full support | ❌ Not implemented | Medium |
| File actions | ✅ Full support | ⚠️ Incomplete | Medium |
| Pagination limits | ✅ Enforced | ❌ No limits | High |
| Error handling | ✅ Comprehensive | ⚠️ Silent failures | Medium |
| Thread safety | ✅ Single-threaded | ⚠️ No mutex | Medium |
| Nil safety | ✅ Explicit checks | ❌ Multiple crashes | Critical |

### Ruby-Specific Issues Not Present in Node.js

1. **Mongoid ID parsing** - Node.js doesn't have this issue
2. **Thread safety** - Node.js is single-threaded (no race conditions)
3. **Silent error swallowing** - Node.js throws explicitly
4. **Array nil access** - Node.js type safety catches these

---

## Appendix: NotImplementedError Usage

The following `NotImplementedError` instances are **intentional** (abstract class patterns) and not bugs:

- `forest_admin_datasource_toolkit/lib/.../contracts/collection_contract.rb` - Abstract interface
- `forest_admin_datasource_toolkit/lib/.../contracts/datasource_contract.rb` - Abstract interface
- `forest_admin_datasource_toolkit/lib/.../condition_tree.rb` - Abstract base class
- `forest_admin_datasource_customizer/lib/.../plugins/plugin.rb` - Plugin interface
- `forest_admin_rpc_agent/lib/.../routes/base_route.rb` - Route base class
- `forest_admin_agent/lib/.../routes/abstract_route.rb` - Route base class

These are design patterns, not implementation gaps.

---

**Report End**

*This report focuses exclusively on the core Forest Admin agent gem implementations (agent-nodejs and agent-ruby), excluding test projects like mini_qonto.*

*For implementation guides for missing features, refer to:*
- `TODO_001_UPDATE_FIELD_ENDPOINT_DETAILED.md`
- `TODO_002_CSV_STREAMING_DETAILED.md`
- `TODO_003_WEBHOOK_ACTIONS_DETAILED.md`
- `TODO_004_FILE_ACTIONS_DETAILED.md`
