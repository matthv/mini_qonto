# TODO 005-007: Configuration Enhancements - Implementation Guide
## Medium Priority (P2) - Forest Admin Agent Ruby

**Project:** mini_qonto
**Target Package:** forest_admin_agent + forest_admin_rails (via agent-ruby)
**Estimated Effort:** 1 week
**Priority:** P2 - Configuration granularity improvements

---

## 🎯 Executive Summary

Implement three missing configuration options from the Node.js agent to improve deployment flexibility, body size control, and feature rollout capabilities.

**Current Gaps:**

1. **Body Size Limits (TODO 005)** - Cannot configure request body size limits
2. **Experimental Feature Flags (TODO 006)** - No feature flag system for gradual rollouts
3. **Skip Schema Update (TODO 007)** - Cannot skip schema updates for cloud deployments

**Target Solutions:**

1. Configure max body size (default: 50MB) with middleware
2. Feature flag system for experimental features
3. Skip schema update flag for serverless/multi-instance deployments

**Use Cases:**

- **Body Size Limits:**
  - Prevent large payload attacks
  - Control memory usage
  - Enforce API limits

- **Feature Flags:**
  - Roll out experimental features gradually
  - A/B test new functionality
  - Quick feature toggles without deployment

- **Skip Schema Update:**
  - AWS Lambda deployments (ephemeral)
  - Kubernetes with multiple pods
  - Blue-green deployments
  - Read-only instances

---

## 📊 Node.js Reference Implementation

### Configuration Options (Node.js)

**File:** `agent-nodejs/packages/agent/src/types.ts`

```typescript
type AgentOptions = {
  // Body Size Limits
  maxBodySize?: string;              // Deprecated, use bodyParserOptions
  bodyParserOptions?: {
    jsonLimit?: number | string;     // Default: '50mb'
    enableRawChecking?: boolean;
  };

  // Experimental Features
  experimental?: {
    webhookCustomActions?: boolean;
    updateRecordCustomActions?: boolean;
  };

  // Schema Management
  skipSchemaUpdate?: boolean;         // Default: false
};
```

### Body Size Configuration (Node.js)

```typescript
// In agent.ts
router.use(bodyParser({
  encoding: 'utf-8',
  jsonLimit: options.bodyParserOptions?.jsonLimit || '50mb',
  parsedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  ...options.bodyParserOptions,
}));
```

### Experimental Flags (Node.js)

```typescript
// In schema generation
const meta = {
  experimental: {
    webhookCustomActions: options.experimental?.webhookCustomActions ?? false,
    updateRecordCustomActions: options.experimental?.updateRecordCustomActions ?? false,
  }
};

// Sent to frontend in schema
await forestAdminClient.postSchema({ ...schema, meta });
```

### Skip Schema Update (Node.js)

```typescript
protected async sendSchema(dataSource: DataSource) {
  if (this.options.skipSchemaUpdate) {
    this.options.logger('Warn', 'Schema update was skipped');
    return;
  }

  // ... schema generation and sending
}
```

---

## 🏗️ Implementation Architecture

### Overview

```
┌─────────────────────────────────────────────────┐
│  ForestAdminRails.configure                     │
│  - max_body_size: 50.megabytes                  │
│  - skip_schema_update: false                    │
│  - experimental: { ... }                        │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌──────────────┐      ┌──────────────┐
│ Body Size    │      │ Feature      │
│ Middleware   │      │ Flags        │
└──────┬───────┘      └──────┬───────┘
       │                     │
       ▼                     ▼
┌─────────────────────────────────────────────────┐
│  Request Processing                             │
│  - Check body size before parsing               │
│  - Feature flags checked at runtime             │
│  - Schema update skipped if flag set            │
└─────────────────────────────────────────────────┘
```

---

## 🔧 TODO 005: Body Size Limits

### Problem Statement

Rails default body size limits may be too permissive or not configurable enough. Large payloads can:
- Cause memory exhaustion
- Enable DoS attacks
- Slow down request processing

### Solution: Configurable Body Size Middleware

---

### File 1: Add Configuration Option

**Location:** `agent-ruby/packages/forest_admin_rails/lib/forest_admin_rails.rb`

```ruby
# frozen_string_literal: true

require 'dry-configurable'

module ForestAdminRails
  extend Dry::Configurable

  # ... existing settings ...

  # Body size limits (NEW)
  setting :max_body_size, default: 50.megabytes
  setting :enforce_body_size_limit, default: true

  # ... other settings ...
end
```

---

### File 2: Create Body Size Middleware

**Location:** `agent-ruby/packages/forest_admin_rails/lib/forest_admin_rails/middleware/body_size_limit.rb`

```ruby
# frozen_string_literal: true

module ForestAdminRails
  module Middleware
    class BodySizeLimit
      HTTP_METHODS_WITH_BODY = %w[POST PUT PATCH DELETE].freeze
      HEADER_CONTENT_LENGTH = 'CONTENT_LENGTH'.freeze

      def initialize(app, max_size: 50.megabytes)
        @app = app
        @max_size = max_size
      end

      def call(env)
        # Only check for methods that have a body
        return @app.call(env) unless HTTP_METHODS_WITH_BODY.include?(env['REQUEST_METHOD'])

        # Check Content-Length header
        content_length = env[HEADER_CONTENT_LENGTH]

        if content_length && content_length.to_i > @max_size
          return payload_too_large_response(content_length.to_i)
        end

        # Check actual body size during reading (for chunked encoding)
        original_input = env['rack.input']
        env['rack.input'] = BodySizeValidator.new(original_input, @max_size)

        @app.call(env)
      rescue BodySizeValidator::BodySizeExceededError => e
        payload_too_large_response(e.actual_size)
      end

      private

      def payload_too_large_response(actual_size)
        [
          413,
          {
            'Content-Type' => 'application/json',
            'X-Body-Size-Limit' => @max_size.to_s,
            'X-Actual-Body-Size' => actual_size.to_s
          },
          [
            {
              errors: [{
                name: 'PayloadTooLarge',
                detail: "Request body size (#{format_bytes(actual_size)}) exceeds maximum allowed size (#{format_bytes(@max_size)})",
                status: 413
              }]
            }.to_json
          ]
        ]
      end

      def format_bytes(bytes)
        if bytes < 1024
          "#{bytes} bytes"
        elsif bytes < 1024 * 1024
          "#{(bytes / 1024.0).round(2)} KB"
        else
          "#{(bytes / 1024.0 / 1024.0).round(2)} MB"
        end
      end
    end

    # Wrapper for rack.input that validates size during reading
    class BodySizeValidator
      class BodySizeExceededError < StandardError
        attr_reader :actual_size

        def initialize(actual_size)
          super("Body size exceeded: #{actual_size} bytes")
          @actual_size = actual_size
        end
      end

      def initialize(io, max_size)
        @io = io
        @max_size = max_size
        @bytes_read = 0
      end

      def read(length = nil, buffer = nil)
        data = @io.read(length, buffer)
        return data if data.nil?

        @bytes_read += data.bytesize

        if @bytes_read > @max_size
          raise BodySizeExceededError, @bytes_read
        end

        data
      end

      def gets
        line = @io.gets
        return line if line.nil?

        @bytes_read += line.bytesize

        if @bytes_read > @max_size
          raise BodySizeExceededError, @bytes_read
        end

        line
      end

      def each(&block)
        @io.each do |chunk|
          @bytes_read += chunk.bytesize

          if @bytes_read > @max_size
            raise BodySizeExceededError, @bytes_read
          end

          block.call(chunk)
        end
      end

      # Delegate other methods to underlying IO
      def rewind
        @io.rewind
        @bytes_read = 0
      end

      def size
        @io.size
      end

      def eof?
        @io.eof?
      end

      def close
        @io.close
      end
    end
  end
end
```

---

### File 3: Register Middleware in Engine

**Location:** `agent-ruby/packages/forest_admin_rails/lib/forest_admin_rails/engine.rb`

```ruby
# frozen_string_literal: true

module ForestAdminRails
  class Engine < ::Rails::Engine
    isolate_namespace ForestAdminRails

    # ... existing initializers ...

    # Body size limit middleware (NEW)
    initializer 'forest_admin_rails.body_size_limit' do |app|
      if ForestAdminRails.config[:enforce_body_size_limit]
        max_size = ForestAdminRails.config[:max_body_size]

        # Insert middleware early in the stack (after CORS)
        app.middleware.insert_after(
          Rack::Cors,
          ForestAdminRails::Middleware::BodySizeLimit,
          max_size: max_size
        )

        Rails.logger.info "[ForestAdmin] Body size limit enabled: #{max_size} bytes"
      end
    end

    # ... other initializers ...
  end
end
```

---

### Usage Example

```ruby
# config/initializers/forest_admin.rb
ForestAdminRails.configure do |config|
  config.auth_secret = ENV['FOREST_AUTH_SECRET']
  config.env_secret = ENV['FOREST_ENV_SECRET']

  # Body size configuration
  config.max_body_size = 10.megabytes  # Limit to 10MB
  config.enforce_body_size_limit = true

  # Or disable limit entirely (not recommended)
  # config.enforce_body_size_limit = false
end
```

---

### Testing TODO 005

**Location:** `spec/middleware/body_size_limit_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe ForestAdminRails::Middleware::BodySizeLimit do
  let(:app) { ->(env) { [200, {}, ['OK']] } }
  let(:middleware) { described_class.new(app, max_size: 1024) } # 1KB limit

  describe '#call' do
    context 'with GET request' do
      it 'does not check body size' do
        env = Rack::MockRequest.env_for('/', method: 'GET')
        status, _headers, _body = middleware.call(env)

        expect(status).to eq(200)
      end
    end

    context 'with POST request under limit' do
      it 'allows request' do
        body = 'a' * 512 # 512 bytes
        env = Rack::MockRequest.env_for(
          '/',
          method: 'POST',
          'CONTENT_LENGTH' => body.bytesize.to_s,
          'rack.input' => StringIO.new(body)
        )

        status, _headers, _body = middleware.call(env)
        expect(status).to eq(200)
      end
    end

    context 'with POST request over limit via Content-Length' do
      it 'returns 413 Payload Too Large' do
        env = Rack::MockRequest.env_for(
          '/',
          method: 'POST',
          'CONTENT_LENGTH' => '2048' # 2KB > 1KB limit
        )

        status, headers, body = middleware.call(env)

        expect(status).to eq(413)
        expect(headers['Content-Type']).to eq('application/json')
        expect(headers['X-Body-Size-Limit']).to eq('1024')
        expect(headers['X-Actual-Body-Size']).to eq('2048')

        response = JSON.parse(body.first)
        expect(response['errors'][0]['status']).to eq(413)
        expect(response['errors'][0]['detail']).to include('exceeds maximum')
      end
    end

    context 'with POST request over limit during streaming' do
      it 'raises error when body read exceeds limit' do
        large_body = 'a' * 2048 # 2KB > 1KB limit
        env = Rack::MockRequest.env_for(
          '/',
          method: 'POST',
          'rack.input' => StringIO.new(large_body)
        )

        # Don't set Content-Length to simulate chunked encoding
        env.delete('CONTENT_LENGTH')

        status, _headers, body = middleware.call(env)

        expect(status).to eq(413)
        response = JSON.parse(body.first)
        expect(response['errors'][0]['detail']).to include('exceeds maximum')
      end
    end

    context 'with PUT request' do
      it 'checks body size' do
        env = Rack::MockRequest.env_for(
          '/',
          method: 'PUT',
          'CONTENT_LENGTH' => '2048'
        )

        status, _headers, _body = middleware.call(env)
        expect(status).to eq(413)
      end
    end

    context 'with PATCH request' do
      it 'checks body size' do
        env = Rack::MockRequest.env_for(
          '/',
          method: 'PATCH',
          'CONTENT_LENGTH' => '2048'
        )

        status, _headers, _body = middleware.call(env)
        expect(status).to eq(413)
      end
    end

    context 'with DELETE request' do
      it 'checks body size' do
        env = Rack::MockRequest.env_for(
          '/',
          method: 'DELETE',
          'CONTENT_LENGTH' => '2048'
        )

        status, _headers, _body = middleware.call(env)
        expect(status).to eq(413)
      end
    end
  end
end

RSpec.describe ForestAdminRails::Middleware::BodySizeValidator do
  let(:io) { StringIO.new('a' * 100) }
  let(:validator) { described_class.new(io, 50) } # 50 byte limit

  describe '#read' do
    it 'allows reading under limit' do
      data = validator.read(25)
      expect(data).to eq('a' * 25)
    end

    it 'raises when reading over limit' do
      expect { validator.read(60) }.to raise_error(
        described_class::BodySizeExceededError
      )
    end

    it 'tracks cumulative reads' do
      validator.read(25)
      validator.read(20)

      expect { validator.read(10) }.to raise_error(
        described_class::BodySizeExceededError
      )
    end
  end

  describe '#gets' do
    let(:io) { StringIO.new("line1\nline2\nline3\n") }

    it 'allows reading lines under limit' do
      line = validator.read
      expect(line).to eq("line1\n")
    end

    it 'raises when cumulative size exceeds limit' do
      validator.gets
      validator.gets

      expect { validator.gets }.to raise_error(
        described_class::BodySizeExceededError
      )
    end
  end

  describe '#rewind' do
    it 'resets byte counter' do
      validator.read(30)
      validator.rewind
      data = validator.read(30)

      expect(data).to eq('a' * 30)
    end
  end
end
```

---

## 🔧 TODO 006: Experimental Feature Flags

### Problem Statement

No system for gradually rolling out experimental features. Need ability to:
- Enable/disable features without code changes
- Communicate feature availability to frontend
- A/B test new functionality

### Solution: Feature Flag Configuration System

---

### File 1: Add Experimental Configuration

**Location:** `agent-ruby/packages/forest_admin_rails/lib/forest_admin_rails.rb`

```ruby
# frozen_string_literal: true

module ForestAdminRails
  extend Dry::Configurable

  # ... existing settings ...

  # Experimental features (NEW)
  setting :experimental, default: {
    webhook_custom_actions: false,
    update_record_custom_actions: false,
    streaming_csv_export: false,
    file_custom_actions: false,
    advanced_filters: false,
    bulk_actions_v2: false
  }

  # ... other settings ...
end
```

---

### File 2: Feature Flag Service

**Location:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/services/feature_flags.rb`

```ruby
# frozen_string_literal: true

module ForestAdminAgent
  module Services
    class FeatureFlags
      class << self
        # Check if a feature is enabled
        # @param feature_name [Symbol, String] Feature name
        # @return [Boolean]
        def enabled?(feature_name)
          feature_key = normalize_feature_name(feature_name)
          experimental_config.fetch(feature_key, false)
        end

        # Check if a feature is disabled
        # @param feature_name [Symbol, String] Feature name
        # @return [Boolean]
        def disabled?(feature_name)
          !enabled?(feature_name)
        end

        # Get all enabled features
        # @return [Array<Symbol>]
        def enabled_features
          experimental_config.select { |_key, value| value == true }.keys
        end

        # Get all disabled features
        # @return [Array<Symbol>]
        def disabled_features
          experimental_config.reject { |_key, value| value == true }.keys
        end

        # Get all features and their status
        # @return [Hash]
        def all_features
          experimental_config.dup
        end

        # Execute block only if feature is enabled
        # @param feature_name [Symbol, String]
        # @yield Block to execute if feature enabled
        # @return [Object, nil] Block result or nil if disabled
        def with_feature(feature_name, &block)
          return unless enabled?(feature_name)

          block.call
        end

        # Execute block with feature flag check, raise error if disabled
        # @param feature_name [Symbol, String]
        # @raise [FeatureDisabledError] If feature is disabled
        def require_feature!(feature_name)
          return if enabled?(feature_name)

          raise FeatureDisabledError, "Feature '#{feature_name}' is not enabled"
        end

        private

        def experimental_config
          Facades::Container.cache(:experimental) || {}
        end

        def normalize_feature_name(name)
          name.to_s.underscore.to_sym
        end
      end

      class FeatureDisabledError < StandardError; end
    end
  end
end
```

---

### File 3: Include Feature Flags in Schema Metadata

**Location:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/builder/schema_emitter.rb`

```ruby
# frozen_string_literal: true

module ForestAdminAgent
  module Builder
    class SchemaEmitter
      # ... existing code ...

      # Generate schema metadata (NEW)
      def self.meta
        {
          liana: 'forest-ruby',
          liana_version: ForestAdminAgent::VERSION,
          stack: {
            engine: 'ruby',
            engine_version: RUBY_VERSION
          },
          experimental: build_experimental_metadata
        }
      end

      # Build experimental features metadata
      def self.build_experimental_metadata
        Services::FeatureFlags.all_features
      end

      # ... existing code ...
    end
  end
end
```

---

### File 4: Update Schema Sending to Include Metadata

**Location:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/builder/agent_factory.rb`

```ruby
def send_schema(force: false)
  # ... existing schema loading code ...

  # Build metadata (NEW)
  metadata = ForestAdminAgent::Builder::SchemaEmitter.meta

  # Merge metadata with schema
  schema_with_meta = schema.merge(meta: metadata)

  # Send to ForestAdmin
  post_schema(schema_with_meta, force)
end
```

---

### Usage Examples

```ruby
# config/initializers/forest_admin.rb
ForestAdminRails.configure do |config|
  # Enable experimental features
  config.experimental = {
    webhook_custom_actions: true,      # Enable webhooks
    file_custom_actions: true,         # Enable file actions
    streaming_csv_export: false,       # Keep disabled
    advanced_filters: Rails.env.production? # Conditional
  }
end
```

**In Action Code:**

```ruby
# Check feature flag before using experimental feature
collection.add_action('Send Webhook', {
  scope: 'Single',
  execute: lambda { |context, result_builder|
    # Require feature to be enabled
    ForestAdminAgent::Services::FeatureFlags.require_feature!(:webhook_custom_actions)

    # Execute webhook
    result_builder.webhook(
      'https://example.com/webhook',
      body: context.build_webhook_payload
    )
  }
})
```

**Conditional Feature Implementation:**

```ruby
# Only add action if feature enabled
if ForestAdminAgent::Services::FeatureFlags.enabled?(:advanced_filters)
  collection.add_action('Advanced Search', {
    # ... action definition
  })
end
```

**Feature-Gated Route:**

```ruby
def handle_request(args = {})
  # Check feature flag
  ForestAdminAgent::Services::FeatureFlags.require_feature!(:bulk_actions_v2)

  # ... handle request
end
```

---

### Testing TODO 006

**Location:** `spec/services/feature_flags_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe ForestAdminAgent::Services::FeatureFlags do
  before do
    # Set up test feature flags
    allow(ForestAdminAgent::Facades::Container).to receive(:cache)
      .with(:experimental)
      .and_return({
        webhook_custom_actions: true,
        file_custom_actions: false,
        streaming_csv_export: true
      })
  end

  describe '.enabled?' do
    it 'returns true for enabled feature' do
      expect(described_class.enabled?(:webhook_custom_actions)).to be true
    end

    it 'returns false for disabled feature' do
      expect(described_class.enabled?(:file_custom_actions)).to be false
    end

    it 'returns false for non-existent feature' do
      expect(described_class.enabled?(:non_existent_feature)).to be false
    end

    it 'accepts string feature names' do
      expect(described_class.enabled?('webhook_custom_actions')).to be true
    end

    it 'accepts camelCase feature names' do
      expect(described_class.enabled?('webhookCustomActions')).to be true
    end
  end

  describe '.disabled?' do
    it 'returns true for disabled feature' do
      expect(described_class.disabled?(:file_custom_actions)).to be true
    end

    it 'returns false for enabled feature' do
      expect(described_class.disabled?(:webhook_custom_actions)).to be false
    end
  end

  describe '.enabled_features' do
    it 'returns array of enabled features' do
      enabled = described_class.enabled_features

      expect(enabled).to contain_exactly(:webhook_custom_actions, :streaming_csv_export)
    end
  end

  describe '.disabled_features' do
    it 'returns array of disabled features' do
      disabled = described_class.disabled_features

      expect(disabled).to contain_exactly(:file_custom_actions)
    end
  end

  describe '.all_features' do
    it 'returns hash of all features and their status' do
      features = described_class.all_features

      expect(features).to eq({
        webhook_custom_actions: true,
        file_custom_actions: false,
        streaming_csv_export: true
      })
    end
  end

  describe '.with_feature' do
    it 'executes block if feature enabled' do
      result = described_class.with_feature(:webhook_custom_actions) do
        'executed'
      end

      expect(result).to eq('executed')
    end

    it 'does not execute block if feature disabled' do
      result = described_class.with_feature(:file_custom_actions) do
        'should not execute'
      end

      expect(result).to be_nil
    end
  end

  describe '.require_feature!' do
    it 'does not raise if feature enabled' do
      expect {
        described_class.require_feature!(:webhook_custom_actions)
      }.not_to raise_error
    end

    it 'raises if feature disabled' do
      expect {
        described_class.require_feature!(:file_custom_actions)
      }.to raise_error(described_class::FeatureDisabledError, /not enabled/)
    end
  end
end
```

---

## 🔧 TODO 007: Skip Schema Update

### Problem Statement

In certain deployment scenarios, schema updates should be skipped:
- **Serverless (AWS Lambda):** Ephemeral instances, schema already uploaded
- **Kubernetes:** Multiple pods starting simultaneously
- **Blue-Green Deployments:** Old version still running
- **Read-Only Instances:** Secondary instances shouldn't update schema

### Solution: Skip Schema Update Configuration Flag

---

### File 1: Add Configuration Option

**Location:** `agent-ruby/packages/forest_admin_rails/lib/forest_admin_rails.rb`

```ruby
# frozen_string_literal: true

module ForestAdminRails
  extend Dry::Configurable

  # ... existing settings ...

  # Schema management (NEW)
  setting :skip_schema_update, default: false
  setting :schema_update_reason, default: nil # Optional: log reason for skip

  # ... other settings ...
end
```

---

### File 2: Update Schema Sending Logic

**Location:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/builder/agent_factory.rb`

```ruby
def send_schema(force: false)
  # Check if schema update should be skipped (NEW)
  if should_skip_schema_update? && !force
    log_schema_skip
    return
  end

  return unless @has_env_secret

  # ... existing schema loading and sending code ...
end

private

# Check if schema update should be skipped (NEW)
def should_skip_schema_update?
  Facades::Container.cache(:skip_schema_update) == true
end

# Log schema skip with reason (NEW)
def log_schema_skip
  reason = Facades::Container.cache(:schema_update_reason) || 'skip_schema_update flag is true'

  @logger.log(
    'Warn',
    "[ForestAdmin] Schema update skipped: #{reason}"
  )
end
```

---

### File 3: Health Check Behavior

**Location:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/routes/system/health_check.rb`

```ruby
def handle_request(_args = {})
  # In production, force schema send unless explicitly skipped (UPDATED)
  if Facades::Container.cache(:is_production) && !Facades::Container.cache(:skip_schema_update)
    AgentFactory.instance.send_schema(force: true)
  end

  { content: nil, status: 204 }
end
```

---

### Usage Examples

**Example 1: AWS Lambda Deployment**

```ruby
# config/initializers/forest_admin.rb
ForestAdminRails.configure do |config|
  config.auth_secret = ENV['FOREST_AUTH_SECRET']
  config.env_secret = ENV['FOREST_ENV_SECRET']

  # Skip schema update in Lambda (ephemeral instances)
  config.skip_schema_update = true
  config.schema_update_reason = 'AWS Lambda ephemeral instance'
end
```

**Example 2: Kubernetes with Init Container**

```ruby
# Schema updated by init container, skip in main pods
config.skip_schema_update = ENV['FOREST_SCHEMA_UPDATED_BY_INIT'] == 'true'
config.schema_update_reason = 'Schema updated by init container'
```

**Example 3: Blue-Green Deployment**

```ruby
# Skip schema update for blue (old) instances during deployment
config.skip_schema_update = ENV['DEPLOYMENT_COLOR'] == 'blue'
config.schema_update_reason = 'Blue-green deployment: keeping old schema'
```

**Example 4: Read-Only Replica**

```ruby
# Skip schema update for read replicas
config.skip_schema_update = ENV['INSTANCE_ROLE'] == 'replica'
config.schema_update_reason = 'Read-only replica instance'
```

**Example 5: Local Development (Conditional)**

```ruby
# Skip schema update in development if not needed
config.skip_schema_update = Rails.env.development? && ENV['FOREST_SKIP_SCHEMA'] == 'true'
```

---

### Schema Update Strategies

#### Strategy 1: Single Leader Election (Kubernetes)

```ruby
# lib/forest_admin/leader_elector.rb
class ForestAdminLeaderElector
  def self.leader?
    # Use Redis, database, or Kubernetes API to elect leader
    redis = Redis.new(url: ENV['REDIS_URL'])
    redis.set('forest_schema_leader', Process.pid, nx: true, ex: 60)
  end
end

# config/initializers/forest_admin.rb
config.skip_schema_update = !ForestAdminLeaderElector.leader?
config.schema_update_reason = 'Not elected as schema update leader'
```

#### Strategy 2: Init Container (Kubernetes)

```yaml
# kubernetes/deployment.yaml
initContainers:
  - name: forest-schema-update
    image: your-app:latest
    command: ['rails', 'forest_admin:update_schema']
    env:
      - name: FOREST_ENV_SECRET
        valueFrom:
          secretKeyRef:
            name: forest-admin
            key: env-secret
```

```ruby
# lib/tasks/forest_admin.rake
namespace :forest_admin do
  desc 'Update Forest Admin schema'
  task update_schema: :environment do
    # Force schema update
    ForestAdminAgent::Builder::AgentFactory.instance.send_schema(force: true)
    puts 'Forest Admin schema updated successfully'
  end
end
```

#### Strategy 3: Manual Schema Update Script

```ruby
# scripts/update_forest_schema.rb
#!/usr/bin/env ruby
require_relative '../config/environment'

# Configure without skipping
ForestAdminRails.config[:skip_schema_update] = false

# Force update
ForestAdminAgent::Builder::AgentFactory.instance.send_schema(force: true)

puts 'Schema updated successfully'
```

Run before deployment:
```bash
bundle exec ruby scripts/update_forest_schema.rb
```

---

### Testing TODO 007

**Location:** `spec/builder/agent_factory_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe ForestAdminAgent::Builder::AgentFactory do
  let(:factory) { described_class.instance }

  before do
    allow(ForestAdminAgent::Facades::Container).to receive(:cache)
      .and_call_original
  end

  describe '#send_schema' do
    context 'with skip_schema_update enabled' do
      before do
        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:skip_schema_update)
          .and_return(true)

        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:schema_update_reason)
          .and_return('Test skip reason')
      end

      it 'skips schema update' do
        expect(factory).not_to receive(:post_schema)

        factory.send_schema
      end

      it 'logs skip warning' do
        expect(factory.instance_variable_get(:@logger)).to receive(:log)
          .with('Warn', include('Schema update skipped'))

        factory.send_schema
      end

      it 'includes skip reason in log' do
        expect(factory.instance_variable_get(:@logger)).to receive(:log)
          .with('Warn', include('Test skip reason'))

        factory.send_schema
      end
    end

    context 'with skip_schema_update enabled but force flag' do
      before do
        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:skip_schema_update)
          .and_return(true)
      end

      it 'sends schema when forced' do
        expect(factory).to receive(:post_schema)

        factory.send_schema(force: true)
      end
    end

    context 'with skip_schema_update disabled' do
      before do
        allow(ForestAdminAgent::Facades::Container).to receive(:cache)
          .with(:skip_schema_update)
          .and_return(false)
      end

      it 'sends schema normally' do
        expect(factory).to receive(:post_schema)

        factory.send_schema
      end
    end
  end
end
```

---

## 📋 Combined Implementation Checklist

### Phase 1: Core Implementation (Days 1-3)

**TODO 005: Body Size Limits**
- [ ] Add `max_body_size` configuration option
- [ ] Add `enforce_body_size_limit` flag
- [ ] Create `BodySizeLimit` middleware
- [ ] Create `BodySizeValidator` wrapper
- [ ] Register middleware in engine
- [ ] Add error response formatting
- [ ] Add byte formatting helper

**TODO 006: Feature Flags**
- [ ] Add `experimental` configuration hash
- [ ] Create `FeatureFlags` service
- [ ] Implement `enabled?` / `disabled?` methods
- [ ] Implement `with_feature` helper
- [ ] Implement `require_feature!` validation
- [ ] Add feature flags to schema metadata
- [ ] Update schema emission to include flags

**TODO 007: Skip Schema Update**
- [ ] Add `skip_schema_update` configuration flag
- [ ] Add `schema_update_reason` optional config
- [ ] Update `send_schema` to check flag
- [ ] Add skip logging
- [ ] Update health check behavior
- [ ] Document deployment strategies

### Phase 2: Testing (Days 3-4)

**TODO 005 Tests:**
- [ ] Middleware: GET request (no check)
- [ ] Middleware: POST under limit
- [ ] Middleware: POST over limit (Content-Length)
- [ ] Middleware: POST over limit (streaming)
- [ ] Middleware: PUT/PATCH/DELETE methods
- [ ] Validator: Read under limit
- [ ] Validator: Read over limit
- [ ] Validator: Cumulative reads
- [ ] Validator: Rewind behavior

**TODO 006 Tests:**
- [ ] enabled? with enabled feature
- [ ] enabled? with disabled feature
- [ ] disabled? method
- [ ] enabled_features list
- [ ] disabled_features list
- [ ] all_features hash
- [ ] with_feature execution
- [ ] require_feature! validation
- [ ] Feature name normalization

**TODO 007 Tests:**
- [ ] Skip schema update when flag true
- [ ] Force schema update overrides flag
- [ ] Schema update when flag false
- [ ] Skip reason logging
- [ ] Health check respects flag

### Phase 3: Documentation (Days 4-5)

- [ ] Document `max_body_size` configuration
- [ ] Document body size error format
- [ ] Document feature flag usage patterns
- [ ] Document all experimental features
- [ ] Document skip schema update use cases
- [ ] Document deployment strategies
- [ ] Create examples for each configuration
- [ ] Update CHANGELOG
- [ ] Update API documentation

### Phase 4: Integration & Deployment (Days 5-7)

- [ ] Integration test: Body size rejection
- [ ] Integration test: Feature flags in actions
- [ ] Integration test: Schema skip in production
- [ ] Test with Kubernetes deployment
- [ ] Test with AWS Lambda
- [ ] Test with blue-green deployment
- [ ] Deploy to staging
- [ ] Monitor for issues
- [ ] Deploy to production
- [ ] Update parity report

---

## ✅ Acceptance Criteria

### TODO 005: Body Size Limits

**Functional:**
- [ ] Configuration option `max_body_size` works
- [ ] Default limit is 50MB
- [ ] Requests over limit return 413
- [ ] GET requests not checked
- [ ] POST/PUT/PATCH/DELETE checked
- [ ] Content-Length header checked
- [ ] Streaming body checked
- [ ] Error response includes size info
- [ ] Middleware can be disabled

**Error Handling:**
- [ ] 413 status code correct
- [ ] Error message clear and helpful
- [ ] Actual vs max size included in response
- [ ] Headers include size information

**Performance:**
- [ ] Minimal overhead for small requests
- [ ] Early rejection via Content-Length
- [ ] Streaming validation efficient

### TODO 006: Feature Flags

**Functional:**
- [ ] Configuration option `experimental` works
- [ ] Feature flags included in schema metadata
- [ ] `FeatureFlags.enabled?` works correctly
- [ ] `FeatureFlags.require_feature!` raises when disabled
- [ ] Feature flags communicated to frontend
- [ ] Can enable/disable without code changes
- [ ] Flag changes reflected in schema

**API:**
- [ ] All query methods work (enabled?, disabled?, etc.)
- [ ] Feature name normalization works
- [ ] Helper methods work as expected

### TODO 007: Skip Schema Update

**Functional:**
- [ ] Configuration option `skip_schema_update` works
- [ ] Schema update skipped when flag true
- [ ] Schema update forced with `force: true`
- [ ] Skip reason logged
- [ ] Health check respects flag
- [ ] Works in production mode

**Documentation:**
- [ ] Deployment strategies documented
- [ ] Use cases explained
- [ ] Examples provided

---

## 🎯 Success Metrics

**Post-deployment tracking:**

**TODO 005:**
1. 413 error rate (should be low, <0.1%)
2. Average request body size
3. Max body sizes seen
4. Configuration usage

**TODO 006:**
1. Number of experimental features enabled
2. Feature flag changes per deployment
3. Feature adoption rates

**TODO 007:**
1. % of deployments using skip flag
2. Schema update frequency
3. Deployment types (Lambda, K8s, etc.)

---

## 🚀 Deployment Scenarios

### AWS Lambda

```ruby
# config/initializers/forest_admin.rb
ForestAdminRails.configure do |config|
  # Standard config
  config.auth_secret = ENV['FOREST_AUTH_SECRET']
  config.env_secret = ENV['FOREST_ENV_SECRET']

  # Lambda-specific
  config.skip_schema_update = true
  config.schema_update_reason = 'AWS Lambda ephemeral instance'
  config.max_body_size = 6.megabytes # API Gateway limit
end
```

### Kubernetes with Multiple Pods

```ruby
# Use leader election
config.skip_schema_update = ENV['POD_NAME'] != elect_schema_leader
config.schema_update_reason = "Not schema leader (current: #{ENV['POD_NAME']})"

# Or use init container pattern
config.skip_schema_update = ENV['SCHEMA_UPDATED_BY_INIT'] == 'true'
```

### Development Environment

```ruby
if Rails.env.development?
  config.max_body_size = 100.megabytes # More permissive
  config.skip_schema_update = false # Always update
  config.experimental = {
    webhook_custom_actions: true,
    file_custom_actions: true,
    streaming_csv_export: true,
    advanced_filters: true
  }
end
```

---

These three configuration enhancements improve deployment flexibility and bring the Ruby agent closer to Node.js feature parity!