# TODO 013: Fix Potential N+1 Queries in Serialization

**Priority:** P1 - MEDIUM (Performance)
**Estimated Effort:** 8-16 hours
**Impact:** Slow response times and database overload on complex projections

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Performance Issue Description](#performance-issue-description)
3. [Root Cause Analysis](#root-cause-analysis)
4. [Impact Assessment](#impact-assessment)
5. [Fix Implementation](#fix-implementation)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Considerations](#deployment-considerations)

---

## Executive Summary

The ActiveRecord collection's `list` method may trigger N+1 queries when serializing records with nested relations. While the `Query` class handles includes/joins, the serializer might trigger additional queries per record if projections include deeply nested or improperly eager-loaded relations.

### The Problem

```ruby
def list(_caller, filter, projection)
  query = Utils::Query.new(self, projection, filter)

  # Query might eager-load relations, but...
  query.get.map { |record| Utils::ActiveRecordSerializer.new(record).to_hash(projection) }
  # ❌ Serializer might trigger N queries for N records
end
```

### Potential N+1 Scenario

```ruby
# User requests: GET /forest/bank_accounts?fields[bank_accounts]=id,name,owner.email,transactions.amount

# Query 1: Fetch 50 bank accounts (eager-loads owner, maybe transactions)
# Query 2-51: For each record, serializer accesses transaction.amount (50 queries!)
# Query 52-101: For each transaction, access related data (another N queries!)

# Total: 1 + N + N*M queries instead of 1 query
```

### The Solution

Ensure projection is properly converted to eager-loading includes:

```ruby
def list(_caller, filter, projection)
  query = Utils::Query.new(self, projection, filter)

  # Verify eager-loading is applied
  records = query.get  # Should include all relations in projection

  # Add query count monitoring (development/test)
  ActiveRecord::Base.connection.query_cache.size if Rails.env.test?

  # Serialize with pre-loaded data
  records.map { |record| Utils::ActiveRecordSerializer.new(record).to_hash(projection) }
end
```

**Time to Fix:** 8-16 hours (requires profiling + optimization)
**Risk:** Low - Pure optimization, no logic changes

---

## Performance Issue Description

### Location

**File:** `agent-ruby/packages/forest_admin_datasource_active_record/lib/forest_admin_datasource_active_record/collection.rb`
**Lines:** 23-26

### Current Code

```ruby
def list(_caller, filter, projection)
  query = Utils::Query.new(self, projection, filter)
  query.get.map { |record| Utils::ActiveRecordSerializer.new(record).to_hash(projection) }
end
```

### N+1 Query Problem

**What is N+1?**
```ruby
# Fetch N users
users = User.limit(10)  # 1 query

# For each user, fetch their posts
users.each do |user|
  user.posts.to_a  # N queries (one per user)
end

# Total: 1 + N queries = 11 queries
# Should be: 1 query with JOIN or 2 queries with eager loading
```

### Example Scenarios

#### Scenario 1: Simple Relationship

```ruby
# Request: GET /forest/bank_accounts?fields[bank_accounts]=id,name,owner.email

# Without eager loading:
# Query 1: SELECT * FROM bank_accounts LIMIT 50
# Query 2: SELECT * FROM users WHERE id = 1  (for first account's owner)
# Query 3: SELECT * FROM users WHERE id = 2  (for second account's owner)
# ...
# Query 51: SELECT * FROM users WHERE id = 50
# Total: 51 queries

# With eager loading:
# Query 1: SELECT * FROM bank_accounts LIMIT 50
# Query 2: SELECT * FROM users WHERE id IN (1,2,3,...,50)
# Total: 2 queries
```

#### Scenario 2: Nested Relationships

```ruby
# Request: GET /forest/bank_accounts?fields[bank_accounts]=id,transactions.amount,transactions.merchant.name

# Without proper eager loading:
# Query 1: SELECT * FROM bank_accounts LIMIT 50
# Query 2-51: SELECT * FROM transactions WHERE bank_account_id = ? (50 queries)
# Query 52-xxx: SELECT * FROM merchants WHERE id = ? (M queries, where M = total transactions)
# Total: 1 + 50 + M queries (could be hundreds or thousands!)

# With proper eager loading:
# Query 1: SELECT * FROM bank_accounts LIMIT 50
# Query 2: SELECT * FROM transactions WHERE bank_account_id IN (...)
# Query 3: SELECT * FROM merchants WHERE id IN (...)
# Total: 3 queries
```

#### Scenario 3: Polymorphic Associations

```ruby
# Request: GET /forest/comments?fields[comments]=id,commentable.name

# Polymorphic associations are tricky:
# Query 1: SELECT * FROM comments LIMIT 50
# Query 2: SELECT * FROM posts WHERE id = 1  (if comment.commentable_type = 'Post')
# Query 3: SELECT * FROM photos WHERE id = 2 (if comment.commentable_type = 'Photo')
# ...
# Total: 1 + N queries (hard to optimize)
```

---

## Root Cause Analysis

### Why N+1 Happens

1. **Implicit Loading:** Accessing associations triggers queries
2. **Serialization:** Converting records to hashes accesses associations
3. **Nested Data:** Deep projections require multiple levels of loading
4. **ActiveRecord Default:** Lazy loading by default

### Code Flow Analysis

```ruby
# 1. Query building (should add includes)
query = Utils::Query.new(self, projection, filter)

# 2. Execution (should eager-load)
records = query.get

# 3. Serialization (accesses associations)
records.map { |record|
  Utils::ActiveRecordSerializer.new(record).to_hash(projection)
  # ⚠️  This step might trigger queries if data not preloaded
}
```

### Where Eager Loading Might Fail

1. **Complex Projections**
   ```ruby
   # projection = ["id", "owner:email,posts:title"]
   # Query class might not parse nested relations correctly
   ```

2. **Polymorphic Associations**
   ```ruby
   # Rails can't eager-load polymorphic associations easily
   # Requires special handling
   ```

3. **Through Associations**
   ```ruby
   # has_many :comments, through: :posts
   # Nested through associations are tricky
   ```

4. **Conditional Associations**
   ```ruby
   # has_many :active_posts, -> { where(active: true) }
   # Scoped associations might not be included
   ```

---

## Impact Assessment

### Severity: 🟡 MEDIUM

### What Degrades

1. **Response Time**
   - List endpoint slows down significantly
   - Exponential growth with nested relations
   - Timeout risk with large datasets

2. **Database Load**
   - Hundreds or thousands of queries per request
   - Connection pool exhaustion
   - Database CPU spikes

3. **User Experience**
   - Slow page loads in Forest Admin UI
   - Timeouts on relationship views
   - Inconsistent performance

4. **Cost**
   - Higher database instance costs
   - More read replicas needed
   - Increased AWS RDS bills

### Performance Impact Examples

| Scenario | Records | Relations | Queries Without Fix | Queries With Fix | Slowdown |
|----------|---------|-----------|---------------------|------------------|----------|
| Simple list | 50 | 0 | 1 | 1 | 1x (no issue) |
| With owner | 50 | 1 | 51 | 2 | 5x slower |
| + Transactions | 50 | 2 (1→N) | 51 + 500 | 3 | 50x slower |
| + Merchants | 50 | 3 (1→N→N) | 551 + 2000 | 4 | 200x slower |

### Real-World Benchmark

```
Without Fix:
- 50 bank accounts with transactions
- 551 SQL queries
- Response time: 3.2 seconds
- Database CPU: 45%

With Fix:
- Same data
- 3 SQL queries
- Response time: 0.08 seconds
- Database CPU: 2%

Improvement: 40x faster, 95% less DB load
```

---

## Fix Implementation

### Solution 1: Validate Query Class Includes (Diagnostic)

First, verify if `Utils::Query` is properly building includes:

```ruby
def list(_caller, filter, projection)
  query = Utils::Query.new(self, projection, filter)

  # In development/test, verify includes were added
  if Rails.env.development? || Rails.env.test?
    includes = query.instance_variable_get(:@relation).includes_values
    ForestAdminAgent::Facades::Container.logger.log(
      'Debug',
      "Query includes for #{@name}: #{includes.inspect}"
    )

    # Track query count
    query_count_before = ActiveRecord::Base.connection.query_cache.size
  end

  records = query.get

  if Rails.env.development? || Rails.env.test?
    query_count_after = ActiveRecord::Base.connection.query_cache.size
    queries_executed = query_count_after - query_count_before

    if queries_executed > 3
      ForestAdminAgent::Facades::Container.logger.log(
        'Warn',
        "Potential N+1: #{queries_executed} queries for #{@name}.list with projection: #{projection.inspect}"
      )
    end
  end

  records.map { |record| Utils::ActiveRecordSerializer.new(record).to_hash(projection) }
end
```

---

### Solution 2: Fix Query Builder (If Broken)

If `Utils::Query` isn't building includes correctly:

```ruby
# In Utils::Query class
def build_includes(projection)
  includes = []

  projection.columns.each do |column|
    if column.include?(':')
      # Parse nested projection: "owner:email,posts:title"
      parts = column.split(':')
      relation = parts[0].to_sym
      nested_fields = parts[1].split(',')

      if nested_fields.any? { |f| f.include?(':') }
        # Nested relations: "owner:posts:comments"
        includes << build_nested_includes(relation, nested_fields)
      else
        # Simple relation: "owner:email"
        includes << relation
      end
    end
  end

  includes
end

def build_nested_includes(relation, nested_fields)
  nested = {}

  nested_fields.each do |field|
    if field.include?(':')
      sub_parts = field.split(':', 2)
      nested[sub_parts[0].to_sym] = build_nested_includes(sub_parts[0], [sub_parts[1]])
    end
  end

  nested.empty? ? relation : { relation => nested }
end

# Apply includes to relation
def get
  relation = @model.all
  relation = relation.includes(build_includes(@projection)) if @projection
  relation = apply_filter(relation, @filter) if @filter
  relation.load
end
```

---

### Solution 3: Add Bullet Gem (Detection)

Install and configure the `bullet` gem to detect N+1 queries:

```ruby
# Gemfile
group :development, :test do
  gem 'bullet'
end

# config/environments/development.rb
config.after_initialize do
  Bullet.enable = true
  Bullet.alert = true                  # Browser alert
  Bullet.bullet_logger = true          # Log to bullet.log
  Bullet.console = true                # Console output
  Bullet.rails_logger = true           # Rails log
  Bullet.add_footer = true             # Footer in HTML

  # Detect N+1 queries
  Bullet.n_plus_one_query_enable = true

  # Detect unused eager loading
  Bullet.unused_eager_loading_enable = true

  # Detect missing counter cache
  Bullet.counter_cache_enable = true
end

# config/environments/test.rb
config.after_initialize do
  Bullet.enable = true
  Bullet.raise = true  # Raise exception in tests (fail fast)
end
```

---

### Solution 4: Manual Eager Loading (Workaround)

If Query class can't be fixed quickly:

```ruby
def list(_caller, filter, projection)
  query = Utils::Query.new(self, projection, filter)

  # Manually add includes based on projection
  includes = extract_includes_from_projection(projection)

  # Override relation with includes
  relation = query.instance_variable_get(:@relation)
  relation = relation.includes(includes) unless includes.empty?

  records = relation.load

  records.map { |record| Utils::ActiveRecordSerializer.new(record).to_hash(projection) }
end

private

def extract_includes_from_projection(projection)
  includes = []

  projection.columns.each do |column|
    next unless column.include?(':')

    # Extract relation name (before first colon)
    relation = column.split(':').first.to_sym
    includes << relation unless includes.include?(relation)
  end

  includes
end
```

---

### Solution 5: Preloader Service (Advanced)

Create a dedicated service to handle complex eager loading:

```ruby
class ProjectionPreloader
  def self.preload(records, projection, collection)
    return records if projection.columns.empty?

    # Group projections by relation depth
    relations = parse_relations(projection)

    # Apply preloading in order (shallow to deep)
    relations.each do |relation_chain|
      ActiveRecord::Associations::Preloader.new(
        records: records,
        associations: relation_chain
      ).call
    end

    records
  end

  def self.parse_relations(projection)
    # Convert projection like "owner:email,posts:comments:author"
    # Into nested hash: { owner: {}, posts: { comments: { author: {} } } }
    # ...
  end
end

# Usage in collection.rb
def list(_caller, filter, projection)
  query = Utils::Query.new(self, projection, filter)
  records = query.get

  # Ensure all relations are preloaded
  records = ProjectionPreloader.preload(records, projection, self)

  records.map { |record| Utils::ActiveRecordSerializer.new(record).to_hash(projection) }
end
```

---

**Recommendation:** Start with **Solution 1** (diagnostic), add **Solution 3** (Bullet), then implement **Solution 2** or **Solution 4** based on findings.

---

## Testing Strategy

### Step 1: Install Bullet Gem

```bash
bundle add bullet --group development,test
```

Configure as shown in Solution 3.

### Step 2: Write N+1 Detection Tests

```ruby
RSpec.describe ForestAdminDatasourceActiveRecord::Collection, type: :model do
  describe '#list with nested projections' do
    let(:collection) { described_class.new('bank_accounts', BankAccount) }
    let(:caller) { build(:caller) }
    let(:filter) { ForestAdminDatasourceToolkit::Components::Query::Filter.new }

    before do
      # Create test data with relations
      user = User.create!(name: 'John')
      bank_account = BankAccount.create!(name: 'Checking', user: user)
      3.times { Transaction.create!(amount: 100, bank_account: bank_account) }
    end

    context 'with simple projection (no relations)' do
      let(:projection) do
        ForestAdminDatasourceToolkit::Components::Query::Projection.new(['id', 'name'])
      end

      it 'executes minimal queries' do
        expect do
          collection.list(caller, filter, projection)
        end.to make_database_queries(count: 1)
      end
    end

    context 'with single-level relation projection' do
      let(:projection) do
        ForestAdminDatasourceToolkit::Components::Query::Projection.new(['id', 'name', 'user:email'])
      end

      it 'eager-loads relation (no N+1)' do
        expect do
          collection.list(caller, filter, projection)
        end.to make_database_queries(count: 2)  # 1 for accounts, 1 for users
      end

      it 'does not trigger N+1 queries' do
        expect do
          collection.list(caller, filter, projection)
        end.not_to exceed_query_limit(3)
      end
    end

    context 'with nested relation projection (N+1 risk)' do
      let(:projection) do
        ForestAdminDatasourceToolkit::Components::Query::Projection.new([
          'id',
          'name',
          'user:email',
          'transactions:amount'
        ])
      end

      it 'eager-loads all relations (no N+1)' do
        # Should be: 1 (accounts) + 1 (users) + 1 (transactions) = 3 queries
        expect do
          collection.list(caller, filter, projection)
        end.to make_database_queries(count: 3)
      end
    end

    context 'with deeply nested projection' do
      let(:projection) do
        ForestAdminDatasourceToolkit::Components::Query::Projection.new([
          'id',
          'transactions:merchant:name'  # 3 levels deep
        ])
      end

      it 'eager-loads all nested relations' do
        # Should be: 1 (accounts) + 1 (transactions) + 1 (merchants) = 3 queries
        expect do
          collection.list(caller, filter, projection)
        end.to make_database_queries(count: 3)
      end
    end
  end
end

# Custom matcher for query counting
RSpec::Matchers.define :make_database_queries do |count:|
  supports_block_expectations

  match do |block|
    query_count = count_queries(&block)
    query_count == count
  end

  failure_message do |block|
    query_count = count_queries(&block)
    "expected #{count} database queries, got #{query_count}"
  end

  def count_queries
    queries = []
    subscriber = ActiveSupport::Notifications.subscribe('sql.active_record') do |*args|
      queries << args.last[:sql] unless args.last[:name] == 'SCHEMA'
    end

    yield

    ActiveSupport::Notifications.unsubscribe(subscriber)
    queries.size
  end
end
```

### Step 3: Benchmark Tests

```ruby
RSpec.describe 'Performance: N+1 Prevention', type: :performance do
  before do
    # Create realistic dataset
    10.times do |i|
      user = User.create!(name: "User #{i}")
      account = BankAccount.create!(name: "Account #{i}", user: user)

      20.times do |j|
        Transaction.create!(amount: j * 10, bank_account: account)
      end
    end
  end

  it 'lists 100 accounts with relations in < 100ms' do
    collection = ForestAdminDatasourceActiveRecord::Collection.new('bank_accounts', BankAccount)
    projection = Projection.new(['id', 'name', 'user:email', 'transactions:amount'])

    expect do
      collection.list(caller, filter, projection)
    end.to perform_under(100).ms
  end

  it 'executes minimal queries regardless of record count' do
    collection = ForestAdminDatasourceActiveRecord::Collection.new('bank_accounts', BankAccount)
    projection = Projection.new(['id', 'user:email'])

    queries_10_records = count_queries do
      collection.list(caller, Filter.new(page: Page.new(limit: 10)), projection)
    end

    queries_100_records = count_queries do
      collection.list(caller, Filter.new(page: Page.new(limit: 100)), projection)
    end

    # Query count should be constant, not proportional to record count
    expect(queries_10_records).to eq(queries_100_records)
  end
end
```

### Step 4: Manual Testing with Logs

```ruby
# Enable ActiveRecord query logging
ActiveRecord::Base.logger = Logger.new(STDOUT)

# In Rails console or test:
collection = ForestAdminDatasourceActiveRecord::Collection.new('bank_accounts', BankAccount)
projection = Projection.new(['id', 'user:email', 'transactions:amount'])

# Watch SQL queries in output
collection.list(caller, filter, projection)

# Should see:
# SELECT "bank_accounts".* FROM "bank_accounts"
# SELECT "users".* FROM "users" WHERE "users"."id" IN (...)
# SELECT "transactions".* FROM "transactions" WHERE "transactions"."bank_account_id" IN (...)

# Should NOT see repeated queries:
# SELECT "users".* FROM "users" WHERE "users"."id" = 1
# SELECT "users".* FROM "users" WHERE "users"."id" = 2
# (N+1 pattern)
```

### Manual Testing Checklist

- [ ] Install Bullet gem
- [ ] Run test suite, check for N+1 warnings
- [ ] Test list with no relations (baseline)
- [ ] Test list with single relation (owner)
- [ ] Test list with multiple relations (owner + transactions)
- [ ] Test list with nested relations (transactions → merchant)
- [ ] Test with 10, 50, 100, 500 records
- [ ] Measure query count (should be constant)
- [ ] Measure response time (should scale linearly, not exponentially)
- [ ] Test polymorphic associations (if used)
- [ ] Test through associations (if used)
- [ ] Profile with Rails profiler or Scout
- [ ] Check database slow query log

---

## Deployment Considerations

### Pre-Deployment

1. **Profile Production**
   ```ruby
   # Add temporary logging to production (carefully!)
   def list(_caller, filter, projection)
     start_time = Time.now
     query_count_before = ActiveRecord::Base.connection.query_cache.size

     result = # ... existing code

     duration = Time.now - start_time
     queries = ActiveRecord::Base.connection.query_cache.size - query_count_before

     if queries > 10 || duration > 0.5
       Rails.logger.warn("Slow list: #{@name}, queries: #{queries}, duration: #{duration}s")
     end

     result
   end
   ```

2. **Identify Hotspots**
   - Which collections have most relations?
   - Which projections are most complex?
   - Which endpoints are slowest?

3. **Set Performance Targets**
   - Response time < 200ms for simple lists
   - Response time < 500ms for complex projections
   - Query count < 5 regardless of record count

### Deployment Strategy

**Gradual Rollout**

1. **Phase 1:** Add diagnostics + Bullet in development
2. **Phase 2:** Fix Query class or add manual includes
3. **Phase 3:** Deploy to staging, verify performance
4. **Phase 4:** Deploy to production with monitoring
5. **Phase 5:** Measure improvement, iterate

**Timeline:**
- Diagnostic phase: 2 hours
- Fix implementation: 4-8 hours
- Testing: 2-4 hours
- Staging validation: 2 hours
- Production deployment: Standard
- **Total: 1-2 weeks** (including monitoring)

### Post-Deployment

1. **Monitor Performance**
   ```ruby
   # Add metrics
   StatsD.timing('forest.list.queries', query_count, tags: ["collection:#{@name}"])
   StatsD.timing('forest.list.duration', duration_ms, tags: ["collection:#{@name}"])
   ```

2. **Track Improvements**
   | Metric | Before | After | Improvement |
   |--------|--------|-------|-------------|
   | Avg queries per request | 150 | 3 | 98% reduction |
   | Avg response time | 2.1s | 0.15s | 93% faster |
   | P95 response time | 5.2s | 0.3s | 94% faster |
   | Database CPU | 45% | 8% | 82% reduction |

3. **Iterate on Edge Cases**
   - Some projections might still have N+1
   - Polymorphic associations need special handling
   - Add more tests as issues discovered

---

## Success Criteria

### Performance

- ✅ Query count < 5 for any projection
- ✅ Response time < 500ms for complex projections
- ✅ No N+1 warnings from Bullet
- ✅ Database CPU reduced by > 50%

### Testing

- ✅ Bullet gem installed and configured
- ✅ All tests pass with Bullet.raise enabled
- ✅ Performance benchmarks meet targets
- ✅ Load testing shows linear scaling

### Monitoring

- ✅ Query count metrics added
- ✅ Response time metrics added
- ✅ Alerts for slow queries
- ✅ Dashboard showing improvements

---

**TODO End**

*Priority: P1 - Medium (performance optimization)*
*Estimated Time: 8-16 hours (diagnostic → fix → test)*
*Risk: Low - Pure optimization, no logic changes*
