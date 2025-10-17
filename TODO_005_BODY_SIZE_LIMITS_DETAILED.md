# TODO 005: Body Size Limits - Implementation Guide
## Medium Priority (P2) - Forest Admin Agent Ruby

**Project:** mini_qonto
**Target Package:** forest_admin_rails (via agent-ruby)
**Estimated Effort:** 2-3 days
**Priority:** P2 - Security and resource management

---

## 🎯 Executive Summary

Implement configurable request body size limits to prevent memory exhaustion, DoS attacks, and control resource usage in production environments.

**Current Gap:**
- No configurable body size limits
- Rails default limits may be too permissive
- Cannot enforce API-level size restrictions
- Risk of memory exhaustion from large payloads

**Target Solution:**
- Configurable `max_body_size` (default: 50MB)
- Middleware that validates Content-Length header
- Streaming body size validation for chunked requests
- Returns 413 Payload Too Large with clear error messages
- Can be disabled entirely if needed

**Use Cases:**
- Prevent DoS attacks via large payloads
- Enforce API Gateway limits (AWS: 6MB, GCP: 32MB)
- Control memory usage in memory-constrained environments
- Provide clear feedback to API consumers
- Different limits per environment (dev vs prod)

---

## 📊 Node.js Reference Implementation

### Configuration (Node.js)

**File:** `agent-nodejs/packages/agent/src/types.ts`

```typescript
type AgentOptions = {
  // Legacy option (deprecated)
  maxBodySize?: string;  // e.g., '50mb'

  // New option (recommended)
  bodyParserOptions?: {
    jsonLimit?: number | string;     // Default: '50mb'
    enableRawChecking?: boolean;
  };
};
```

### Body Parser Middleware (Node.js)

**File:** `agent-nodejs/packages/agent/src/agent.ts`

```typescript
// Using @koa/bodyparser
router.use(bodyParser({
  encoding: 'utf-8',
  jsonLimit: options.bodyParserOptions?.jsonLimit || '50mb',
  parsedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  ...options.bodyParserOptions,
}));
```

### Behavior:
- Checks body size before parsing
- Returns 413 if body exceeds limit
- Only applies to POST, PUT, PATCH, DELETE
- Default: 50MB

---

## 🏗️ Ruby Implementation Architecture

### Flow Diagram

```
┌─────────────────────────────────────────────────┐
│  HTTP Request (POST/PUT/PATCH/DELETE)           │
│  Headers: Content-Length: 75000000             │
│  Body: ... large payload ...                    │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Rack Middleware Stack                          │
│  1. Rack::Cors                                  │
│  2. BodySizeLimit ← NEW                         │
│  3. Rails BodyParser                            │
│  4. ForestAdmin Routes                          │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌──────────────┐      ┌──────────────┐
│ Check        │      │ Check        │
│ Content-     │      │ Streaming    │
│ Length       │      │ Body Size    │
│ Header       │      │ (Chunked)    │
└──────┬───────┘      └──────┬───────┘
       │                     │
       │ > limit            │ > limit
       ▼                     ▼
┌─────────────────────────────────────────────────┐
│  Return 413 Payload Too Large                   │
│  {                                              │
│    errors: [{                                   │
│      name: "PayloadTooLarge",                   │
│      detail: "Request body size (75 MB)         │
│               exceeds maximum (50 MB)",         │
│      status: 413                                │
│    }]                                           │
│  }                                              │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Details

### File 1: Configuration Options

**Location:** `agent-ruby/packages/forest_admin_rails/lib/forest_admin_rails.rb`

```ruby
# frozen_string_literal: true

require 'dry-configurable'

module ForestAdminRails
  extend Dry::Configurable

  # Existing settings
  setting :debug, default: true
  setting :auth_secret
  setting :env_secret
  setting :forest_server_url, default: ENV.fetch('FOREST_SERVER_URL', 'https://api.forestadmin.com')
  setting :is_production, default: Rails.env.production?
  setting :prefix, default: nil
  setting :permission_expiration, default: 900
  setting :cache_dir, default: :'tmp/cache/forest_admin'
  setting :schema_path, default: File.join(Dir.pwd, '.forestadmin-schema.json')
  setting :project_dir, default: Dir.pwd
  setting :logger_level, default: 'info'
  setting :logger, default: nil
  setting :customize_error_message, default: nil
  setting :instant_cache_refresh, default: Rails.env.production?
  setting :limit_export_size, default: nil
  setting :append_schema_path, default: nil

  # Body size limit settings (NEW)
  setting :max_body_size, default: 50.megabytes
  setting :enforce_body_size_limit, default: true
end
```

**Key Points:**
- `max_body_size`: Maximum request body size in bytes (default: 50MB)
- `enforce_body_size_limit`: Enable/disable middleware (default: true)
- Uses ActiveSupport's `.megabytes` helper for readability

---

### File 2: Body Size Limit Middleware

**Location:** `agent-ruby/packages/forest_admin_rails/lib/forest_admin_rails/middleware/body_size_limit.rb`

```ruby
# frozen_string_literal: true

module ForestAdminRails
  module Middleware
    # Middleware to enforce request body size limits
    class BodySizeLimit
      # HTTP methods that typically have a request body
      HTTP_METHODS_WITH_BODY = %w[POST PUT PATCH DELETE].freeze

      # Rack environment key for Content-Length header
      HEADER_CONTENT_LENGTH = 'CONTENT_LENGTH'.freeze

      # @param app [Object] Rack application
      # @param max_size [Integer] Maximum body size in bytes
      def initialize(app, max_size: 50.megabytes)
        @app = app
        @max_size = max_size
      end

      # Process the request
      # @param env [Hash] Rack environment
      # @return [Array] Rack response tuple [status, headers, body]
      def call(env)
        # Only check methods that have a body
        return @app.call(env) unless should_check_body_size?(env)

        # First check: Content-Length header (early rejection)
        if content_length_exceeds_limit?(env)
          return payload_too_large_response(env[HEADER_CONTENT_LENGTH].to_i)
        end

        # Second check: Wrap rack.input to validate during streaming
        # (handles chunked encoding where Content-Length may be missing)
        original_input = env['rack.input']
        env['rack.input'] = BodySizeValidator.new(original_input, @max_size)

        @app.call(env)
      rescue BodySizeValidator::BodySizeExceededError => e
        # Body size exceeded during streaming read
        payload_too_large_response(e.actual_size)
      end

      private

      # Check if body size should be validated for this request
      # @param env [Hash] Rack environment
      # @return [Boolean]
      def should_check_body_size?(env)
        HTTP_METHODS_WITH_BODY.include?(env['REQUEST_METHOD'])
      end

      # Check if Content-Length header exceeds limit
      # @param env [Hash] Rack environment
      # @return [Boolean]
      def content_length_exceeds_limit?(env)
        content_length = env[HEADER_CONTENT_LENGTH]
        return false unless content_length

        content_length.to_i > @max_size
      end

      # Generate 413 Payload Too Large response
      # @param actual_size [Integer] Actual body size in bytes
      # @return [Array] Rack response tuple
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
                detail: build_error_message(actual_size),
                status: 413,
                data: {
                  max_size_bytes: @max_size,
                  actual_size_bytes: actual_size,
                  max_size_human: format_bytes(@max_size),
                  actual_size_human: format_bytes(actual_size)
                }
              }]
            }.to_json
          ]
        ]
      end

      # Build human-readable error message
      # @param actual_size [Integer] Actual body size
      # @return [String]
      def build_error_message(actual_size)
        "Request body size (#{format_bytes(actual_size)}) " \
        "exceeds maximum allowed size (#{format_bytes(@max_size)})"
      end

      # Format bytes as human-readable string
      # @param bytes [Integer] Size in bytes
      # @return [String] Formatted size (e.g., "50.5 MB")
      def format_bytes(bytes)
        if bytes < 1024
          "#{bytes} bytes"
        elsif bytes < 1024 * 1024
          "#{(bytes / 1024.0).round(2)} KB"
        elsif bytes < 1024 * 1024 * 1024
          "#{(bytes / 1024.0 / 1024.0).round(2)} MB"
        else
          "#{(bytes / 1024.0 / 1024.0 / 1024.0).round(2)} GB"
        end
      end
    end

    # Wrapper for rack.input that validates size during reading
    class BodySizeValidator
      # Error raised when body size exceeds limit
      class BodySizeExceededError < StandardError
        attr_reader :actual_size

        # @param actual_size [Integer] Size in bytes when error occurred
        def initialize(actual_size)
          super("Body size exceeded limit: #{actual_size} bytes")
          @actual_size = actual_size
        end
      end

      # @param io [IO] Original rack.input stream
      # @param max_size [Integer] Maximum allowed size in bytes
      def initialize(io, max_size)
        @io = io
        @max_size = max_size
        @bytes_read = 0
      end

      # Read data from stream
      # @param length [Integer, nil] Number of bytes to read
      # @param buffer [String, nil] Buffer to read into
      # @return [String, nil] Data read
      # @raise [BodySizeExceededError] If cumulative size exceeds limit
      def read(length = nil, buffer = nil)
        data = @io.read(length, buffer)
        return data if data.nil?

        track_bytes_read(data.bytesize)
        data
      end

      # Read a line from stream
      # @return [String, nil] Line read
      # @raise [BodySizeExceededError] If cumulative size exceeds limit
      def gets
        line = @io.gets
        return line if line.nil?

        track_bytes_read(line.bytesize)
        line
      end

      # Iterate over chunks
      # @yield [String] Each chunk
      # @raise [BodySizeExceededError] If cumulative size exceeds limit
      def each(&block)
        @io.each do |chunk|
          track_bytes_read(chunk.bytesize)
          block.call(chunk)
        end
      end

      # Rewind the stream
      def rewind
        @io.rewind
        @bytes_read = 0
      end

      # Get stream size if available
      # @return [Integer, nil]
      def size
        @io.size if @io.respond_to?(:size)
      end

      # Check if at end of stream
      # @return [Boolean]
      def eof?
        @io.eof?
      end

      # Close the stream
      def close
        @io.close if @io.respond_to?(:close)
      end

      private

      # Track bytes read and check limit
      # @param bytes [Integer] Number of bytes to add
      # @raise [BodySizeExceededError] If limit exceeded
      def track_bytes_read(bytes)
        @bytes_read += bytes

        if @bytes_read > @max_size
          raise BodySizeExceededError, @bytes_read
        end
      end
    end
  end
end
```

**Key Features:**

1. **Early Rejection:**
   - Checks Content-Length header first
   - Rejects immediately if over limit
   - No body parsing occurs

2. **Streaming Validation:**
   - Wraps rack.input for chunked encoding
   - Tracks cumulative bytes read
   - Raises error if limit exceeded during read

3. **Clear Error Messages:**
   - Human-readable sizes (MB, KB)
   - Both absolute and human-readable in response
   - Custom headers with size information

4. **HTTP Method Filtering:**
   - Only checks POST, PUT, PATCH, DELETE
   - GET, HEAD, OPTIONS pass through

---

### File 3: Register Middleware

**Location:** `agent-ruby/packages/forest_admin_rails/lib/forest_admin_rails/engine.rb`

```ruby
# frozen_string_literal: true

module ForestAdminRails
  class Engine < ::Rails::Engine
    isolate_namespace ForestAdminRails

    # ... existing initializers ...

    # CORS configuration
    config.middleware.insert_before 0, Rack::Cors do
      # ... existing CORS config ...
    end

    # Body size limit middleware (NEW)
    initializer 'forest_admin_rails.body_size_limit', after: :load_config_initializers do |app|
      if ForestAdminRails.config[:enforce_body_size_limit]
        max_size = ForestAdminRails.config[:max_body_size]

        # Insert middleware after CORS, before body parsing
        app.middleware.insert_after(
          Rack::Cors,
          ForestAdminRails::Middleware::BodySizeLimit,
          max_size: max_size
        )

        Rails.logger.info "[ForestAdmin] Body size limit enabled: #{format_size(max_size)}"
      else
        Rails.logger.info '[ForestAdmin] Body size limit disabled'
      end
    end

    # ... other initializers ...

    private

    def self.format_size(bytes)
      if bytes < 1024 * 1024
        "#{(bytes / 1024.0).round(2)} KB"
      else
        "#{(bytes / 1024.0 / 1024.0).round(2)} MB"
      end
    end
  end
end
```

**Key Points:**
- Middleware inserted after CORS
- Only inserted if `enforce_body_size_limit` is true
- Logs configuration at startup

---

## 📝 Usage Examples

### Example 1: Default Configuration (50MB)

```ruby
# config/initializers/forest_admin.rb
ForestAdminRails.configure do |config|
  config.auth_secret = ENV['FOREST_AUTH_SECRET']
  config.env_secret = ENV['FOREST_ENV_SECRET']

  # Body size limit uses default: 50MB
  # No explicit configuration needed
end
```

**Behavior:**
- POST/PUT/PATCH/DELETE limited to 50MB
- Requests over 50MB return 413

---

### Example 2: Custom Limit (10MB)

```ruby
ForestAdminRails.configure do |config|
  config.auth_secret = ENV['FOREST_AUTH_SECRET']
  config.env_secret = ENV['FOREST_ENV_SECRET']

  # Limit to 10MB
  config.max_body_size = 10.megabytes
end
```

**Use Case:** Memory-constrained environments, tighter security

---

### Example 3: AWS Lambda (API Gateway 6MB Limit)

```ruby
ForestAdminRails.configure do |config|
  config.auth_secret = ENV['FOREST_AUTH_SECRET']
  config.env_secret = ENV['FOREST_ENV_SECRET']

  # Match API Gateway limit
  config.max_body_size = 6.megabytes
end
```

**Use Case:** Align with AWS API Gateway 6MB limit

---

### Example 4: Disable Body Size Limit

```ruby
ForestAdminRails.configure do |config|
  config.auth_secret = ENV['FOREST_AUTH_SECRET']
  config.env_secret = ENV['FOREST_ENV_SECRET']

  # Disable body size limit (not recommended for production)
  config.enforce_body_size_limit = false
end
```

**Use Case:** Testing, internal APIs, trusted environments

---

### Example 5: Environment-Specific Limits

```ruby
ForestAdminRails.configure do |config|
  config.auth_secret = ENV['FOREST_AUTH_SECRET']
  config.env_secret = ENV['FOREST_ENV_SECRET']

  # Different limits per environment
  config.max_body_size = case Rails.env
                         when 'development'
                           100.megabytes  # More permissive in dev
                         when 'staging'
                           25.megabytes   # Medium limit for staging
                         when 'production'
                           10.megabytes   # Strict limit in production
                         else
                           50.megabytes   # Default
                         end

  Rails.logger.info "ForestAdmin body size limit: #{config.max_body_size / 1.megabyte} MB"
end
```

---

### Example 6: Dynamic Configuration via ENV

```ruby
ForestAdminRails.configure do |config|
  config.auth_secret = ENV['FOREST_AUTH_SECRET']
  config.env_secret = ENV['FOREST_ENV_SECRET']

  # Configure via environment variable
  max_size_mb = ENV.fetch('FOREST_MAX_BODY_SIZE_MB', '50').to_i
  config.max_body_size = max_size_mb.megabytes

  # Optional: disable via ENV
  config.enforce_body_size_limit = ENV['FOREST_ENFORCE_BODY_SIZE'] != 'false'
end
```

**Use Case:** 12-factor app, container deployments, easy tuning without code changes

---

## 🧪 Testing Strategy

### Test File 1: Middleware Unit Tests

**Location:** `agent-ruby/packages/forest_admin_rails/spec/middleware/body_size_limit_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe ForestAdminRails::Middleware::BodySizeLimit do
  let(:app) { ->(env) { [200, { 'Content-Type' => 'text/plain' }, ['OK']] } }
  let(:max_size) { 1024 } # 1KB for testing
  let(:middleware) { described_class.new(app, max_size: max_size) }

  describe '#call' do
    context 'with GET request' do
      it 'does not check body size' do
        env = Rack::MockRequest.env_for('/', method: 'GET', 'CONTENT_LENGTH' => '10000')

        status, _headers, _body = middleware.call(env)

        expect(status).to eq(200)
      end
    end

    context 'with POST request under limit' do
      it 'allows the request' do
        body_content = 'a' * 512 # 512 bytes
        env = Rack::MockRequest.env_for(
          '/',
          method: 'POST',
          'CONTENT_LENGTH' => body_content.bytesize.to_s,
          'rack.input' => StringIO.new(body_content)
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
        expect(response['errors']).to be_an(Array)
        expect(response['errors'].first['name']).to eq('PayloadTooLarge')
        expect(response['errors'].first['status']).to eq(413)
        expect(response['errors'].first['detail']).to include('exceeds maximum')
      end

      it 'includes human-readable sizes in error' do
        env = Rack::MockRequest.env_for(
          '/',
          method: 'POST',
          'CONTENT_LENGTH' => '2048'
        )

        _status, _headers, body = middleware.call(env)
        response = JSON.parse(body.first)

        expect(response['errors'].first['detail']).to include('2.0 KB')
        expect(response['errors'].first['detail']).to include('1.0 KB')
      end

      it 'includes data with both byte and human sizes' do
        env = Rack::MockRequest.env_for(
          '/',
          method: 'POST',
          'CONTENT_LENGTH' => '2048'
        )

        _status, _headers, body = middleware.call(env)
        response = JSON.parse(body.first)
        data = response['errors'].first['data']

        expect(data['max_size_bytes']).to eq(1024)
        expect(data['actual_size_bytes']).to eq(2048)
        expect(data['max_size_human']).to eq('1.0 KB')
        expect(data['actual_size_human']).to eq('2.0 KB')
      end
    end

    context 'with POST request over limit during streaming' do
      it 'returns 413 when body read exceeds limit' do
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
        expect(response['errors'].first['detail']).to include('exceeds maximum')
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
      it 'checks body size for DELETE' do
        env = Rack::MockRequest.env_for(
          '/',
          method: 'DELETE',
          'CONTENT_LENGTH' => '2048'
        )

        status, _headers, _body = middleware.call(env)

        expect(status).to eq(413)
      end
    end

    context 'with HEAD request' do
      it 'does not check body size' do
        env = Rack::MockRequest.env_for(
          '/',
          method: 'HEAD',
          'CONTENT_LENGTH' => '10000'
        )

        status, _headers, _body = middleware.call(env)

        expect(status).to eq(200)
      end
    end

    context 'with OPTIONS request' do
      it 'does not check body size' do
        env = Rack::MockRequest.env_for(
          '/',
          method: 'OPTIONS',
          'CONTENT_LENGTH' => '10000'
        )

        status, _headers, _body = middleware.call(env)

        expect(status).to eq(200)
      end
    end
  end

  describe '#format_bytes' do
    it 'formats bytes correctly' do
      expect(middleware.send(:format_bytes, 500)).to eq('500 bytes')
      expect(middleware.send(:format_bytes, 1024)).to eq('1.0 KB')
      expect(middleware.send(:format_bytes, 1536)).to eq('1.5 KB')
      expect(middleware.send(:format_bytes, 1_048_576)).to eq('1.0 MB')
      expect(middleware.send(:format_bytes, 52_428_800)).to eq('50.0 MB')
      expect(middleware.send(:format_bytes, 1_073_741_824)).to eq('1.0 GB')
    end
  end
end
```

---

### Test File 2: BodySizeValidator Unit Tests

**Location:** `agent-ruby/packages/forest_admin_rails/spec/middleware/body_size_validator_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe ForestAdminRails::Middleware::BodySizeValidator do
  let(:content) { 'a' * 100 }
  let(:io) { StringIO.new(content) }
  let(:max_size) { 50 }
  let(:validator) { described_class.new(io, max_size) }

  describe '#read' do
    context 'when reading under limit' do
      it 'allows the read' do
        data = validator.read(25)

        expect(data).to eq('a' * 25)
      end
    end

    context 'when reading over limit in single read' do
      it 'raises BodySizeExceededError' do
        expect { validator.read(60) }.to raise_error(
          described_class::BodySizeExceededError
        )
      end

      it 'includes actual size in error' do
        begin
          validator.read(60)
        rescue described_class::BodySizeExceededError => e
          expect(e.actual_size).to eq(60)
        end
      end
    end

    context 'when cumulative reads exceed limit' do
      it 'raises BodySizeExceededError' do
        validator.read(25)
        validator.read(20)

        expect { validator.read(10) }.to raise_error(
          described_class::BodySizeExceededError
        )
      end

      it 'tracks cumulative bytes correctly' do
        validator.read(25)
        validator.read(20)

        begin
          validator.read(10)
        rescue described_class::BodySizeExceededError => e
          expect(e.actual_size).to eq(55) # 25 + 20 + 10
        end
      end
    end

    context 'when reading nil' do
      it 'returns nil without tracking' do
        io = StringIO.new('')
        validator = described_class.new(io, 50)

        result = validator.read

        expect(result).to be_nil
      end
    end
  end

  describe '#gets' do
    let(:content) { "line1\nline2\nline3\n" }

    context 'when reading lines under limit' do
      it 'allows reading lines' do
        line = validator.gets

        expect(line).to eq("line1\n")
      end
    end

    context 'when cumulative lines exceed limit' do
      it 'raises BodySizeExceededError' do
        validator.gets # 6 bytes
        validator.gets # 12 bytes total
        validator.gets # 18 bytes total
        validator.gets # 24 bytes total

        expect { validator.gets }.to raise_error(
          described_class::BodySizeExceededError
        )
      end
    end
  end

  describe '#each' do
    let(:content) { "chunk1chunk2chunk3" }

    it 'validates size for each chunk' do
      chunks_read = []

      expect {
        validator.each do |chunk|
          chunks_read << chunk
        end
      }.to raise_error(described_class::BodySizeExceededError)

      # Should have read some chunks before error
      expect(chunks_read.size).to be > 0
    end
  end

  describe '#rewind' do
    it 'resets byte counter' do
      validator.read(30)
      validator.rewind

      # Should be able to read 30 again
      data = validator.read(30)

      expect(data).to eq('a' * 30)
    end

    it 'rewinds underlying IO' do
      validator.read(50)
      validator.rewind

      expect(io.pos).to eq(0)
    end
  end

  describe '#size' do
    it 'delegates to underlying IO' do
      expect(validator.size).to eq(100)
    end

    context 'when IO does not support size' do
      let(:io) { double('IO', read: 'data') }

      it 'returns nil' do
        validator = described_class.new(io, 50)

        expect(validator.size).to be_nil
      end
    end
  end

  describe '#eof?' do
    it 'delegates to underlying IO' do
      validator.read(100)

      expect(validator.eof?).to be true
    end
  end

  describe '#close' do
    it 'closes underlying IO' do
      expect(io).to receive(:close)

      validator.close
    end

    context 'when IO does not support close' do
      let(:io) { double('IO', read: 'data') }

      it 'does not raise error' do
        validator = described_class.new(io, 50)

        expect { validator.close }.not_to raise_error
      end
    end
  end
end
```

---

### Test File 3: Integration Tests

**Location:** `agent-ruby/packages/forest_admin_rails/spec/integration/body_size_limit_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe 'Body Size Limit Integration', type: :request do
  let(:auth_token) { generate_jwt_token }

  before do
    # Configure body size limit for tests
    ForestAdminRails.config[:max_body_size] = 1024 # 1KB for testing
    ForestAdminRails.config[:enforce_body_size_limit] = true
  end

  describe 'POST requests' do
    context 'with body under limit' do
      it 'allows the request' do
        post '/forest/users',
             params: { data: { attributes: { name: 'Test' } } }.to_json,
             headers: {
               'Authorization' => "Bearer #{auth_token}",
               'Content-Type' => 'application/json'
             }

        expect(response.status).to be < 400
      end
    end

    context 'with body over limit' do
      it 'returns 413 Payload Too Large' do
        large_payload = { data: { attributes: { description: 'a' * 2048 } } }.to_json

        post '/forest/users',
             params: large_payload,
             headers: {
               'Authorization' => "Bearer #{auth_token}",
               'Content-Type' => 'application/json'
             }

        expect(response.status).to eq(413)
        expect(response.content_type).to include('application/json')
      end

      it 'returns helpful error message' do
        large_payload = { data: { attributes: { description: 'a' * 2048 } } }.to_json

        post '/forest/users',
             params: large_payload,
             headers: {
               'Authorization' => "Bearer #{auth_token}",
               'Content-Type' => 'application/json'
             }

        json = JSON.parse(response.body)

        expect(json['errors']).to be_present
        expect(json['errors'].first['name']).to eq('PayloadTooLarge')
        expect(json['errors'].first['detail']).to include('exceeds maximum')
      end

      it 'includes size information in headers' do
        large_payload = { data: { attributes: { description: 'a' * 2048 } } }.to_json

        post '/forest/users',
             params: large_payload,
             headers: {
               'Authorization' => "Bearer #{auth_token}",
               'Content-Type' => 'application/json'
             }

        expect(response.headers['X-Body-Size-Limit']).to be_present
        expect(response.headers['X-Actual-Body-Size']).to be_present
      end
    end
  end

  describe 'GET requests' do
    it 'does not apply body size limit' do
      # GET with query params (no body check)
      get '/forest/users',
          params: { filter: 'a' * 10_000 },
          headers: { 'Authorization' => "Bearer #{auth_token}" }

      expect(response.status).not_to eq(413)
    end
  end

  describe 'PUT requests' do
    let(:user) { create(:user) }

    context 'with body over limit' do
      it 'returns 413 Payload Too Large' do
        large_payload = { data: { attributes: { description: 'a' * 2048 } } }.to_json

        put "/forest/users/#{user.id}",
            params: large_payload,
            headers: {
              'Authorization' => "Bearer #{auth_token}",
              'Content-Type' => 'application/json'
            }

        expect(response.status).to eq(413)
      end
    end
  end

  describe 'PATCH requests' do
    let(:user) { create(:user) }

    context 'with body over limit' do
      it 'returns 413 Payload Too Large' do
        large_payload = { data: { attributes: { description: 'a' * 2048 } } }.to_json

        patch "/forest/users/#{user.id}",
              params: large_payload,
              headers: {
                'Authorization' => "Bearer #{auth_token}",
                'Content-Type' => 'application/json'
              }

        expect(response.status).to eq(413)
      end
    end
  end

  describe 'DELETE requests with body' do
    context 'with body over limit' do
      it 'returns 413 Payload Too Large' do
        large_payload = { reason: 'a' * 2048 }.to_json

        delete '/forest/users',
               params: large_payload,
               headers: {
                 'Authorization' => "Bearer #{auth_token}",
                 'Content-Type' => 'application/json'
               }

        expect(response.status).to eq(413)
      end
    end
  end

  private

  def generate_jwt_token
    payload = {
      id: 1,
      email: 'test@example.com',
      rendering_id: 1
    }
    JWT.encode(payload, 'test_secret', 'HS256')
  end
end
```

---

## 📋 Implementation Checklist

### Phase 1: Core Implementation (Day 1)

- [ ] Add configuration options to ForestAdminRails
  - [ ] `max_body_size` setting (default: 50MB)
  - [ ] `enforce_body_size_limit` setting (default: true)
- [ ] Create `BodySizeLimit` middleware class
  - [ ] Initialize with max_size parameter
  - [ ] Implement `call` method
  - [ ] Check HTTP method (POST/PUT/PATCH/DELETE only)
  - [ ] Check Content-Length header
  - [ ] Wrap rack.input with validator
- [ ] Create `BodySizeValidator` class
  - [ ] Initialize with IO and max_size
  - [ ] Implement `read` with size tracking
  - [ ] Implement `gets` with size tracking
  - [ ] Implement `each` with size tracking
  - [ ] Implement `rewind` to reset counter
  - [ ] Delegate other methods (size, eof?, close)
- [ ] Create `BodySizeExceededError` exception
  - [ ] Include actual_size attribute
- [ ] Implement error response formatting
  - [ ] 413 status code
  - [ ] JSON error format
  - [ ] Human-readable byte formatting
  - [ ] Custom headers (X-Body-Size-Limit, X-Actual-Body-Size)

### Phase 2: Middleware Registration (Day 1)

- [ ] Update ForestAdminRails::Engine
  - [ ] Add initializer for body size limit
  - [ ] Insert middleware after Rack::Cors
  - [ ] Check enforce_body_size_limit flag
  - [ ] Log configuration at startup

### Phase 3: Testing (Day 2)

- [ ] Write middleware unit tests (10 scenarios)
  - [ ] GET request (no check)
  - [ ] POST under limit
  - [ ] POST over limit (Content-Length)
  - [ ] POST over limit (streaming)
  - [ ] PUT/PATCH/DELETE methods
  - [ ] HEAD/OPTIONS (no check)
  - [ ] Error response format
  - [ ] Human-readable formatting
- [ ] Write BodySizeValidator unit tests (8 scenarios)
  - [ ] Read under limit
  - [ ] Read over limit (single)
  - [ ] Cumulative reads
  - [ ] gets method
  - [ ] each method
  - [ ] rewind behavior
  - [ ] Delegation methods
- [ ] Write integration tests (6 scenarios)
  - [ ] POST over limit end-to-end
  - [ ] PUT over limit
  - [ ] PATCH over limit
  - [ ] DELETE over limit
  - [ ] GET not affected
  - [ ] Error format validation

### Phase 4: Documentation (Day 3)

- [ ] Update configuration documentation
- [ ] Add usage examples (6 scenarios)
- [ ] Document error response format
- [ ] Document middleware behavior
- [ ] Add environment-specific examples
- [ ] Update CHANGELOG

### Phase 5: Deployment (Day 3)

- [ ] Code review
- [ ] Deploy to staging
- [ ] Test with various body sizes
- [ ] Monitor 413 error rate
- [ ] Deploy to production
- [ ] Update parity report

---

## ✅ Acceptance Criteria

### Functional Requirements

- [ ] Configuration option `max_body_size` works
- [ ] Configuration option `enforce_body_size_limit` works
- [ ] Default body size limit is 50MB
- [ ] Requests over limit return 413 status
- [ ] GET requests not affected by limit
- [ ] POST requests validated
- [ ] PUT requests validated
- [ ] PATCH requests validated
- [ ] DELETE requests validated
- [ ] HEAD/OPTIONS requests not validated
- [ ] Content-Length header checked first
- [ ] Streaming body validated for chunked encoding
- [ ] Middleware can be disabled

### Error Handling

- [ ] 413 status code correct
- [ ] Error response is valid JSON
- [ ] Error name is "PayloadTooLarge"
- [ ] Error detail includes human-readable sizes
- [ ] Error includes both max and actual sizes
- [ ] Custom headers include size information
- [ ] Error data includes byte and human sizes

### Performance

- [ ] Minimal overhead for small requests (<1ms)
- [ ] Early rejection via Content-Length (no body read)
- [ ] Streaming validation efficient (constant memory)
- [ ] No performance impact on GET requests

### Testing

- [ ] Unit test coverage >95%
- [ ] All HTTP methods tested
- [ ] Both rejection methods tested (header and streaming)
- [ ] Integration tests pass
- [ ] Error format validated

### Documentation

- [ ] Configuration options documented
- [ ] Usage examples provided
- [ ] Error response format documented
- [ ] API Gateway limits documented
- [ ] CHANGELOG updated

---

## 🎯 Success Metrics

**Track after deployment:**

1. **413 Error Rate:** Should be very low (<0.1% of requests)
2. **Average Body Size:** Monitor typical request sizes
3. **P99 Body Size:** Track largest requests
4. **Configuration Usage:** How many deployments customize the limit
5. **Rejection Reasons:** Content-Length vs streaming rejections
6. **Environment Distribution:** Dev vs staging vs production limits

---

## 🚨 Edge Cases

### Edge Case 1: Chunked Transfer Encoding (No Content-Length)

**Scenario:** Client sends chunked request without Content-Length header

**Handling:**
- Content-Length check skipped
- BodySizeValidator wraps rack.input
- Size validated during streaming
- Error raised when limit exceeded

**Test:**
```ruby
env = Rack::MockRequest.env_for('/', method: 'POST', 'rack.input' => large_io)
env.delete('CONTENT_LENGTH')
```

---

### Edge Case 2: Exact Limit Size

**Scenario:** Request body exactly equals max_body_size

**Handling:**
- Should be allowed (check is `>`, not `>=`)
- Test both Content-Length and streaming

**Test:**
```ruby
body = 'a' * max_size
expect(status).to eq(200)
```

---

### Edge Case 3: Multipart Form Data

**Scenario:** File upload with multipart/form-data

**Handling:**
- Content-Length includes all parts + boundaries
- Limit applies to entire request body
- Individual files not checked separately

**Recommendation:** Document that limit is per-request, not per-file

---

### Edge Case 4: Compression (gzip/deflate)

**Scenario:** Client sends compressed request body

**Handling:**
- Content-Length is compressed size
- Decompression happens after size check
- Decompressed size could exceed limit

**Mitigation:** Rails middleware handles decompression, our check is before

---

### Edge Case 5: Concurrent Requests

**Scenario:** Multiple large requests simultaneously

**Handling:**
- Each request checked independently
- No global rate limiting
- Memory usage = number of concurrent requests * request size

**Recommendation:** Combine with connection pool limits

---

## 🔒 Security Considerations

### 1. DoS Attack Prevention

**Attack:** Send many large requests to exhaust memory

**Protection:**
- Early rejection via Content-Length
- No body parsing if over limit
- Minimal memory footprint per request

---

### 2. Slowloris-Style Attack

**Attack:** Send body very slowly to tie up connections

**Protection:**
- Configure request timeout at server level (Puma, Unicorn)
- Our middleware checks size, not speed
- Recommend: `Rack::Timeout` middleware

---

### 3. Header Spoofing

**Attack:** Send fake Content-Length, then send more data

**Protection:**
- BodySizeValidator tracks actual bytes read
- Catches discrepancy during streaming
- Error raised when actual exceeds limit

---

### 4. Information Disclosure

**Concern:** Error messages reveal internal limits

**Mitigation:**
- Error messages are helpful, not sensitive
- Limit information is not secret
- Custom error messages possible via config

---

## 📊 Performance Impact

### Benchmarks (Expected)

| Scenario | Overhead | Notes |
|----------|----------|-------|
| Small request (<1KB) | <1ms | Content-Length check only |
| Medium request (1-50MB) | <1ms | Content-Length check only |
| Large request (>50MB) | ~0ms | Rejected before body parsing |
| Chunked request (small) | <5ms | Streaming validation |
| GET request | 0ms | Bypassed entirely |

### Memory Usage

| Scenario | Memory | Notes |
|----------|--------|-------|
| Under limit | Normal | Passes through to Rails parser |
| Over limit (header) | ~1KB | Error response only |
| Over limit (streaming) | Variable | Depends on when limit exceeded |

---

## 🔧 Troubleshooting

### Issue 1: "Getting 413 errors in development"

**Solution:**
```ruby
# config/initializers/forest_admin.rb
if Rails.env.development?
  ForestAdminRails.config[:max_body_size] = 100.megabytes
end
```

---

### Issue 2: "AWS Lambda gives 413 before reaching code"

**Solution:**
- API Gateway has 6MB limit (can't be changed)
- Configure Forest Admin to match:
```ruby
config.max_body_size = 6.megabytes
```

---

### Issue 3: "Multipart uploads failing"

**Check:**
- Entire multipart body counts (including boundaries)
- Increase limit if uploading multiple files:
```ruby
config.max_body_size = 100.megabytes
```

---

### Issue 4: "Want different limits for different endpoints"

**Not Supported:** Middleware applies globally to all Forest Admin routes

**Workaround:**
- Mount Forest Admin at different paths with separate configs
- Or use Rails routing constraints:
```ruby
# Advanced: custom constraint
constraints(BodySizeConstraint.new(100.megabytes)) do
  # Routes with higher limit
end
```

---

This implementation provides comprehensive body size limit control, bringing the Ruby agent to feature parity with Node.js while adding clear error messages and flexible configuration! 🎯