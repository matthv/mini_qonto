# TODO 011: Fix SQL Injection Risk in Date Truncation

**Priority:** P1 - MEDIUM (Security)
**Estimated Effort:** 2-4 hours
**Impact:** Potential SQL injection if upstream validation bypassed

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Security Issue Description](#security-issue-description)
3. [Root Cause Analysis](#root-cause-analysis)
4. [Impact Assessment](#impact-assessment)
5. [Fix Implementation](#fix-implementation)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Considerations](#deployment-considerations)
8. [Related Issues](#related-issues)

---

## Executive Summary

The `date_trunc_sql` method in the ActiveRecord datasource uses string interpolation to build SQL queries, creating a potential SQL injection vulnerability if upstream validation fails or is bypassed. While the current implementation likely receives safe input from aggregation objects, defensive programming requires explicit validation.

### The Problem

```ruby
def date_trunc_sql(operation, field)
  case adapter_name
  when 'postgresql'
    "DATE_TRUNC('#{operation}', #{field})"  # ❌ Direct string interpolation
  end
end
```

**Risk:** If `operation` contains malicious SQL, it will be executed directly.

### The Solution

Add explicit whitelist validation:

```ruby
def date_trunc_sql(operation, field)
  # Whitelist allowed operations
  valid_operations = %w[second minute hour day week month quarter year]
  unless valid_operations.include?(operation.downcase)
    raise ArgumentError, "Invalid date operation: #{operation}"
  end

  # Safe to interpolate after validation
  case adapter_name
  when 'postgresql'
    "DATE_TRUNC('#{operation}', #{field})"
  end
end
```

**Time to Fix:** 2-4 hours (includes testing all adapters)
**Risk:** Low - Pure defensive improvement

---

## Security Issue Description

### Location

**File:** `agent-ruby/packages/forest_admin_datasource_active_record/lib/forest_admin_datasource_active_record/utils/query_aggregate.rb`
**Lines:** 61-74

### Current Code

```ruby
def date_trunc_sql(operation, field)
  adapter_name = @collection.model.connection.adapter_name.downcase
  operation = operation.downcase

  case adapter_name
  when 'postgresql'
    "DATE_TRUNC('#{operation}', #{field})"
  when 'mysql', 'mysql2'
    case operation
    when 'year'
      "YEAR(#{field})"
    when 'month'
      "DATE_FORMAT(#{field}, '%Y-%m')"
    when 'day'
      "DATE(#{field})"
    when 'week'
      "YEARWEEK(#{field}, 3)"
    end
  when 'sqlite', 'sqlite3'
    case operation
    when 'year'
      "strftime('%Y', #{field})"
    when 'month'
      "strftime('%Y-%m', #{field})"
    when 'day'
      "date(#{field})"
    when 'week'
      "strftime('%Y-%W', #{field})"
    end
  else
    raise "Unsupported database adapter: #{adapter_name}"
  end
end
```

### Attack Scenarios

#### Scenario 1: SQL Injection via Operation Parameter

```ruby
# Hypothetical malicious input
operation = "day'); DROP TABLE users; --"

# Generated SQL (PostgreSQL):
"DATE_TRUNC('day'); DROP TABLE users; --', created_at)"

# Executed as:
# 1. DATE_TRUNC('day')
# 2. DROP TABLE users
# 3. -- rest is commented out
```

#### Scenario 2: Data Exfiltration

```ruby
operation = "day') UNION SELECT password FROM users WHERE ('1'='1"

# Generated SQL:
"DATE_TRUNC('day') UNION SELECT password FROM users WHERE ('1'='1', created_at)"

# Could leak sensitive data through chart results
```

#### Scenario 3: Bypass via Field Parameter

```ruby
field = "created_at); DROP TABLE sessions; --"

# Generated SQL:
"DATE_TRUNC('day', created_at); DROP TABLE sessions; --)"
```

### Current Protection Layers

**What DOES Protect:**
1. **Aggregation Object Validation:** `operation` comes from `Aggregation` objects with predefined values
2. **ActiveRecord Escaping:** Field names are validated by schema
3. **ORM Layer:** Most queries go through ActiveRecord which escapes values

**What DOES NOT Protect:**
1. **No Explicit Whitelist:** Function doesn't validate `operation` parameter
2. **Direct String Interpolation:** Bypasses ORM safety
3. **No Input Sanitization:** Assumes all input is safe
4. **Multiple Code Paths:** Different adapters have different risk profiles

### Current Risk Level

**Likelihood:** LOW (requires bypassing upstream validation)
**Impact:** HIGH (arbitrary SQL execution)
**Overall Risk:** MEDIUM

**Mitigating Factors:**
- Operation comes from controlled `Aggregation` objects
- Not directly exposed to user input
- Would require vulnerability in aggregation builder

**Risk Factors:**
- String interpolation bypasses ORM safety
- Multiple database adapters to secure
- Future code changes could introduce vulnerabilities
- Custom aggregations might bypass validation

---

## Root Cause Analysis

### Why This Exists

1. **Performance Optimization:** String building faster than query builder
2. **Adapter Differences:** Each database has different date functions
3. **Legacy Code:** Likely predates security awareness
4. **Assumed Safety:** Trusts upstream validation

### Defense in Depth Principle

Security should have multiple layers:

```
Layer 1: Input Validation      ✅ Aggregation objects (exists)
Layer 2: Function Validation   ❌ date_trunc_sql (MISSING)
Layer 3: ORM Escaping          ⚠️  Bypassed by string building
Layer 4: Database Permissions  ✅ Database user permissions (exists)
```

**Problem:** Layer 2 is missing, and Layer 3 is bypassed.

### SQL Injection Types

**Classic SQL Injection:**
```sql
-- User input: ' OR '1'='1
SELECT * FROM users WHERE name = '' OR '1'='1'
```

**String Interpolation Injection:**
```ruby
# User input: '; DROP TABLE users; --
sql = "SELECT * FROM #{table}"
# Results in: SELECT * FROM users; DROP TABLE users; --
```

**Function Injection (This Issue):**
```ruby
# Malicious operation: day'); DROP TABLE users; --
sql = "DATE_TRUNC('#{operation}', created_at)"
# Results in: DATE_TRUNC('day'); DROP TABLE users; --', created_at)
```

---

## Impact Assessment

### Severity: 🟡 MEDIUM

### What Could Break

1. **Data Integrity**
   - Arbitrary SQL could modify/delete data
   - `DROP TABLE`, `UPDATE`, `DELETE` statements
   - Schema modifications

2. **Data Confidentiality**
   - `UNION SELECT` could leak sensitive data
   - Password hashes, PII, financial data
   - Chart results could contain leaked data

3. **Service Availability**
   - `DROP` statements crash application
   - Expensive queries cause DoS
   - Lock tables causing deadlocks

4. **Privilege Escalation**
   - Could modify admin accounts
   - Change permissions
   - Create backdoor accounts

### Attack Vectors

| Vector | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Via chart API | Low | High | Aggregation validation |
| Via custom aggregation | Medium | High | None (main risk) |
| Via code injection | Very Low | Critical | Code review |
| Via dependency exploit | Very Low | Critical | Dependency scanning |

### Real-World Scenario

```
Attacker: Discovers custom aggregation endpoint
Action: Sends chart request with malicious aggregation
Payload: { operation: "day'); SELECT pg_sleep(10); --" }
Result: Application hangs for 10 seconds (DoS)

Next: Attacker iterates to find working SQL injection
Payload: { operation: "day') UNION SELECT email, password FROM users; --" }
Result: Chart data leaks user credentials
```

---

## Fix Implementation

### Solution 1: Whitelist Validation (Recommended)

```ruby
def date_trunc_sql(operation, field)
  # Whitelist of valid operations
  VALID_DATE_OPERATIONS = %w[
    second
    minute
    hour
    day
    week
    month
    quarter
    year
  ].freeze

  adapter_name = @collection.model.connection.adapter_name.downcase
  operation = operation.to_s.downcase

  # Validate operation is in whitelist
  unless VALID_DATE_OPERATIONS.include?(operation)
    raise ForestAdminDatasourceToolkit::Exceptions::ValidationError,
          "Invalid date truncation operation: #{operation}. " \
          "Allowed values: #{VALID_DATE_OPERATIONS.join(', ')}"
  end

  # Validate field name (additional safety)
  unless field.match?(/\A[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*\z/)
    raise ForestAdminDatasourceToolkit::Exceptions::ValidationError,
          "Invalid field name: #{field}"
  end

  # Now safe to build SQL
  case adapter_name
  when 'postgresql'
    "DATE_TRUNC('#{operation}', #{field})"
  when 'mysql', 'mysql2'
    case operation
    when 'year'
      "YEAR(#{field})"
    when 'month'
      "DATE_FORMAT(#{field}, '%Y-%m')"
    when 'day'
      "DATE(#{field})"
    when 'week'
      "YEARWEEK(#{field}, 3)"
    when 'hour', 'minute', 'second'
      # MySQL doesn't support these, fall back to day
      "DATE(#{field})"
    else
      raise "Unsupported operation #{operation} for MySQL"
    end
  when 'sqlite', 'sqlite3'
    case operation
    when 'year'
      "strftime('%Y', #{field})"
    when 'month'
      "strftime('%Y-%m', #{field})"
    when 'day'
      "date(#{field})"
    when 'week'
      "strftime('%Y-%W', #{field})"
    when 'hour'
      "strftime('%Y-%m-%d %H:00:00', #{field})"
    when 'minute'
      "strftime('%Y-%m-%d %H:%M:00', #{field})"
    when 'second'
      "datetime(#{field})"
    else
      raise "Unsupported operation #{operation} for SQLite"
    end
  else
    raise ForestAdminDatasourceToolkit::Exceptions::ValidationError,
          "Unsupported database adapter: #{adapter_name}"
  end
end
```

**Benefits:**
- Explicit whitelist prevents all injection
- Clear error messages
- Field name validation adds extra layer
- Handles missing operations per adapter

---

### Solution 2: Use Arel (Best Practice)

```ruby
def date_trunc_sql(operation, field_name)
  # Whitelist validation
  VALID_DATE_OPERATIONS = %w[second minute hour day week month quarter year].freeze
  unless VALID_DATE_OPERATIONS.include?(operation.to_s.downcase)
    raise ValidationError, "Invalid operation: #{operation}"
  end

  adapter_name = @collection.model.connection.adapter_name.downcase
  field = Arel::Table.new(@collection.name)[field_name.to_sym]

  case adapter_name
  when 'postgresql'
    # Use Arel::Nodes::NamedFunction for safety
    Arel::Nodes::NamedFunction.new(
      'DATE_TRUNC',
      [Arel::Nodes.build_quoted(operation), field]
    )
  when 'mysql', 'mysql2'
    case operation.downcase
    when 'year'
      Arel::Nodes::NamedFunction.new('YEAR', [field])
    when 'month'
      Arel::Nodes::NamedFunction.new('DATE_FORMAT', [field, Arel::Nodes.build_quoted('%Y-%m')])
    # ... other cases
    end
  # ... other adapters
  end
end
```

**Benefits:**
- Uses ORM's built-in escaping
- Type-safe
- Database-agnostic
- Best practice for query building

**Drawbacks:**
- More complex code
- Requires Arel knowledge
- May have performance overhead

---

### Solution 3: Parameterized Queries

```ruby
def date_trunc_sql(operation, field)
  VALID_DATE_OPERATIONS = %w[second minute hour day week month quarter year].freeze
  unless VALID_DATE_OPERATIONS.include?(operation.to_s.downcase)
    raise ValidationError, "Invalid operation: #{operation}"
  end

  # Use prepared statement placeholders
  case adapter_name
  when 'postgresql'
    @collection.model.connection.quote_string("DATE_TRUNC(?, ?)")
  # Bind parameters separately
  end
end
```

**Benefits:**
- True parameterization
- Database handles escaping

**Drawbacks:**
- Complex to implement for all adapters
- May not be possible with string-building approach

---

**Recommendation:** Use **Solution 1** (Whitelist) for quick fix, migrate to **Solution 2** (Arel) long-term.

---

## Testing Strategy

### Unit Tests

```ruby
RSpec.describe ForestAdminDatasourceActiveRecord::Utils::QueryAggregate do
  describe '#date_trunc_sql' do
    let(:collection) { create_test_collection }
    let(:aggregate) { described_class.new(collection) }

    context 'with valid operations' do
      %w[second minute hour day week month quarter year].each do |operation|
        it "accepts #{operation} operation" do
          expect do
            aggregate.send(:date_trunc_sql, operation, 'created_at')
          end.not_to raise_error
        end
      end
    end

    context 'with invalid operations' do
      it 'rejects SQL injection in operation' do
        malicious_op = "day'); DROP TABLE users; --"

        expect do
          aggregate.send(:date_trunc_sql, malicious_op, 'created_at')
        end.to raise_error(
          ForestAdminDatasourceToolkit::Exceptions::ValidationError,
          /Invalid date truncation operation/
        )
      end

      it 'rejects UNION SELECT injection' do
        malicious_op = "day') UNION SELECT password FROM users; --"

        expect do
          aggregate.send(:date_trunc_sql, malicious_op, 'created_at')
        end.to raise_error(ValidationError)
      end

      it 'rejects arbitrary SQL keywords' do
        %w[DROP DELETE UPDATE INSERT].each do |keyword|
          expect do
            aggregate.send(:date_trunc_sql, keyword, 'created_at')
          end.to raise_error(ValidationError)
        end
      end
    end

    context 'with invalid field names' do
      it 'rejects SQL injection in field' do
        malicious_field = "created_at); DROP TABLE users; --"

        expect do
          aggregate.send(:date_trunc_sql, 'day', malicious_field)
        end.to raise_error(ValidationError, /Invalid field name/)
      end

      it 'rejects fields with semicolons' do
        expect do
          aggregate.send(:date_trunc_sql, 'day', 'field; DELETE FROM users')
        end.to raise_error(ValidationError)
      end
    end

    context 'per database adapter' do
      it 'generates correct PostgreSQL syntax' do
        allow(collection.model.connection).to receive(:adapter_name).and_return('PostgreSQL')

        sql = aggregate.send(:date_trunc_sql, 'day', 'created_at')
        expect(sql).to eq("DATE_TRUNC('day', created_at)")
      end

      it 'generates correct MySQL syntax' do
        allow(collection.model.connection).to receive(:adapter_name).and_return('MySQL')

        sql = aggregate.send(:date_trunc_sql, 'month', 'created_at')
        expect(sql).to eq("DATE_FORMAT(created_at, '%Y-%m')")
      end

      it 'generates correct SQLite syntax' do
        allow(collection.model.connection).to receive(:adapter_name).and_return('SQLite')

        sql = aggregate.send(:date_trunc_sql, 'year', 'created_at')
        expect(sql).to eq("strftime('%Y', created_at)")
      end
    end
  end
end
```

### Security Tests

```ruby
RSpec.describe 'SQL Injection Prevention in Aggregations', type: :security do
  let(:user_token) { generate_test_token }

  describe 'chart endpoints' do
    it 'blocks SQL injection via date truncation' do
      # Attempt SQL injection through chart request
      post '/forest/_charts/transactions',
           params: {
             type: 'Line',
             groupByDateField: 'created_at',
             aggregateOperation: "day'); DROP TABLE users; --"
           },
           headers: { 'Authorization' => "Bearer #{user_token}" }

      expect(response).to have_http_status(:bad_request)
      expect(json_response['errors'][0]['detail']).to match(/Invalid.*operation/)

      # Verify users table still exists
      expect(User.count).to be > 0
    end

    it 'blocks data exfiltration via UNION' do
      post '/forest/_charts/transactions',
           params: {
             type: 'Line',
             groupByDateField: 'created_at',
             aggregateOperation: "day') UNION SELECT password FROM users WHERE ('1'='1"
           },
           headers: { 'Authorization' => "Bearer #{user_token}" }

      expect(response).to have_http_status(:bad_request)

      # Verify response doesn't contain password data
      expect(response.body).not_to include('$2a$')  # bcrypt prefix
    end
  end
end
```

### Manual Testing Checklist

- [ ] Test each valid operation (second, minute, hour, day, week, month, quarter, year)
- [ ] Test with PostgreSQL adapter
- [ ] Test with MySQL adapter
- [ ] Test with SQLite adapter
- [ ] Test SQL injection payloads in operation parameter
- [ ] Test SQL injection payloads in field parameter
- [ ] Test with DROP TABLE attempts
- [ ] Test with UNION SELECT attempts
- [ ] Test with UPDATE/DELETE attempts
- [ ] Test with timing attacks (pg_sleep, BENCHMARK)
- [ ] Test with invalid characters (semicolons, quotes, backslashes)
- [ ] Test case sensitivity (DAY vs day vs DaY)
- [ ] Verify error messages don't leak sensitive info
- [ ] Test performance impact of validation

---

## Deployment Considerations

### Pre-Deployment

1. **Security Audit**
   - Review all string interpolation in SQL
   - Check other potential injection points
   - Document security improvements

2. **Performance Baseline**
   - Measure current chart generation time
   - Establish baseline for comparison
   - Validation should add <1ms overhead

3. **Communication**
   - Notify security team
   - Document in security changelog
   - No user-facing changes

### Deployment Strategy

**Standard Release** (not emergency)

- Include in next regular release
- No feature flag needed (pure security fix)
- Zero risk to functionality

**Timeline:**
- Development: 2 hours
- Testing: 1 hour
- Security review: 1 hour
- Deploy: Standard process
- **Total: 4 hours**

### Post-Deployment

1. **Monitor Error Logs**
   - Watch for validation errors
   - Indicates potential attack attempts or bugs
   - Should be rare (or never) in normal operation

2. **Security Monitoring**
   - Track validation error frequency
   - Alert on suspicious patterns
   - Log for audit trail

3. **Performance Monitoring**
   - Verify no performance degradation
   - Chart generation time unchanged
   - Query performance unchanged

---

## Related Issues

### Similar SQL Injection Risks

1. **Custom Query Building**
   - Search for all string interpolation in SQL
   - Review `sanitize_sql_array` usage
   - Check `where()` with string arguments

2. **Dynamic Table Names**
   ```ruby
   # If this pattern exists anywhere:
   "SELECT * FROM #{table_name}"
   ```

3. **Dynamic Column Names**
   ```ruby
   # If this pattern exists:
   "ORDER BY #{column_name}"
   ```

### Security Best Practices

1. **Use ORM Query Builders**
   ```ruby
   # Good: ORM handles escaping
   User.where(name: user_input)

   # Bad: Manual string building
   User.where("name = '#{user_input}'")
   ```

2. **Parameterize All Queries**
   ```ruby
   # Good: Parameterized
   User.where("age > ?", age_input)

   # Bad: Interpolation
   User.where("age > #{age_input}")
   ```

3. **Whitelist Input**
   ```ruby
   # Always validate against whitelist
   VALID_COLUMNS = %w[name email created_at].freeze
   unless VALID_COLUMNS.include?(sort_column)
     raise "Invalid column"
   end
   ```

---

## Implementation Checklist

### Development Phase

- [ ] Create feature branch: `security/sql-injection-date-truncation`
- [ ] Add VALID_DATE_OPERATIONS constant
- [ ] Implement operation whitelist validation
- [ ] Implement field name validation
- [ ] Add clear error messages
- [ ] Test with all database adapters

### Testing Phase

- [ ] Write unit tests for valid operations
- [ ] Write unit tests for injection attempts
- [ ] Write security tests for real attack vectors
- [ ] Test with PostgreSQL
- [ ] Test with MySQL
- [ ] Test with SQLite
- [ ] Verify error messages
- [ ] Performance testing

### Security Review Phase

- [ ] Code review by security team
- [ ] Penetration testing
- [ ] Verify fix prevents known attack vectors
- [ ] Check for similar issues elsewhere
- [ ] Document security improvement

### Deployment Phase

- [ ] Merge to main branch
- [ ] Tag security release
- [ ] Deploy to staging
- [ ] Security testing in staging
- [ ] Deploy to production
- [ ] Monitor for 48 hours

### Documentation Phase

- [ ] Update SECURITY.md
- [ ] Add to security changelog
- [ ] Document in code comments
- [ ] Create security advisory if needed

---

## Success Criteria

### Security

- ✅ All SQL injection attempts blocked
- ✅ Whitelist validation enforced
- ✅ Field name validation added
- ✅ Clear error messages (no info leakage)
- ✅ Works across all database adapters

### Functional

- ✅ All valid operations work
- ✅ Charts still generate correctly
- ✅ No breaking changes
- ✅ Performance unchanged (<1ms overhead)

### Process

- ✅ Security team review passed
- ✅ Penetration testing passed
- ✅ Test coverage >95%
- ✅ Deployed without issues

---

## Appendix: SQL Injection Cheat Sheet

### Common Payloads

```sql
-- Terminate statement and inject
'); DROP TABLE users; --

-- Union-based data exfiltration
' UNION SELECT password FROM users WHERE '1'='1

-- Timing attack
' OR SLEEP(5)--
' OR pg_sleep(5)--

-- Boolean-based blind injection
' OR '1'='1
' OR '1'='2

-- Error-based injection
' OR 1=convert(int,(SELECT @@version))--

-- Stacked queries
'; DELETE FROM users WHERE '1'='1

-- Comment injection
admin'--
admin'#
admin'/*
```

### Defense Checklist

- ✅ Never use string interpolation for SQL
- ✅ Always use parameterized queries
- ✅ Whitelist all user-controlled values
- ✅ Validate data types
- ✅ Use ORM query builders
- ✅ Escape special characters
- ✅ Limit database permissions
- ✅ Log and monitor suspicious queries

---

**TODO End**

*Priority: P1 - Medium (Security hardening)*
*Estimated Time: 2-4 hours including testing*
*Risk: Low - Pure defensive improvement*
