# Done 007: Skip Schema Update - Implementation Guide
## Medium Priority (P2) - Forest Admin Agent Ruby

**Project:** mini_qonto
**Target Package:** forest_admin_agent + forest_admin_rails (via agent-ruby)
**Estimated Effort:** 2-3 days
**Priority:** P2 - Essential for cloud/serverless deployments

---

## 🎯 Executive Summary

Implement configuration flag to skip automatic schema updates, enabling deployment in serverless environments, multi-instance setups, and controlled schema management scenarios.

**Current Problem:**
- Every agent instance attempts to update schema on startup
- Problematic in serverless (AWS Lambda, Cloud Run) where instances are ephemeral
- Causes race conditions in Kubernetes with multiple pods
- Unnecessary in blue-green deployments
- Read-only instances shouldn't modify schema

**Target Solution:**
- Configuration flag: `skip_schema_update` (default: false)
- Optional logging field: `schema_update_reason`
- Force override capability for manual updates
- Schema loaded from file but not sent to API
- Health check respects skip flag

**Benefits:**
- ✅ Support serverless deployments (Lambda, Cloud Run, Cloud Functions)
- ✅ Prevent race conditions in Kubernetes clusters
- ✅ Enable blue-green deployment patterns
- ✅ Support read-only replica instances
- ✅ Manual schema update control
- ✅ Faster startup times (skip API call)

---

## 📊 Node.js Reference Implementation

### Configuration Type (Node.js)

**File:** `agent-nodejs/packages/agent/src/types.ts`

```typescript
type AgentOptions = {
  // ... other options ...

  /**
   * Skip schema update on agent start
   * Useful for serverless deployments or when schema is managed externally
   * @default false
   */
  skipSchemaUpdate?: boolean;
};
```

### Schema Update Logic (Node.js)

**File:** `agent-nodejs/packages/agent/src/agent.ts`

```typescript
protected async sendSchema(dataSource: DataSource) {
  if (this.options.skipSchemaUpdate) {
    this.options.logger('Warn', 'Schema update was skipped');
    return;
  }

  let schema;
  const { meta } = SchemaGenerator.buildMetadata(customizationService.buildFeatures());

  if (!this.options.experimental?.webhookCustomActions && this.options.isProduction) {
    // Load schema from file in production
    schema = JSON.parse(await readFile(this.options.schemaPath));
  } else {
    // Generate schema in development
    schema = await schemaGenerator.buildSchema(dataSource);
    await writeFile(this.options.schemaPath, stringify({ ...schema, meta }));
  }

  // Send to Forest Admin API
  await this.options.forestAdminClient.postSchema({ ...schema, meta });
}
```

### Key Features:

1. **Simple Boolean Flag:** `skipSchemaUpdate: true/false`
2. **Early Return:** Exits before schema generation/sending
3. **Logging:** Warns when schema update skipped
4. **Production Behavior:** Schema still loaded from file for validation
5. **No API Call:** Skips POST to Forest Admin servers

---

## 🏗️ Ruby Implementation Architecture

### Overview

```
┌─────────────────────────────────────────────────┐
│  Agent Initialization                           │
│  - Load configuration                           │
│  - Check skip_schema_update flag                │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌──────────────┐      ┌──────────────┐
│ Flag TRUE    │      │ Flag FALSE   │
│ (Skip)       │      │ (Normal)     │
└──────┬───────┘      └──────┬───────┘
       │                     │
       ▼                     ▼
┌──────────────┐      ┌──────────────────────────┐
│ Load Schema  │      │ Generate/Load Schema     │
│ from File    │      │ - Generate if dev        │
│ (Validation) │      │ - Load from file if prod │
└──────┬───────┘      └──────┬───────────────────┘
       │                     │
       ▼                     ▼
┌──────────────┐      ┌──────────────────────────┐
│ Log Skip     │      │ POST to Forest Admin API │
│ Warning      │      │ - Update schema          │
└──────┬───────┘      └──────┬───────────────────┘
       │                     │
       └──────────┬──────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  Agent Ready                                    │
│  - Routes available                             │
│  - Health check responds                        │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Details

### File 1: Add Configuration Options

**Location:** `agent-ruby/packages/forest_admin_rails/lib/forest_admin_rails.rb`

```ruby
# frozen_string_literal: true

require 'dry-configurable'

module ForestAdminRails
  extend Dry::Configurable

  # Authentication
  setting :auth_secret
  setting :env_secret

  # Server configuration
  setting :forest_server_url, default: ENV.fetch('FOREST_SERVER_URL', 'https://api.forestadmin.com')
  setting :is_production, default: Rails.env.production?

  # Schema management (UPDATED)
  setting :schema_path, default: File.join(Dir.pwd, '.forestadmin-schema.json')
  setting :skip_schema_update, default: false  # NEW
  setting :schema_update_reason, default: nil  # NEW (optional explanation)

  # ... other settings ...
end
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `skip_schema_update` | Boolean | `false` | Skip automatic schema updates |
| `schema_update_reason` | String/nil | `nil` | Optional reason for skipping (logged) |

---

### File 2: Update AgentFactory Schema Logic

**Location:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/builder/agent_factory.rb`

```ruby
# frozen_string_literal: true

module ForestAdminAgent
  module Builder
    class AgentFactory
      include Singleton

      # ... existing code ...

      # Send schema to Forest Admin API
      # @param force [Boolean] Force schema update even if skip flag is set
      def send_schema(force: false)
        # Check if schema update should be skipped (NEW)
        if should_skip_schema_update? && !force
          log_schema_skip
          return
        end

        return unless @has_env_secret

        schema_path = Facades::Container.cache(:schema_path)

        if Facades::Container.cache(:is_production)
          # Load schema from file in production
          unless File.exist?(schema_path)
            @logger.log('Error', "Schema file not found at #{schema_path}")
            return
          end

          schema = JSON.parse(File.read(schema_path), symbolize_names: true)
        else
          # Generate schema in development
          generated = SchemaEmitter.generate(@container.resolve(:datasource))
          schema = { meta: SchemaEmitter.meta, collections: generated }

          # Write to file
          File.write(schema_path, JSON.pretty_generate(schema))
        end

        # Append additional schema if configured
        if (append_schema_path = Facades::Container.cache(:append_schema_path))
          if File.exist?(append_schema_path)
            append_schema_file = JSON.parse(File.read(append_schema_path), symbolize_names: true)
            schema[:collections] += append_schema_file[:collections] if append_schema_file[:collections]
          else
            @logger.log('Warn', "Append schema file not found: #{append_schema_path}")
          end
        end

        # Post schema to Forest Admin API
        post_schema(schema, force)
      end

      private

      # Check if schema update should be skipped (NEW)
      # @return [Boolean]
      def should_skip_schema_update?
        Facades::Container.cache(:skip_schema_update) == true
      end

      # Log schema skip with reason (NEW)
      def log_schema_skip
        reason = Facades::Container.cache(:schema_update_reason)

        if reason
          @logger.log('Warn', "[ForestAdmin] Schema update skipped: #{reason}")
        else
          @logger.log('Warn', '[ForestAdmin] Schema update skipped (skip_schema_update flag is true)')
        end

        # Log environment info for debugging
        @logger.log('Info', "[ForestAdmin] Running in #{Facades::Container.cache(:is_production) ? 'production' : 'development'} mode")
      end

      # Post schema to Forest Admin API
      # @param schema [Hash] Schema data
      # @param force [Boolean] Force update (log differently)
      def post_schema(schema, force)
        api_map = SchemaEmitter.serialize(schema)
        should_send = do_server_want_schema(api_map[:meta][:schemaFileHash])

        if should_send || force
          client = ForestAdminApiRequester.new
          response = client.post('/forest/apimaps', api_map.to_json)

          if response.success?
            @logger.log('Info', '[ForestAdmin] Schema updated successfully')
          else
            @logger.log('Error', "[ForestAdmin] Schema update failed: #{response.body}")
          end
        else
          @logger.log('Info', '[ForestAdmin] Schema unchanged, skipping update')
        end
      end

      # Check if server wants schema update
      # @param schema_hash [String] Schema file hash
      # @return [Boolean]
      def do_server_want_schema(schema_hash)
        client = ForestAdminApiRequester.new
        response = client.post('/forest/apimaps/hashcheck', { schemaFileHash: schema_hash }.to_json)

        if response.success?
          body = JSON.parse(response.body, symbolize_names: true)
          body[:sendSchema] == true
        else
          # On error, assume we should send schema
          @logger.log('Warn', '[ForestAdmin] Hash check failed, will send schema')
          true
        end
      rescue StandardError => e
        @logger.log('Warn', "[ForestAdmin] Hash check error: #{e.message}")
        true
      end
    end
  end
end
```

**Key Changes:**

1. **`should_skip_schema_update?`** - Private method to check flag
2. **`log_schema_skip`** - Logs skip with optional reason
3. **Early return** - Exits before posting to API if skipped
4. **Force parameter** - Allows override of skip flag
5. **Enhanced logging** - Environment mode, success/failure messages

---

### File 3: Update Health Check Behavior

**Location:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/routes/system/health_check.rb`

```ruby
# frozen_string_literal: true

module ForestAdminAgent
  module Routes
    module System
      class HealthCheck < AbstractRoute
        def setup_routes(router)
          router.add_route(
            'forest_health_check',
            'get',
            '/forest/',
            ->(args) { handle_request(args) },
            'json'
          )
        end

        def handle_request(_args = {})
          # In production, force schema send on health check (UPDATED)
          # UNLESS skip_schema_update is explicitly set
          if Facades::Container.cache(:is_production)
            unless Facades::Container.cache(:skip_schema_update)
              AgentFactory.instance.send_schema(force: true)
            end
          end

          { content: nil, status: 204 }
        end
      end
    end
  end
end
```

**Behavior Change:**

- **Before:** Always force schema send in production on health check
- **After:** Respect `skip_schema_update` flag even in health checks
- **Rationale:** Health checks happen frequently; don't override skip intent

---

### File 4: Add Rake Task for Manual Schema Update

**Location:** `agent-ruby/packages/forest_admin_rails/lib/tasks/forest_admin.rake`

```ruby
# frozen_string_literal: true

namespace :forest_admin do
  desc 'Update Forest Admin schema manually'
  task update_schema: :environment do
    puts '[ForestAdmin] Updating schema...'

    # Temporarily disable skip flag for this task
    original_skip = ForestAdminRails.config[:skip_schema_update]
    ForestAdminRails.config[:skip_schema_update] = false

    begin
      # Force schema update
      ForestAdminAgent::Builder::AgentFactory.instance.send_schema(force: true)
      puts '[ForestAdmin] ✓ Schema updated successfully'
    rescue StandardError => e
      puts "[ForestAdmin] ✗ Schema update failed: #{e.message}"
      raise
    ensure
      # Restore original setting
      ForestAdminRails.config[:skip_schema_update] = original_skip
    end
  end

  desc 'Validate Forest Admin schema file exists'
  task validate_schema: :environment do
    schema_path = ForestAdminRails.config[:schema_path]

    if File.exist?(schema_path)
      puts "[ForestAdmin] ✓ Schema file found: #{schema_path}"

      schema = JSON.parse(File.read(schema_path))
      collection_count = schema['collections']&.length || 0
      puts "[ForestAdmin]   Collections: #{collection_count}"
    else
      puts "[ForestAdmin] ✗ Schema file not found: #{schema_path}"
      puts '[ForestAdmin]   Run: rails forest_admin:update_schema'
      exit 1
    end
  end

  desc 'Show Forest Admin configuration'
  task show_config: :environment do
    config = ForestAdminRails.config.to_h

    puts '[ForestAdmin] Configuration:'
    puts "  Environment: #{config[:is_production] ? 'production' : 'development'}"
    puts "  Schema Path: #{config[:schema_path]}"
    puts "  Skip Schema Update: #{config[:skip_schema_update]}"
    puts "  Skip Reason: #{config[:schema_update_reason]}" if config[:schema_update_reason]
    puts "  Forest Server URL: #{config[:forest_server_url]}"
  end
end
```

**Rake Tasks:**

1. **`rails forest_admin:update_schema`** - Manually update schema (ignores skip flag)
2. **`rails forest_admin:validate_schema`** - Check if schema file exists
3. **`rails forest_admin:show_config`** - Display current configuration

---

## 📝 Usage Examples

### Example 1: AWS Lambda Deployment

**Problem:** Lambda functions are ephemeral; schema should be updated before deployment, not by each invocation.

**Solution:**

```ruby
# config/initializers/forest_admin.rb
ForestAdminRails.configure do |config|
  config.auth_secret = ENV['FOREST_AUTH_SECRET']
  config.env_secret = ENV['FOREST_ENV_SECRET']

  # Skip schema update in Lambda
  config.skip_schema_update = true
  config.schema_update_reason = 'AWS Lambda ephemeral instance'
end
```

**Deployment script:**

```bash
#!/bin/bash
# Before deploying to Lambda

# Update schema from local environment
bundle exec rails forest_admin:update_schema

# Deploy Lambda function
aws lambda update-function-code \
  --function-name my-forest-admin-app \
  --zip-file fileb://function.zip
```

---

### Example 2: Kubernetes with Multiple Pods

**Problem:** Multiple pods starting simultaneously cause race conditions updating schema.

**Solution 1: Leader Election**

```ruby
# lib/forest_admin/leader_elector.rb
class ForestAdminLeaderElector
  LEADER_KEY = 'forest_admin_schema_leader'
  LEADER_TTL = 60 # seconds

  def self.leader?
    redis = Redis.new(url: ENV['REDIS_URL'])

    # Try to become leader
    leader_pid = redis.get(LEADER_KEY)

    if leader_pid.nil?
      # No leader, try to claim leadership
      redis.set(LEADER_KEY, Process.pid, ex: LEADER_TTL, nx: true)
      leader_pid = redis.get(LEADER_KEY)
    end

    # Check if we're the leader
    leader_pid.to_s == Process.pid.to_s
  rescue Redis::BaseError => e
    Rails.logger.warn "[ForestAdmin] Leader election failed: #{e.message}"
    # On error, don't update schema
    false
  end
end

# config/initializers/forest_admin.rb
ForestAdminRails.configure do |config|
  config.auth_secret = ENV['FOREST_AUTH_SECRET']
  config.env_secret = ENV['FOREST_ENV_SECRET']

  # Only leader updates schema
  is_leader = ForestAdminLeaderElector.leader?
  config.skip_schema_update = !is_leader
  config.schema_update_reason = is_leader ? nil : "Not schema leader (current pod: #{ENV['POD_NAME']})"

  Rails.logger.info "[ForestAdmin] Pod #{ENV['POD_NAME']} - Schema leader: #{is_leader}"
end
```

**Solution 2: Init Container**

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: forest-admin-app
spec:
  replicas: 3
  template:
    spec:
      initContainers:
        - name: forest-schema-update
          image: my-app:latest
          command: ['bundle', 'exec', 'rails', 'forest_admin:update_schema']
          env:
            - name: FOREST_AUTH_SECRET
              valueFrom:
                secretKeyRef:
                  name: forest-admin
                  key: auth-secret
            - name: FOREST_ENV_SECRET
              valueFrom:
                secretKeyRef:
                  name: forest-admin
                  key: env-secret
      containers:
        - name: app
          image: my-app:latest
          env:
            - name: SKIP_FOREST_SCHEMA_UPDATE
              value: "true"
          # ... other container config
```

```ruby
# config/initializers/forest_admin.rb
ForestAdminRails.configure do |config|
  config.skip_schema_update = ENV['SKIP_FOREST_SCHEMA_UPDATE'] == 'true'
  config.schema_update_reason = 'Schema updated by init container'
end
```

---

### Example 3: Blue-Green Deployment

**Problem:** During blue-green deployment, old (blue) instances should keep old schema while new (green) instances have new schema.

**Solution:**

```ruby
# config/initializers/forest_admin.rb
ForestAdminRails.configure do |config|
  config.auth_secret = ENV['FOREST_AUTH_SECRET']
  config.env_secret = ENV['FOREST_ENV_SECRET']

  # Get deployment color from environment
  deployment_color = ENV['DEPLOYMENT_COLOR'] || 'green'

  # Only green (new) deployment updates schema
  config.skip_schema_update = (deployment_color == 'blue')
  config.schema_update_reason = "Blue-green deployment: #{deployment_color} instances"
end
```

**Deployment process:**

```bash
# 1. Deploy green with schema update
export DEPLOYMENT_COLOR=green
kubectl apply -f green-deployment.yaml

# 2. Wait for green to be healthy
kubectl wait --for=condition=ready pod -l version=green

# 3. Switch traffic to green
kubectl patch service app-service -p '{"spec":{"selector":{"version":"green"}}}'

# 4. Scale down blue (they keep old schema)
kubectl scale deployment app-blue --replicas=0
```

---

### Example 4: Read-Only Replica Instances

**Problem:** Read-only replicas should not attempt to update schema.

**Solution:**

```ruby
# config/initializers/forest_admin.rb
ForestAdminRails.configure do |config|
  config.auth_secret = ENV['FOREST_AUTH_SECRET']
  config.env_secret = ENV['FOREST_ENV_SECRET']

  # Detect instance role from environment
  instance_role = ENV['INSTANCE_ROLE'] || 'primary'

  # Only primary updates schema
  config.skip_schema_update = (instance_role != 'primary')
  config.schema_update_reason = "Read-only #{instance_role} instance"

  Rails.logger.info "[ForestAdmin] Instance role: #{instance_role}, Skip schema: #{config.skip_schema_update}"
end
```

---

### Example 5: CI/CD Pipeline with Pre-Deployment Schema Update

**Problem:** Schema should be updated once before deployment, not by every instance.

**Solution:**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  update-schema:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Ruby
        uses: ruby/setup-ruby@v1
        with:
          bundler-cache: true

      - name: Update Forest Admin Schema
        env:
          FOREST_AUTH_SECRET: ${{ secrets.FOREST_AUTH_SECRET }}
          FOREST_ENV_SECRET: ${{ secrets.FOREST_ENV_SECRET }}
          RAILS_ENV: production
        run: |
          bundle exec rails forest_admin:update_schema

      - name: Commit updated schema
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add .forestadmin-schema.json
          git commit -m "Update Forest Admin schema" || echo "No schema changes"

  deploy:
    needs: update-schema
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: |
          # Deploy with SKIP_FOREST_SCHEMA_UPDATE=true
          # Instances will load schema from file but not update it
```

```ruby
# config/initializers/forest_admin.rb
ForestAdminRails.configure do |config|
  # In production, skip schema update (updated by CI/CD)
  config.skip_schema_update = Rails.env.production?
  config.schema_update_reason = 'Schema managed by CI/CD pipeline'
end
```

---

### Example 6: Conditional Skip Based on Environment Variable

**Solution:**

```ruby
# config/initializers/forest_admin.rb
ForestAdminRails.configure do |config|
  config.auth_secret = ENV['FOREST_AUTH_SECRET']
  config.env_secret = ENV['FOREST_ENV_SECRET']

  # Simple environment variable control
  config.skip_schema_update = ENV['FOREST_SKIP_SCHEMA_UPDATE'] == 'true'

  # Optional: provide reason from environment
  if config.skip_schema_update
    config.schema_update_reason = ENV['FOREST_SKIP_REASON'] || 'Environment variable set'
  end
end
```

**Usage:**

```bash
# Skip schema update
export FOREST_SKIP_SCHEMA_UPDATE=true
export FOREST_SKIP_REASON="Deployment coordinator will update schema"

# Start application
bundle exec rails server
```

---

## 🧪 Testing Strategy

### Test File 1: Unit Tests for AgentFactory

**Location:** `spec/lib/forest_admin_agent/builder/agent_factory_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe ForestAdminAgent::Builder::AgentFactory do
  let(:factory) { described_class.instance }
  let(:logger) { instance_double('Logger') }

  before do
    allow(ForestAdminAgent::Facades::Container).to receive(:cache).and_call_original
    allow(logger).to receive(:log)
    factory.instance_variable_set(:@logger, logger)
    factory.instance_variable_set(:@has_env_secret, true)
  end

  describe '#send_schema' do
    context 'with skip_schema_update disabled (default)' do
      before do
        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:skip_schema_update)
          .and_return(false)

        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:is_production)
          .and_return(false)

        allow(factory).to receive(:post_schema)
      end

      it 'sends schema normally' do
        expect(factory).to receive(:post_schema)

        factory.send_schema
      end

      it 'does not log skip warning' do
        expect(logger).not_to receive(:log).with('Warn', include('skipped'))

        factory.send_schema
      end
    end

    context 'with skip_schema_update enabled' do
      before do
        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:skip_schema_update)
          .and_return(true)

        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:schema_update_reason)
          .and_return(nil)
      end

      it 'does not send schema' do
        expect(factory).not_to receive(:post_schema)

        factory.send_schema
      end

      it 'logs skip warning' do
        expect(logger).to receive(:log)
          .with('Warn', include('Schema update skipped'))

        factory.send_schema
      end

      it 'logs default reason when reason not provided' do
        expect(logger).to receive(:log)
          .with('Warn', include('skip_schema_update flag is true'))

        factory.send_schema
      end
    end

    context 'with skip_schema_update enabled but custom reason' do
      before do
        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:skip_schema_update)
          .and_return(true)

        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:schema_update_reason)
          .and_return('AWS Lambda deployment')
      end

      it 'logs custom skip reason' do
        expect(logger).to receive(:log)
          .with('Warn', include('AWS Lambda deployment'))

        factory.send_schema
      end
    end

    context 'with skip_schema_update enabled but force flag' do
      before do
        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:skip_schema_update)
          .and_return(true)

        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:is_production)
          .and_return(false)

        allow(factory).to receive(:post_schema)
      end

      it 'sends schema when forced' do
        expect(factory).to receive(:post_schema)

        factory.send_schema(force: true)
      end

      it 'does not log skip warning when forced' do
        expect(logger).not_to receive(:log).with('Warn', include('skipped'))

        factory.send_schema(force: true)
      end
    end

    context 'with skip_schema_update enabled and no env_secret' do
      before do
        factory.instance_variable_set(:@has_env_secret, false)

        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:skip_schema_update)
          .and_return(true)
      end

      it 'returns early (no schema operation)' do
        expect(factory).not_to receive(:post_schema)
        expect(logger).to receive(:log).with('Warn', include('skipped'))

        factory.send_schema
      end
    end

    context 'in production with skip disabled' do
      before do
        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:skip_schema_update)
          .and_return(false)

        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:is_production)
          .and_return(true)

        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:schema_path)
          .and_return('/tmp/test-schema.json')

        # Create dummy schema file
        File.write('/tmp/test-schema.json', { collections: [] }.to_json)

        allow(factory).to receive(:post_schema)
      end

      after do
        File.delete('/tmp/test-schema.json') if File.exist?('/tmp/test-schema.json')
      end

      it 'loads schema from file' do
        expect(File).to receive(:read).with('/tmp/test-schema.json').and_call_original

        factory.send_schema
      end

      it 'sends loaded schema' do
        expect(factory).to receive(:post_schema)

        factory.send_schema
      end
    end
  end
end
```

---

### Test File 2: Health Check Tests

**Location:** `spec/lib/forest_admin_agent/routes/system/health_check_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe ForestAdminAgent::Routes::System::HealthCheck do
  let(:route) { described_class.new }
  let(:factory) { instance_double('AgentFactory') }

  before do
    allow(ForestAdminAgent::Builder::AgentFactory).to receive(:instance).and_return(factory)
  end

  describe '#handle_request' do
    context 'in production with skip_schema_update disabled' do
      before do
        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:is_production)
          .and_return(true)

        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:skip_schema_update)
          .and_return(false)
      end

      it 'forces schema send' do
        expect(factory).to receive(:send_schema).with(force: true)

        result = route.handle_request
        expect(result[:status]).to eq(204)
      end
    end

    context 'in production with skip_schema_update enabled' do
      before do
        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:is_production)
          .and_return(true)

        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:skip_schema_update)
          .and_return(true)
      end

      it 'does not force schema send' do
        expect(factory).not_to receive(:send_schema)

        result = route.handle_request
        expect(result[:status]).to eq(204)
      end
    end

    context 'in development' do
      before do
        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:is_production)
          .and_return(false)
      end

      it 'does not send schema' do
        expect(factory).not_to receive(:send_schema)

        result = route.handle_request
        expect(result[:status]).to eq(204)
      end
    end
  end
end
```

---

### Test File 3: Integration Tests

**Location:** `spec/integration/skip_schema_update_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe 'Skip Schema Update Configuration', type: :integration do
  let(:factory) { ForestAdminAgent::Builder::AgentFactory.instance }

  before do
    # Reset singleton state
    factory.instance_variable_set(:@has_env_secret, true)

    # Set up logger spy
    logger = instance_double('Logger')
    allow(logger).to receive(:log)
    factory.instance_variable_set(:@logger, logger)
  end

  context 'with skip_schema_update in configuration' do
    around do |example|
      # Save original config
      original_skip = ForestAdminRails.config[:skip_schema_update]
      original_reason = ForestAdminRails.config[:schema_update_reason]

      # Set test config
      ForestAdminRails.config[:skip_schema_update] = true
      ForestAdminRails.config[:schema_update_reason] = 'Integration test'

      example.run

      # Restore original config
      ForestAdminRails.config[:skip_schema_update] = original_skip
      ForestAdminRails.config[:schema_update_reason] = original_reason
    end

    it 'skips schema update on initialization' do
      expect(factory).not_to receive(:post_schema)

      factory.send_schema
    end

    it 'logs the configured reason' do
      logger = factory.instance_variable_get(:@logger)

      expect(logger).to receive(:log)
        .with('Warn', include('Integration test'))

      factory.send_schema
    end
  end

  context 'with force override' do
    around do |example|
      original_skip = ForestAdminRails.config[:skip_schema_update]
      ForestAdminRails.config[:skip_schema_update] = true

      example.run

      ForestAdminRails.config[:skip_schema_update] = original_skip
    end

    it 'sends schema when forced despite skip flag' do
      allow(ForestAdminAgent::Facades::Container).to receive(:cache)
        .with(:is_production)
        .and_return(false)

      expect(factory).to receive(:post_schema)

      factory.send_schema(force: true)
    end
  end
end
```

---

### Test File 4: Rake Task Tests

**Location:** `spec/tasks/forest_admin_rake_spec.rb`

```ruby
require 'spec_helper'
require 'rake'

RSpec.describe 'Forest Admin Rake Tasks' do
  before(:all) do
    Rake.application.rake_require 'tasks/forest_admin'
    Rake::Task.define_task(:environment)
  end

  before do
    Rake::Task['forest_admin:update_schema'].reenable
    Rake::Task['forest_admin:validate_schema'].reenable
  end

  describe 'forest_admin:update_schema' do
    let(:factory) { instance_double('AgentFactory') }

    before do
      allow(ForestAdminAgent::Builder::AgentFactory).to receive(:instance).and_return(factory)

      # Set skip flag
      ForestAdminRails.config[:skip_schema_update] = true
    end

    it 'temporarily disables skip flag' do
      expect(factory).to receive(:send_schema).with(force: true)

      # Capture stdout
      output = capture_stdout do
        Rake::Task['forest_admin:update_schema'].invoke
      end

      expect(output).to include('Schema updated successfully')
    end

    it 'restores skip flag after execution' do
      allow(factory).to receive(:send_schema)

      Rake::Task['forest_admin:update_schema'].invoke

      expect(ForestAdminRails.config[:skip_schema_update]).to be true
    end

    it 'restores skip flag even on error' do
      allow(factory).to receive(:send_schema).and_raise(StandardError, 'Test error')

      expect {
        Rake::Task['forest_admin:update_schema'].invoke
      }.to raise_error(StandardError)

      expect(ForestAdminRails.config[:skip_schema_update]).to be true
    end
  end

  describe 'forest_admin:validate_schema' do
    context 'when schema file exists' do
      before do
        schema_path = ForestAdminRails.config[:schema_path]
        File.write(schema_path, { collections: [{}, {}] }.to_json)
      end

      after do
        schema_path = ForestAdminRails.config[:schema_path]
        File.delete(schema_path) if File.exist?(schema_path)
      end

      it 'validates successfully' do
        output = capture_stdout do
          Rake::Task['forest_admin:validate_schema'].invoke
        end

        expect(output).to include('Schema file found')
        expect(output).to include('Collections: 2')
      end
    end

    context 'when schema file missing' do
      before do
        schema_path = ForestAdminRails.config[:schema_path]
        File.delete(schema_path) if File.exist?(schema_path)
      end

      it 'exits with error' do
        expect {
          Rake::Task['forest_admin:validate_schema'].invoke
        }.to raise_error(SystemExit)
      end
    end
  end

  def capture_stdout
    original_stdout = $stdout
    $stdout = StringIO.new
    yield
    $stdout.string
  ensure
    $stdout = original_stdout
  end
end
```

---

## 📋 Implementation Checklist

### Phase 1: Configuration (Day 1 - Morning)

- [ ] Add `skip_schema_update` setting to ForestAdminRails config
- [ ] Add `schema_update_reason` setting to ForestAdminRails config
- [ ] Set default values (skip: false, reason: nil)
- [ ] Document configuration options

### Phase 2: Core Logic (Day 1 - Afternoon)

- [ ] Add `should_skip_schema_update?` private method to AgentFactory
- [ ] Add `log_schema_skip` private method to AgentFactory
- [ ] Update `send_schema` to check skip flag
- [ ] Add force parameter support
- [ ] Add enhanced logging (environment mode, success/failure)

### Phase 3: Health Check (Day 1 - Evening)

- [ ] Update HealthCheck route to respect skip flag
- [ ] Test health check behavior in production mode
- [ ] Test health check behavior with skip enabled

### Phase 4: Rake Tasks (Day 2 - Morning)

- [ ] Create `forest_admin:update_schema` task
- [ ] Create `forest_admin:validate_schema` task
- [ ] Create `forest_admin:show_config` task
- [ ] Test rake tasks

### Phase 5: Testing (Day 2 - Afternoon)

- [ ] Unit tests for AgentFactory (8 scenarios)
- [ ] Unit tests for HealthCheck (3 scenarios)
- [ ] Integration tests (3 scenarios)
- [ ] Rake task tests (4 scenarios)
- [ ] Test coverage >95%

### Phase 6: Documentation (Day 2 - Evening / Day 3)

- [ ] Document configuration options
- [ ] Create AWS Lambda example
- [ ] Create Kubernetes example (leader election)
- [ ] Create Kubernetes example (init container)
- [ ] Create blue-green deployment example
- [ ] Create read-only replica example
- [ ] Create CI/CD pipeline example
- [ ] Document rake tasks
- [ ] Update CHANGELOG
- [ ] Update API documentation

### Phase 7: Deployment (Day 3)

- [ ] Code review
- [ ] Test in staging environment
- [ ] Test with actual Lambda deployment
- [ ] Test with actual Kubernetes deployment
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Update parity report

**Total Estimated Time: 2-3 days**

---

## ✅ Acceptance Criteria

### Functional Requirements

- [ ] `skip_schema_update` configuration option works
- [ ] Default value is `false` (schema updates enabled)
- [ ] When set to `true`, schema update is skipped
- [ ] Schema still loaded from file for validation
- [ ] Skip reason logged when provided
- [ ] Default skip reason logged when not provided
- [ ] `force: true` parameter overrides skip flag
- [ ] Health check respects skip flag in production
- [ ] Rake task `update_schema` works
- [ ] Rake task `validate_schema` works
- [ ] Rake task `show_config` works

### Logging Requirements

- [ ] Skip logged with 'Warn' level
- [ ] Skip reason included in log message
- [ ] Environment mode logged (production/development)
- [ ] Schema update success logged
- [ ] Schema update failure logged
- [ ] Hash check warnings logged

### Error Handling

- [ ] Missing schema file handled gracefully
- [ ] Schema parse errors handled gracefully
- [ ] API errors logged but don't crash app
- [ ] Rake task errors properly raised

### Performance

- [ ] No additional overhead when skip disabled
- [ ] Faster startup when skip enabled (no API call)
- [ ] Force override still performant

### Testing

- [ ] Unit test coverage >95%
- [ ] Integration tests pass
- [ ] Rake task tests pass
- [ ] All edge cases covered

### Documentation

- [ ] Configuration options documented
- [ ] All use cases documented with examples
- [ ] Rake tasks documented
- [ ] Deployment strategies documented
- [ ] CHANGELOG updated

---

## 🚀 Deployment Strategies Summary

| Strategy | Use Case | Implementation | Pros | Cons |
|----------|----------|----------------|------|------|
| **Pre-Deployment Update** | CI/CD pipelines | Rake task in build step | Simple, explicit | Requires build pipeline |
| **Leader Election** | Kubernetes | Redis/etcd for coordination | Dynamic, no init containers | Requires coordination service |
| **Init Container** | Kubernetes | Init container runs task | Clean separation | Adds startup time |
| **Manual Update** | Serverless (Lambda) | Update before deploy | Full control | Manual step |
| **Environment Variable** | Any | `SKIP_SCHEMA_UPDATE=true` | Flexible | Requires environment management |

---

## 🎯 Success Metrics

**Track after deployment:**

1. **Skip Usage Rate**: % of deployments using skip flag
2. **Startup Time**: Improvement when skip enabled (expect ~2-5s faster)
3. **Schema Update Frequency**: Reduction in API calls
4. **Deployment Types**: Usage by environment (Lambda, K8s, etc.)
5. **Error Rate**: Schema-related errors (should remain same or decrease)
6. **Adoption**: Number of teams using skip feature

---

## 🔍 Troubleshooting Guide

### Issue 1: "Schema file not found"

**Symptoms:**
```
[ForestAdmin] Error: Schema file not found at .forestadmin-schema.json
```

**Solution:**
```bash
# Generate schema first
bundle exec rails forest_admin:update_schema

# Or ensure file is committed to git
git add .forestadmin-schema.json
git commit -m "Add Forest Admin schema"
```

---

### Issue 2: Schema out of sync with code

**Symptoms:**
- Fields missing in Forest Admin UI
- Actions not appearing
- Outdated collection names

**Solution:**
```bash
# Force update schema manually
bundle exec rails forest_admin:update_schema

# Or temporarily disable skip flag
# In config/initializers/forest_admin.rb
config.skip_schema_update = false

# Restart application
```

---

### Issue 3: Race conditions in Kubernetes

**Symptoms:**
- Multiple pods updating schema simultaneously
- Schema update errors in logs
- Inconsistent schema state

**Solution:**
Use leader election or init container (see examples above)

---

### Issue 4: Health check forcing schema update

**Symptoms:**
- Schema updated on every health check
- High API call rate
- Skip flag seems ignored

**Verification:**
```bash
# Check current configuration
bundle exec rails forest_admin:show_config

# Should show: Skip Schema Update: true
```

**Solution:**
- Ensure using latest version with health check fix
- Verify configuration loaded correctly

---

### Issue 5: Lambda cold starts still slow

**Symptoms:**
- Lambda functions take long to start
- Even with skip_schema_update enabled

**Investigation:**
```bash
# Check if schema file bundled in deployment
unzip -l function.zip | grep forestadmin-schema.json

# Should show: .forestadmin-schema.json
```

**Solution:**
- Ensure schema file included in deployment package
- Check Lambda package size (should include schema)

---

This implementation enables flexible schema management for diverse deployment scenarios while maintaining backward compatibility and production reliability! 🚀