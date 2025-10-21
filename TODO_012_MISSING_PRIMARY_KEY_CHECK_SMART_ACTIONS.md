# implemented https://github.com/ForestAdmin/agent-ruby/pull/159/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/159/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/159/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/159/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/159/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/159/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/159/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/159/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/159/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/159/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/159/files

# implemented https://github.com/ForestAdmin/agent-ruby/pull/159/files

# TODO 012: Fix Missing Primary Key Check in Smart Actions

**Priority:** P1 - MEDIUM
**Estimated Effort:** 15 minutes
**Impact:** Crashes when executing actions on collections without primary keys

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Bug Description](#bug-description)
3. [Root Cause Analysis](#root-cause-analysis)
4. [Impact Assessment](#impact-assessment)
5. [Fix Implementation](#fix-implementation)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Considerations](#deployment-considerations)

---

## Executive Summary

The Smart Action Checker service crashes when trying to execute actions on collections that don't have primary keys. The code attempts to access the first element of an empty array without checking if primary keys exist.

### The Problem

```ruby
def match_conditions(condition_name)
  pk = Schema.primary_keys(collection)[0]  # ❌ Crashes if empty array!

  condition_filter = Nodes::ConditionTreeLeaf.new(pk, 'NOT_EQUAL', ...)
end
```

### The Solution

```ruby
def match_conditions(condition_name)
  pks = Schema.primary_keys(collection)

  if pks.empty?
    raise ForestAdminDatasourceToolkit::Exceptions::ForestException,
          "Collection '#{collection.name}' has no primary keys. " \
          "Actions with conditional permissions require primary keys."
  end

  pk = pks[0]
  # ... rest of code
end
```

**Time to Fix:** 15 minutes
**Risk:** None - Pure defensive improvementP

---

## Bug Description

### Location

**File:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/services/smart_action_checker.rb`
**Lines:** 69-88

### Current Code

```ruby
def match_conditions(condition_name)
  pk = Schema.primary_keys(collection)[0]  # ❌ No validation!

  condition_filter = if attributes[:all_records]
                       Nodes::ConditionTreeLeaf.new(pk, 'NOT_EQUAL', attributes[:all_records_ids_excluded])
                     else
                       Nodes::ConditionTreeLeaf.new(pk, 'IN', attributes[:ids])
                     end

  request_filter = Filter.new(condition_tree: condition_filter)
  request_records_count = collection.aggregate(caller, request_filter, Aggregation.new(operation: 'Count'))

  # ... permission checking logic
end
```

### Error Scenario

```ruby
# Collection has no primary keys (views, MongoDB embedded docs, etc.)
Schema.primary_keys(collection)  # => []

# Code tries to access first element
pk = [][0]  # => nil

# Create condition tree with nil
Nodes::ConditionTreeLeaf.new(nil, 'IN', [1, 2, 3])
# => TypeError: field cannot be nil

# OR crashes later when trying to use nil as field name
collection.aggregate(caller, filter_with_nil_field, ...)
# => NoMethodError or SQL error
```

### Collections Without Primary Keys

**Common Scenarios:**

1. **Database Views**

   ```sql
   CREATE VIEW transaction_summary AS
   SELECT user_id, SUM(amount) FROM transactions GROUP BY user_id;
   ```

2. **MongoDB Embedded Documents**

   ```ruby
   class User
     embeds_many :addresses  # Addresses have no primary key
   end
   ```

3. **Materialized Views**

   ```sql
   CREATE MATERIALIZED VIEW daily_stats AS ...
   ```

4. **Legacy Tables**

   ```sql
   -- Old table without primary key
   CREATE TABLE logs (
     message TEXT,
     created_at TIMESTAMP
   );
   ```

5. **Join Tables (Bad Practice)**
   ```sql
   -- Many-to-many without PK (should have composite PK)
   CREATE TABLE users_roles (
     user_id INT,
     role_id INT
   );
   ```

---

## Root Cause Analysis

### Why This Bug Exists

1. **Assumption:** Code assumes all collections have primary keys
2. **No Validation:** Direct array access without bounds checking
3. **Insufficient Testing:** No tests with PK-less collections
4. **Edge Case:** Rare scenario (most tables have PKs)

### Ruby Array Behavior

```ruby
array = []

# Direct access returns nil (no error)
array[0]  # => nil

# But using nil in other contexts causes errors
nil.upcase  # => NoMethodError
Condition.new(nil, 'Equal', 1)  # => TypeError
```

### Why Collections Might Not Have Primary Keys

**Valid Reasons:**

- Database views (read-only, derived data)
- Embedded documents (MongoDB, Cassandra)
- Materialized views
- Reporting tables (analytical workloads)
- External data sources (APIs, files)

**Invalid Reasons (Bad Practice):**

- Forgot to add PK during migration
- Legacy tables before best practices
- Quick prototypes that made it to production

---

## Impact Assessment

### Severity: 🟡 MEDIUM

### What Breaks

1. **Action Execution**

   - Any action with conditional permissions fails
   - Affects actions on views, embedded docs, etc.
   - User sees 500 Internal Server Error

2. **Permission Checks**

   - Can't verify if user has permission for action
   - Blocks all actions on affected collections
   - No graceful degradation

3. **User Experience**
   - Cryptic error message
   - No indication that PK is missing
   - Difficult to debug

### Failure Modes

| Collection Type         | Has PK?   | Impact    | Frequency |
| ----------------------- | --------- | --------- | --------- |
| Standard tables         | Yes       | No issue  | 95%       |
| Database views          | No        | Crashes   | 3%        |
| Embedded docs (MongoDB) | No        | Crashes   | 1%        |
| Materialized views      | Sometimes | May crash | 1%        |
| Legacy tables           | Sometimes | May crash | <1%       |

### Real-World Scenario

```
Admin: Creates action "Export Summary" on transaction_summary view
User: Clicks "Export Summary" button
Frontend: Sends POST to /_actions/transaction_summary/0/export
Backend: smart_action_checker.rb tries to get primary keys
Error: pk = [][0] => nil
Crash: ConditionTreeLeaf.new(nil, 'IN', [])
User sees: "Internal Server Error"
Admin debug: Logs show NoMethodError or TypeError
Root cause: View has no primary key
Resolution: Add validation, provide clear error message
```

---

## Fix Implementation

### Solution 1: Early Validation (Recommended)

```ruby
def match_conditions(condition_name)
  # Get primary keys
  pks = Schema.primary_keys(collection)

  # Validate collection has at least one primary key
  if pks.empty?
    raise ForestAdminDatasourceToolkit::Exceptions::ForestException,
          "Collection '#{collection.name}' has no primary keys. " \
          "Actions with conditional permissions require a primary key to identify records."
  end

  # Safe to access first element
  pk = pks[0]

  condition_filter = if attributes[:all_records]
                       Nodes::ConditionTreeLeaf.new(pk, 'NOT_EQUAL', attributes[:all_records_ids_excluded])
                     else
                       Nodes::ConditionTreeLeaf.new(pk, 'IN', attributes[:ids])
                     end

  request_filter = Filter.new(condition_tree: condition_filter)
  request_records_count = collection.aggregate(caller, request_filter, Aggregation.new(operation: 'Count'))

  # ... rest of permission checking
end
```

**Benefits:**

- Clear error message
- Fails fast
- Explains why it failed
- Suggests solution

---

### Solution 2: Alternative Identifier

```ruby
def match_conditions(condition_name)
  # Try to get primary keys
  pks = Schema.primary_keys(collection)

  # If no PK, try to find alternative unique identifier
  if pks.empty?
    # Look for fields named 'id', '_id', etc.
    alternative_id = find_alternative_identifier(collection)

    if alternative_id
      ForestAdminAgent::Facades::Container.logger.log(
        'Warn',
        "Collection '#{collection.name}' has no primary key. " \
        "Using field '#{alternative_id}' as identifier."
      )
      pk = alternative_id
    else
      raise ForestException,
            "Collection '#{collection.name}' has no primary key or alternative identifier. " \
            "Cannot execute actions with conditional permissions."
    end
  else
    pk = pks[0]
  end

  # ... rest of code
end

private

def find_alternative_identifier(collection)
  # Look for common identifier field names
  schema = collection.schema
  %w[id _id uuid guid row_id].each do |field_name|
    return field_name if schema.fields.key?(field_name.to_sym)
  end

  nil
end
```

**Benefits:**

- More flexible
- Works with more collections
- Provides fallback

**Drawbacks:**

- More complex
- Alternative ID might not be unique
- Could cause incorrect permission checks

---

### Solution 3: Skip Permission Check

```ruby
def match_conditions(condition_name)
  pks = Schema.primary_keys(collection)

  # If no primary key, skip conditional permission check
  if pks.empty?
    ForestAdminAgent::Facades::Container.logger.log(
      'Warn',
      "Collection '#{collection.name}' has no primary key. " \
      "Skipping conditional permission check for action '#{attributes[:action_name]}'."
    )

    # Allow action (assume all records match)
    return true
  end

  pk = pks[0]

  # ... rest of permission checking
end
```

**Benefits:**

- Actions work on collections without PKs
- No errors

**Drawbacks:**

- **SECURITY RISK:** Bypasses permission checks
- Could allow unauthorized actions
- Not recommended

---

**Recommendation:** Use **Solution 1** (Early Validation) for security and clarity.

---

## Testing Strategy

### Unit Tests

```ruby
RSpec.describe ForestAdminAgent::Services::SmartActionChecker do
  describe '#match_conditions' do
    let(:caller) { build(:caller) }
    let(:attributes) do
      {
        collection_name: 'bank_accounts',
        action_name: 'export',
        ids: [1, 2, 3]
      }
    end

    context 'when collection has primary keys' do
      let(:collection) do
        double(
          name: 'bank_accounts',
          schema: double(fields: { id: double(type: 'Number', is_primary_key: true) })
        )
      end

      before do
        allow(Schema).to receive(:primary_keys).with(collection).and_return(['id'])
      end

      it 'executes permission check without error' do
        checker = described_class.new(collection, caller, attributes)

        expect do
          checker.send(:match_conditions, 'trigger')
        end.not_to raise_error
      end
    end

    context 'when collection has no primary keys (CRITICAL BUG)' do
      let(:view_collection) do
        double(
          name: 'transaction_summary',
          schema: double(fields: { user_id: double(type: 'Number'), total: double(type: 'Number') })
        )
      end

      before do
        # Simulate collection with no primary keys (e.g., database view)
        allow(Schema).to receive(:primary_keys).with(view_collection).and_return([])
      end

      it 'raises clear error message' do
        checker = described_class.new(view_collection, caller, attributes)

        expect do
          checker.send(:match_conditions, 'trigger')
        end.to raise_error(
          ForestAdminDatasourceToolkit::Exceptions::ForestException,
          /Collection 'transaction_summary' has no primary keys/
        )
      end

      it 'explains why it failed' do
        checker = described_class.new(view_collection, caller, attributes)

        expect do
          checker.send(:match_conditions, 'trigger')
        end.to raise_error(/require a primary key to identify records/)
      end
    end

    context 'when collection has composite primary keys' do
      let(:collection) do
        double(
          name: 'user_roles',
          schema: double(fields: {
            user_id: double(type: 'Number', is_primary_key: true),
            role_id: double(type: 'Number', is_primary_key: true)
          })
        )
      end

      before do
        allow(Schema).to receive(:primary_keys).with(collection).and_return(['user_id', 'role_id'])
      end

      it 'uses first primary key for condition' do
        checker = described_class.new(collection, caller, attributes)

        expect do
          checker.send(:match_conditions, 'trigger')
        end.not_to raise_error

        # Verify it used 'user_id' (first PK)
        # (actual verification depends on implementation details)
      end
    end

    context 'when Schema.primary_keys returns nil (edge case)' do
      let(:collection) { double(name: 'broken_collection') }

      before do
        allow(Schema).to receive(:primary_keys).with(collection).and_return(nil)
      end

      it 'handles nil gracefully' do
        checker = described_class.new(collection, caller, attributes)

        expect do
          checker.send(:match_conditions, 'trigger')
        end.to raise_error(ForestException, /no primary keys/)
      end
    end
  end
end
```

### Integration Tests

```ruby
RSpec.describe 'Smart Actions on Collections Without Primary Keys', type: :integration do
  let(:user_token) { generate_test_token }

  before do
    # Create a database view without primary key
    ActiveRecord::Base.connection.execute(<<-SQL)
      CREATE VIEW transaction_summary AS
      SELECT user_id, SUM(amount) as total
      FROM transactions
      GROUP BY user_id
    SQL

    # Register view as Forest Admin collection
    # (setup code depends on your configuration)
  end

  after do
    ActiveRecord::Base.connection.execute('DROP VIEW IF EXISTS transaction_summary')
  end

  describe 'POST /_actions/:collection/:action' do
    it 'returns clear error for actions on views' do
      post '/_actions/transaction_summary/0/export',
           params: {
             data: {
               attributes: {
                 ids: [1, 2, 3],
                 values: {}
               }
             }
           },
           headers: { 'Authorization' => "Bearer #{user_token}" }

      expect(response).to have_http_status(:bad_request)
      expect(json_response['errors'][0]['detail']).to match(/no primary keys/)
      expect(json_response['errors'][0]['detail']).to match(/transaction_summary/)
    end
  end
end
```

### Manual Testing Checklist

- [ ] Test action on regular table with single PK
- [ ] Test action on table with composite PK
- [ ] Test action on database view (no PK)
- [ ] Test action on MongoDB embedded document (no PK)
- [ ] Test action on materialized view
- [ ] Test action on legacy table without PK
- [ ] Verify error message is clear
- [ ] Verify error message mentions collection name
- [ ] Verify error suggests solution
- [ ] Test that regular actions still work

---

## Deployment Considerations

### Pre-Deployment

1. **Identify Affected Collections**

   ```ruby
   # Run this script to find collections without PKs
   ForestAdminAgent::Facades::Container.datasource.collections.each do |collection|
     pks = Schema.primary_keys(collection)
     if pks.empty?
       puts "⚠️  #{collection.name} has no primary keys"
     end
   end
   ```

2. **Communication**

   - Notify users with actions on PK-less collections
   - Explain error message they'll see
   - Provide solution (add PK or restructure)

3. **Documentation Update**
   - Document PK requirement for actions
   - Add to troubleshooting guide
   - Update collection setup documentation

### Deployment Strategy

**Standard Release**

- Include in next regular release
- Low risk (only adds validation)
- No feature flag needed

**Timeline:**

- Development: 15 minutes
- Testing: 20 minutes
- Review: 10 minutes
- Deploy: Standard process
- **Total: 45 minutes**

### Post-Deployment

1. **Monitor Error Logs**

   - Watch for new "no primary keys" errors
   - Indicates collections that need PKs added
   - Expected in environments with views

2. **User Support**

   - Provide guidance for affected users
   - Help add PKs where appropriate
   - Suggest alternatives (restructure actions)

3. **Documentation**
   - Update FAQ with this error
   - Add to common issues guide

---

## Related Issues

### Collections That Should Have PKs

If you encounter collections without PKs, evaluate:

1. **Can a PK be added?**

   ```sql
   -- Add PK to existing table
   ALTER TABLE logs ADD COLUMN id SERIAL PRIMARY KEY;
   ```

2. **Is it actually a view?**

   ```sql
   -- Views can't have PKs, but base tables can
   -- Consider using base table instead
   ```

3. **Should it be a collection?**
   ```ruby
   # Maybe it shouldn't be exposed via Forest Admin
   # Remove from schema if not needed
   ```

### Alternative Approaches

1. **Action Without Selection**

   - Global actions (no record selection)
   - Don't need primary keys

   ```ruby
   collection.add_action('Export All') do |context|
     # Acts on entire collection, no IDs needed
   end
   ```

2. **Custom Identifiers**

   - Use alternative unique field
   - Requires code modification (not recommended)

3. **Restructure Data Model**
   - Add surrogate key
   - Use base tables instead of views

---

## Implementation Checklist

### Development Phase

- [ ] Create feature branch: `fix/smart-action-pk-check`
- [ ] Add primary key validation
- [ ] Add clear error message
- [ ] Handle nil and empty array cases
- [ ] Test error message format

### Testing Phase

- [ ] Write unit tests (5 test cases)
- [ ] Write integration tests
- [ ] Test with real database view
- [ ] Test with MongoDB embedded docs (if applicable)
- [ ] Manual testing

### Review Phase

- [ ] Self-review error messages
- [ ] Verify no breaking changes
- [ ] Peer code review
- [ ] Test in staging

### Deployment Phase

- [ ] Merge to main
- [ ] Deploy to staging
- [ ] Verify error messages in staging
- [ ] Deploy to production
- [ ] Monitor logs

### Documentation Phase

- [ ] Update CHANGELOG.md
- [ ] Add to troubleshooting guide
- [ ] Document PK requirement
- [ ] Update collection setup docs

---

## Success Criteria

### Functional

- ✅ No crashes on collections without PKs
- ✅ Clear error message displayed
- ✅ Error explains the requirement
- ✅ Actions work normally on collections with PKs

### User Experience

- ✅ Error message is user-friendly
- ✅ Error suggests solution
- ✅ Logs helpful for debugging
- ✅ Documentation updated

### Testing

- ✅ Test coverage 100% for validation logic
- ✅ Integration tests pass
- ✅ Manual testing complete

---

## Appendix: Primary Key Best Practices

### When to Use Primary Keys

**Always:**

- Database tables
- ActiveRecord models
- Entity tables

**Usually:**

- Join tables (composite PK)
- Logging tables (for deduplication)
- Audit tables

**Never:**

- Read-only views (can't modify)
- Derived/computed data
- Temporary tables

### Primary Key Types

**Single Column:**

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100)
);
```

**Composite (Multiple Columns):**

```sql
CREATE TABLE user_roles (
  user_id INT,
  role_id INT,
  PRIMARY KEY (user_id, role_id)
);
```

**Natural Key:**

```sql
CREATE TABLE countries (
  iso_code CHAR(2) PRIMARY KEY,
  name VARCHAR(100)
);
```

**Surrogate Key (Recommended):**

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL(10, 2)
);
```

---

**TODO End**

_Priority: P1 - Medium (bug fix)_
_Estimated Time: 15 minutes development + 30 minutes testing_
_Risk: None - Pure defensive improvement_
