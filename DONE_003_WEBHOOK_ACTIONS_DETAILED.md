# TODO 003: Webhook Actions - Implementation Guide
## High Priority (P1) - Forest Admin Agent Ruby

**Project:** mini_qonto
**Target Package:** forest_admin_agent (via agent-ruby)
**Estimated Effort:** 1-2 weeks
**Priority:** P1 - Expanding action capabilities

---

## 🎯 Executive Summary

Implement webhook action result type, allowing Smart Actions to POST data to external URLs and return the webhook response to users, enabling integration with external systems, microservices, and third-party APIs.

**Current Gap:**
- Actions can only return success/error messages internally
- No way to trigger external webhooks from actions
- Cannot integrate with external services (Slack, email, payment processors)
- No support for async workflows via webhooks

**Target Solution:**
- New action result type: `Webhook`
- POSTs action context to external URL
- Configurable HTTP method, headers, body
- Returns webhook response to user
- Proper error handling for webhook failures
- Timeout management (default: 30 seconds)

**Use Cases:**
- Send Slack notification on action execution
- Trigger email via SendGrid/Mailgun
- Process payment via Stripe webhook
- Create ticket in external system (Zendesk, Jira)
- Trigger deployment pipeline
- Call microservice endpoint
- Sync data with external system

---

## 📊 Node.js Reference Implementation

### Action Result Type Definition

**File:** `agent-nodejs/packages/datasource-toolkit/src/interfaces/action.ts`

```typescript
export type ActionResult =
  | { type: 'Success'; message: string; invalidated: Set<string>; }
  | { type: 'Error'; message: string; }
  | { type: 'Webhook'; url: string; method: string; headers: object; body: object; }
  | { type: 'File'; stream: Readable; mimeType: string; name: string; };
```

### Webhook Execution (Node.js)

**File:** `agent-nodejs/packages/agent/src/services/model-customizations/actions/webhook/execute-webhook.ts`

```typescript
async function executeWebhook<S>(action: WebhookAction, context: ActionContext<S>) {
  const records = await context.getRecords(primaryKeys);
  const body = generateBody(action, records);

  try {
    const response = await superagent
      .post(action.configuration.configuration.url)
      .timeout(30000)  // 30 second timeout
      .send(body);

    return {
      type: 'Success',
      message: 'Webhook executed successfully',
    };
  } catch (e) {
    if ((e as ResponseError).response) {
      return {
        type: 'Error',
        message: `Error received from the webhook endpoint: ${e.status} ${e.message}.`,
      };
    }
    return {
      type: 'Error',
      message: `Could not execute the action: ${e.message}.`,
    };
  }
}
```

### Webhook Payload Format (Node.js)

```typescript
function generateBody(action: WebhookAction, records: RecordData[]): unknown {
  const scope = action.configuration.scope;

  if (scope === 'Global') {
    return {
      action: { name: action.name, scope: 'Global' },
    };
  }

  if (scope === 'Single') {
    return {
      action: { name: action.name, scope: 'Single' },
      record: records[0],
    };
  }

  // Bulk scope
  return {
    action: { name: action.name, scope: 'Bulk' },
    records: records,
  };
}
```

### Key Features:

1. **HTTP Methods:** POST (default), GET, PUT, PATCH, DELETE
2. **Headers:** Configurable custom headers
3. **Payload Format:**
   - Global: `{ action: { name, scope } }`
   - Single: `{ action: { name, scope }, record: {...} }`
   - Bulk: `{ action: { name, scope }, records: [...] }`
4. **Timeout:** 30 seconds default
5. **Error Handling:** Network errors, HTTP errors (4xx, 5xx)
6. **Response:** Webhook HTTP response returned to user

---

## 🏗️ Ruby Implementation Architecture

### Overview

```
┌─────────────────────────────────────────────────┐
│  POST /forest/_actions/:collection/:index/:slug │
│  Body: { data: { attributes: { ... } } }       │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Action Execution Handler                       │
│  - Parse action slug                            │
│  - Validate permissions                         │
│  - Build action context                         │
│  - Execute action.execute(context)              │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Custom Action Code                             │
│  - Fetch records if needed                      │
│  - Build webhook payload                        │
│  - Return result: { type: 'Webhook', ... }      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Webhook Executor Service                       │
│  - Validate webhook URL                         │
│  - Build HTTP request (method, headers, body)   │
│  - Execute HTTP request via Faraday             │
│  - Handle timeout (default 30s)                 │
└──────────────────┬──────────────────────────────┘
                   │
           ┌───────┴────────┐
           │                │
           ▼                ▼
    ┌──────────┐     ┌──────────┐
    │ Success  │     │  Error   │
    │ (2xx)    │     │ (4xx/5xx)│
    └────┬─────┘     └────┬─────┘
         │                │
         └────────┬───────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  Result Handler                                 │
│  - Return success with webhook response         │
│  - Or return error with failure details         │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Frontend Displays Result                       │
│  - Success message + webhook response data      │
│  - Error message with troubleshooting info      │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Details

### File 1: Add Webhook Result Type

**Location:** `agent-ruby/packages/forest_admin_datasource_toolkit/lib/forest_admin_datasource_toolkit/interfaces/action.rb`

```ruby
# frozen_string_literal: true

module ForestAdminDatasourceToolkit
  module Interfaces
    module Action
      # Webhook result (NEW)
      class WebhookResult < ActionResult
        attr_reader :url, :method, :headers, :body

        # @param url [String] Webhook URL to call
        # @param method [String] HTTP method (default: POST)
        # @param headers [Hash] Custom HTTP headers
        # @param body [Hash] Request body (will be JSON serialized)
        def initialize(url:, method: 'POST', headers: {}, body: {})
          super('Webhook')
          @url = url
          @method = method.to_s.upcase
          @headers = headers || {}
          @body = body || {}
        end

        # Validate webhook URL
        def valid_url?
          return false if url.nil? || url.empty?

          uri = URI.parse(url)
          uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)
        rescue URI::InvalidURIError
          false
        end

        # Validate HTTP method
        def valid_method?
          %w[GET POST PUT PATCH DELETE].include?(method)
        end

        # Validate webhook result
        def valid?
          valid_url? && valid_method?
        end
      end

      # Result builder
      class ResultBuilder
        # ... existing methods ...

        # Build webhook result
        # @param url [String] Webhook URL
        # @param method [String] HTTP method (default: POST)
        # @param headers [Hash] Custom headers
        # @param body [Hash] Request body
        def webhook(url, method: 'POST', headers: {}, body: {})
          WebhookResult.new(url: url, method: method, headers: headers, body: body)
        end
      end
    end
  end
end
```

---

### File 2: Create Webhook Executor Service

**Location:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/services/webhook_executor.rb`

```ruby
# frozen_string_literal: true

require 'faraday'
require 'json'

module ForestAdminAgent
  module Services
    class WebhookExecutor
      DEFAULT_TIMEOUT = 30 # seconds
      MAX_RESPONSE_SIZE = 1_048_576 # 1MB

      class WebhookError < StandardError
        attr_reader :status, :response_body

        def initialize(message, status: nil, response_body: nil)
          super(message)
          @status = status
          @response_body = response_body
        end
      end

      # Execute webhook
      # @param webhook_result [ForestAdminDatasourceToolkit::Interfaces::Action::WebhookResult]
      # @param timeout [Integer] Timeout in seconds (default: 30)
      # @return [Hash] { success: true/false, status: int, body: string, message: string }
      def self.execute(webhook_result, timeout: DEFAULT_TIMEOUT)
        # Validate webhook result
        unless webhook_result.valid?
          return {
            success: false,
            message: 'Invalid webhook configuration',
            errors: validation_errors(webhook_result)
          }
        end

        # Build HTTP client
        client = build_client(timeout)

        # Execute request
        begin
          response = execute_request(client, webhook_result)

          # Success response
          {
            success: true,
            status: response.status,
            body: parse_response_body(response),
            message: "Webhook executed successfully (HTTP #{response.status})",
            headers: response.headers.to_h
          }
        rescue Faraday::TimeoutError => e
          {
            success: false,
            message: "Webhook request timed out after #{timeout} seconds",
            error: e.message
          }
        rescue Faraday::ConnectionFailed => e
          {
            success: false,
            message: 'Could not connect to webhook URL',
            error: e.message
          }
        rescue Faraday::SSLError => e
          {
            success: false,
            message: 'SSL certificate verification failed',
            error: e.message
          }
        rescue Faraday::ClientError => e
          # 4xx errors
          {
            success: false,
            status: e.response[:status],
            body: parse_error_body(e.response[:body]),
            message: "Webhook returned client error: #{e.response[:status]}",
            error: e.message
          }
        rescue Faraday::ServerError => e
          # 5xx errors
          {
            success: false,
            status: e.response[:status],
            body: parse_error_body(e.response[:body]),
            message: "Webhook returned server error: #{e.response[:status]}",
            error: e.message
          }
        rescue StandardError => e
          {
            success: false,
            message: 'Unexpected error executing webhook',
            error: e.message
          }
        end
      end

      # Build HTTP client with configuration
      def self.build_client(timeout)
        Faraday.new do |conn|
          # Request/response configuration
          conn.options.timeout = timeout
          conn.options.open_timeout = 10 # Connection timeout

          # Middleware
          conn.request :json # Automatically encode body as JSON
          conn.response :raise_error # Raise exceptions for 4xx/5xx
          conn.response :json, content_type: /\bjson$/ # Parse JSON responses

          # Adapter
          conn.adapter Faraday.default_adapter
        end
      end

      # Execute HTTP request
      def self.execute_request(client, webhook_result)
        method = webhook_result.method.downcase.to_sym
        url = webhook_result.url
        headers = build_headers(webhook_result.headers)
        body = webhook_result.body

        case method
        when :get
          client.get(url, nil, headers)
        when :post
          client.post(url, body, headers)
        when :put
          client.put(url, body, headers)
        when :patch
          client.patch(url, body, headers)
        when :delete
          client.delete(url, body, headers)
        else
          raise ArgumentError, "Unsupported HTTP method: #{method}"
        end
      end

      # Build request headers
      def self.build_headers(custom_headers)
        default_headers = {
          'User-Agent' => 'ForestAdmin-Ruby-Agent',
          'Accept' => 'application/json',
          'Content-Type' => 'application/json'
        }

        default_headers.merge(custom_headers || {})
      end

      # Parse response body
      def self.parse_response_body(response)
        return nil if response.body.nil? || response.body.empty?

        # Check response size
        if response.body.to_s.bytesize > MAX_RESPONSE_SIZE
          return { truncated: true, message: 'Response too large (>1MB)' }
        end

        # Try to parse as JSON
        if response.headers['content-type']&.include?('application/json')
          JSON.parse(response.body)
        else
          response.body.to_s
        end
      rescue JSON::ParserError
        response.body.to_s
      end

      # Parse error response body
      def self.parse_error_body(body)
        return nil if body.nil?

        if body.is_a?(String)
          # Try to parse as JSON
          JSON.parse(body)
        else
          body
        end
      rescue JSON::ParserError
        body
      end

      # Get validation errors
      def self.validation_errors(webhook_result)
        errors = []
        errors << 'Invalid URL' unless webhook_result.valid_url?
        errors << "Invalid HTTP method: #{webhook_result.method}" unless webhook_result.valid_method?
        errors
      end

      private_class_method :build_client, :execute_request, :build_headers,
                           :parse_response_body, :parse_error_body, :validation_errors
    end
  end
end
```

---

### File 3: Update Action Execution Handler

**Location:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/routes/action/actions.rb`

**Add webhook result handling:**

```ruby
# frozen_string_literal: true

module ForestAdminAgent
  module Routes
    module Action
      class Actions < AbstractAuthenticatedRoute
        include ForestAdminAgent::Http::ErrorHandling

        def handle_request(args = {})
          build(args)

          # ... existing action execution code ...

          # Execute action
          result_builder = ForestAdminDatasourceToolkit::Interfaces::Action::ResultBuilder.new
          result = action.execute(context, result_builder)

          # Handle different result types
          case result
          when ForestAdminDatasourceToolkit::Interfaces::Action::WebhookResult
            handle_webhook_result(result)
          when ForestAdminDatasourceToolkit::Interfaces::Action::FileResult
            handle_file_result(result)
          when ForestAdminDatasourceToolkit::Interfaces::Action::SuccessResult
            handle_success_result(result)
          when ForestAdminDatasourceToolkit::Interfaces::Action::ErrorResult
            handle_error_result(result)
          else
            raise Http::Exceptions::UnprocessableError, "Unknown action result type: #{result.class}"
          end
        end

        private

        # Handle webhook result (NEW)
        def handle_webhook_result(result)
          # Execute webhook
          webhook_response = Services::WebhookExecutor.execute(result)

          if webhook_response[:success]
            # Success response
            {
              content: {
                success: webhook_response[:message],
                webhook: {
                  status: webhook_response[:status],
                  response: webhook_response[:body]
                }
              },
              status: 200
            }
          else
            # Error response
            {
              content: {
                error: webhook_response[:message],
                details: webhook_response[:error],
                webhook: {
                  status: webhook_response[:status],
                  response: webhook_response[:body]
                }.compact
              },
              status: 400
            }
          end
        end

        # ... other result handlers ...
      end
    end
  end
end
```

---

### File 4: Action Context Webhook Helpers

**Location:** `agent-ruby/packages/forest_admin_datasource_toolkit/lib/forest_admin_datasource_toolkit/components/action_context.rb`

**Add helpers for building webhook payloads:**

```ruby
module ForestAdminDatasourceToolkit
  module Components
    class ActionContext
      # ... existing code ...

      # Build webhook payload based on action scope
      # @return [Hash] Payload to send to webhook
      def build_webhook_payload
        case @action_scope
        when 'Global'
          {
            action: {
              name: @action_name,
              scope: 'Global'
            }
          }
        when 'Single'
          {
            action: {
              name: @action_name,
              scope: 'Single'
            },
            record: get_record(@collection.schema[:fields].keys)
          }
        when 'Bulk'
          {
            action: {
              name: @action_name,
              scope: 'Bulk'
            },
            records: get_records(@collection.schema[:fields].keys)
          }
        else
          raise ArgumentError, "Unknown action scope: #{@action_scope}"
        end
      end

      # Helper: Create webhook result with auto-generated payload
      # @param url [String] Webhook URL
      # @param method [String] HTTP method (default: POST)
      # @param custom_headers [Hash] Additional headers
      # @param custom_body [Hash] Custom body (defaults to auto-generated payload)
      def webhook(url, method: 'POST', headers: {}, body: nil)
        payload = body || build_webhook_payload

        Interfaces::Action::WebhookResult.new(
          url: url,
          method: method,
          headers: headers,
          body: payload
        )
      end
    end
  end
end
```

---

## 📝 Usage Examples

### Example 1: Send Slack Notification

```ruby
# In your customization code:
collection.add_action('Notify Slack', {
  scope: 'Single',
  execute: lambda { |context, result_builder|
    record = context.get_record(['id', 'name', 'status'])

    # Build Slack webhook payload
    slack_payload = {
      text: "User #{record['name']} status changed to #{record['status']}",
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: "*User Updated*\nID: #{record['id']}\nName: #{record['name']}\nStatus: #{record['status']}"
          }
        }
      ]
    }

    # Return webhook result
    result_builder.webhook(
      ENV['SLACK_WEBHOOK_URL'],
      method: 'POST',
      body: slack_payload
    )
  }
})
```

---

### Example 2: Trigger Stripe Payment

```ruby
collection.add_action('Process Payment', {
  scope: 'Single',
  execute: lambda { |context, result_builder|
    order = context.get_record(['id', 'amount', 'customer_email'])

    # Call Stripe API via webhook
    result_builder.webhook(
      'https://api.stripe.com/v1/payment_intents',
      method: 'POST',
      headers: {
        'Authorization' => "Bearer #{ENV['STRIPE_SECRET_KEY']}"
      },
      body: {
        amount: (order['amount'] * 100).to_i, # Convert to cents
        currency: 'usd',
        receipt_email: order['customer_email'],
        metadata: {
          order_id: order['id']
        }
      }
    )
  }
})
```

---

### Example 3: Create Zendesk Ticket

```ruby
collection.add_action('Create Support Ticket', {
  scope: 'Single',
  execute: lambda { |context, result_builder|
    user = context.get_record(['id', 'name', 'email', 'issue'])

    # Create Zendesk ticket
    zendesk_url = "https://#{ENV['ZENDESK_SUBDOMAIN']}.zendesk.com/api/v2/tickets.json"

    result_builder.webhook(
      zendesk_url,
      method: 'POST',
      headers: {
        'Authorization' => "Basic #{Base64.strict_encode64("#{ENV['ZENDESK_EMAIL']}/token:#{ENV['ZENDESK_TOKEN']}")}"
      },
      body: {
        ticket: {
          subject: "Support request from #{user['name']}",
          comment: {
            body: user['issue']
          },
          requester: {
            name: user['name'],
            email: user['email']
          },
          priority: 'normal',
          custom_fields: [
            { id: 12345, value: user['id'] }
          ]
        }
      }
    )
  }
})
```

---

### Example 4: Send Email via SendGrid

```ruby
collection.add_action('Send Welcome Email', {
  scope: 'Bulk',
  execute: lambda { |context, result_builder|
    users = context.get_records(['id', 'name', 'email'])

    # Build SendGrid payload for multiple recipients
    personalizations = users.map do |user|
      {
        to: [{ email: user['email'], name: user['name'] }],
        substitutions: {
          '-name-' => user['name'],
          '-user_id-' => user['id'].to_s
        }
      }
    end

    result_builder.webhook(
      'https://api.sendgrid.com/v3/mail/send',
      method: 'POST',
      headers: {
        'Authorization' => "Bearer #{ENV['SENDGRID_API_KEY']}"
      },
      body: {
        personalizations: personalizations,
        from: {
          email: 'noreply@example.com',
          name: 'Your App'
        },
        template_id: ENV['SENDGRID_WELCOME_TEMPLATE_ID']
      }
    )
  }
})
```

---

### Example 5: Trigger CI/CD Pipeline

```ruby
collection.add_action('Deploy to Production', {
  scope: 'Global',
  execute: lambda { |context, result_builder|
    # Trigger GitHub Actions workflow
    result_builder.webhook(
      "https://api.github.com/repos/#{ENV['GITHUB_ORG']}/#{ENV['GITHUB_REPO']}/actions/workflows/deploy.yml/dispatches",
      method: 'POST',
      headers: {
        'Authorization' => "Bearer #{ENV['GITHUB_TOKEN']}",
        'Accept' => 'application/vnd.github.v3+json'
      },
      body: {
        ref: 'main',
        inputs: {
          environment: 'production',
          triggered_by: context.caller.email
        }
      }
    )
  }
})
```

---

### Example 6: Using Context Helper

```ruby
collection.add_action('Sync to External System', {
  scope: 'Single',
  execute: lambda { |context, result_builder|
    # Use context helper with auto-generated payload
    context.webhook(
      'https://external-system.com/api/sync',
      method: 'POST',
      headers: {
        'X-API-Key' => ENV['EXTERNAL_API_KEY']
      }
      # body will be auto-generated: { action: {...}, record: {...} }
    )
  }
})
```

---

## 🧪 Testing Strategy

### Test File 1: Unit Tests for WebhookResult

**Location:** `agent-ruby/packages/forest_admin_datasource_toolkit/spec/lib/interfaces/action/webhook_result_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe ForestAdminDatasourceToolkit::Interfaces::Action::WebhookResult do
  describe '#initialize' do
    it 'creates webhook result with URL and default method' do
      result = described_class.new(
        url: 'https://example.com/webhook',
        body: { key: 'value' }
      )

      expect(result.type).to eq('Webhook')
      expect(result.url).to eq('https://example.com/webhook')
      expect(result.method).to eq('POST')
      expect(result.body).to eq({ key: 'value' })
    end

    it 'creates webhook result with custom method' do
      result = described_class.new(
        url: 'https://example.com/api',
        method: 'PUT',
        headers: { 'X-Custom' => 'header' },
        body: { data: 'test' }
      )

      expect(result.method).to eq('PUT')
      expect(result.headers).to eq({ 'X-Custom' => 'header' })
    end

    it 'normalizes method to uppercase' do
      result = described_class.new(url: 'https://example.com', method: 'post')
      expect(result.method).to eq('POST')
    end
  end

  describe '#valid_url?' do
    it 'returns true for valid HTTP URL' do
      result = described_class.new(url: 'http://example.com/webhook')
      expect(result.valid_url?).to be true
    end

    it 'returns true for valid HTTPS URL' do
      result = described_class.new(url: 'https://example.com/webhook')
      expect(result.valid_url?).to be true
    end

    it 'returns false for invalid URL' do
      result = described_class.new(url: 'not-a-url')
      expect(result.valid_url?).to be false
    end

    it 'returns false for nil URL' do
      result = described_class.new(url: nil)
      expect(result.valid_url?).to be false
    end

    it 'returns false for empty URL' do
      result = described_class.new(url: '')
      expect(result.valid_url?).to be false
    end

    it 'returns false for non-HTTP(S) URL' do
      result = described_class.new(url: 'ftp://example.com')
      expect(result.valid_url?).to be false
    end
  end

  describe '#valid_method?' do
    %w[GET POST PUT PATCH DELETE].each do |method|
      it "returns true for #{method}" do
        result = described_class.new(url: 'https://example.com', method: method)
        expect(result.valid_method?).to be true
      end
    end

    it 'returns false for invalid method' do
      result = described_class.new(url: 'https://example.com', method: 'INVALID')
      expect(result.valid_method?).to be false
    end
  end

  describe '#valid?' do
    it 'returns true when both URL and method are valid' do
      result = described_class.new(
        url: 'https://example.com/webhook',
        method: 'POST'
      )
      expect(result.valid?).to be true
    end

    it 'returns false when URL is invalid' do
      result = described_class.new(url: 'invalid', method: 'POST')
      expect(result.valid?).to be false
    end

    it 'returns false when method is invalid' do
      result = described_class.new(url: 'https://example.com', method: 'INVALID')
      expect(result.valid?).to be false
    end
  end
end
```

---

### Test File 2: Unit Tests for WebhookExecutor

**Location:** `agent-ruby/packages/forest_admin_agent/spec/lib/services/webhook_executor_spec.rb`

```ruby
require 'spec_helper'
require 'webmock/rspec'

RSpec.describe ForestAdminAgent::Services::WebhookExecutor do
  let(:webhook_result) do
    ForestAdminDatasourceToolkit::Interfaces::Action::WebhookResult.new(
      url: 'https://example.com/webhook',
      method: 'POST',
      headers: { 'X-Custom-Header' => 'value' },
      body: { key: 'value' }
    )
  end

  describe '.execute' do
    context 'with successful webhook call' do
      before do
        stub_request(:post, 'https://example.com/webhook')
          .with(
            headers: { 'Content-Type' => 'application/json', 'X-Custom-Header' => 'value' },
            body: { key: 'value' }.to_json
          )
          .to_return(
            status: 200,
            body: { success: true, message: 'Webhook processed' }.to_json,
            headers: { 'Content-Type' => 'application/json' }
          )
      end

      it 'returns success response' do
        result = described_class.execute(webhook_result)

        expect(result[:success]).to be true
        expect(result[:status]).to eq(200)
        expect(result[:body]).to eq({ 'success' => true, 'message' => 'Webhook processed' })
        expect(result[:message]).to include('successfully')
      end
    end

    context 'with 4xx client error' do
      before do
        stub_request(:post, 'https://example.com/webhook')
          .to_return(
            status: 400,
            body: { error: 'Bad Request' }.to_json,
            headers: { 'Content-Type' => 'application/json' }
          )
      end

      it 'returns error response with status and body' do
        result = described_class.execute(webhook_result)

        expect(result[:success]).to be false
        expect(result[:status]).to eq(400)
        expect(result[:body]).to eq({ 'error' => 'Bad Request' })
        expect(result[:message]).to include('client error')
      end
    end

    context 'with 5xx server error' do
      before do
        stub_request(:post, 'https://example.com/webhook')
          .to_return(status: 500, body: 'Internal Server Error')
      end

      it 'returns error response with status' do
        result = described_class.execute(webhook_result)

        expect(result[:success]).to be false
        expect(result[:status]).to eq(500)
        expect(result[:message]).to include('server error')
      end
    end

    context 'with timeout' do
      before do
        stub_request(:post, 'https://example.com/webhook')
          .to_timeout
      end

      it 'returns timeout error' do
        result = described_class.execute(webhook_result, timeout: 5)

        expect(result[:success]).to be false
        expect(result[:message]).to include('timed out')
      end
    end

    context 'with connection failure' do
      before do
        stub_request(:post, 'https://example.com/webhook')
          .to_raise(Faraday::ConnectionFailed)
      end

      it 'returns connection error' do
        result = described_class.execute(webhook_result)

        expect(result[:success]).to be false
        expect(result[:message]).to include('Could not connect')
      end
    end

    context 'with SSL error' do
      before do
        stub_request(:post, 'https://example.com/webhook')
          .to_raise(Faraday::SSLError)
      end

      it 'returns SSL error' do
        result = described_class.execute(webhook_result)

        expect(result[:success]).to be false
        expect(result[:message]).to include('SSL certificate')
      end
    end

    context 'with invalid webhook configuration' do
      let(:invalid_webhook) do
        ForestAdminDatasourceToolkit::Interfaces::Action::WebhookResult.new(
          url: 'not-a-url',
          method: 'POST'
        )
      end

      it 'returns validation error' do
        result = described_class.execute(invalid_webhook)

        expect(result[:success]).to be false
        expect(result[:message]).to include('Invalid webhook configuration')
        expect(result[:errors]).to include('Invalid URL')
      end
    end

    context 'with different HTTP methods' do
      %w[GET PUT PATCH DELETE].each do |method|
        it "supports #{method} method" do
          webhook = ForestAdminDatasourceToolkit::Interfaces::Action::WebhookResult.new(
            url: 'https://example.com/api',
            method: method,
            body: { data: 'test' }
          )

          stub_request(method.downcase.to_sym, 'https://example.com/api')
            .to_return(status: 200, body: '{}')

          result = described_class.execute(webhook)
          expect(result[:success]).to be true
        end
      end
    end

    context 'with large response' do
      before do
        large_response = { data: 'x' * 2_000_000 }.to_json # >1MB
        stub_request(:post, 'https://example.com/webhook')
          .to_return(status: 200, body: large_response)
      end

      it 'truncates large responses' do
        result = described_class.execute(webhook_result)

        expect(result[:success]).to be true
        expect(result[:body]).to have_key('truncated')
        expect(result[:body]['truncated']).to be true
      end
    end

    context 'with non-JSON response' do
      before do
        stub_request(:post, 'https://example.com/webhook')
          .to_return(status: 200, body: 'Plain text response', headers: { 'Content-Type' => 'text/plain' })
      end

      it 'returns body as string' do
        result = described_class.execute(webhook_result)

        expect(result[:success]).to be true
        expect(result[:body]).to eq('Plain text response')
      end
    end
  end
end
```

---

### Test File 3: Integration Tests

**Location:** `agent-ruby/packages/forest_admin_agent/spec/integration/webhook_actions_spec.rb`

```ruby
require 'spec_helper'
require 'webmock/rspec'

RSpec.describe 'Webhook Actions', type: :request do
  let(:auth_token) { generate_jwt_token }
  let(:user) { create(:user, name: 'Test User', email: 'test@example.com') }

  before do
    allow(ForestAdminAgent::Services::Permissions).to receive(:new).and_return(
      instance_double('Permissions', can_smart_action?: true)
    )

    # Define webhook action
    ForestAdminAgent::Builder::AgentFactory.instance.customizer.customize_collection('users') do |collection|
      collection.add_action('Trigger Webhook', {
        scope: 'Single',
        execute: lambda { |context, result_builder|
          record = context.get_record(['id', 'name', 'email'])

          result_builder.webhook(
            'https://webhook.example.com/api',
            method: 'POST',
            headers: { 'X-Custom-Header' => 'test' },
            body: {
              user: {
                id: record['id'],
                name: record['name'],
                email: record['email']
              }
            }
          )
        }
      })
    end
  end

  describe 'POST /forest/_actions/:collection/:index/:slug' do
    context 'with successful webhook' do
      before do
        stub_request(:post, 'https://webhook.example.com/api')
          .with(
            headers: { 'X-Custom-Header' => 'test' },
            body: hash_including(user: hash_including(id: user.id))
          )
          .to_return(
            status: 200,
            body: { success: true, message: 'User processed' }.to_json,
            headers: { 'Content-Type' => 'application/json' }
          )
      end

      it 'executes webhook and returns success' do
        post "/forest/_actions/users/0/trigger-webhook",
             params: {
               data: {
                 attributes: {
                   ids: [user.id],
                   parent_association_name: nil
                 }
               }
             }.to_json,
             headers: {
               'Authorization' => "Bearer #{auth_token}",
               'Content-Type' => 'application/json'
             }

        expect(response.status).to eq(200)

        json = JSON.parse(response.body)
        expect(json['success']).to include('successfully')
        expect(json['webhook']['status']).to eq(200)
        expect(json['webhook']['response']['success']).to be true
      end
    end

    context 'with webhook returning error' do
      before do
        stub_request(:post, 'https://webhook.example.com/api')
          .to_return(
            status: 400,
            body: { error: 'Invalid data' }.to_json,
            headers: { 'Content-Type' => 'application/json' }
          )
      end

      it 'returns error response with webhook details' do
        post "/forest/_actions/users/0/trigger-webhook",
             params: {
               data: {
                 attributes: {
                   ids: [user.id],
                   parent_association_name: nil
                 }
               }
             }.to_json,
             headers: {
               'Authorization' => "Bearer #{auth_token}",
               'Content-Type' => 'application/json'
             }

        expect(response.status).to eq(400)

        json = JSON.parse(response.body)
        expect(json['error']).to include('client error')
        expect(json['webhook']['status']).to eq(400)
        expect(json['webhook']['response']['error']).to eq('Invalid data')
      end
    end

    context 'with webhook timeout' do
      before do
        stub_request(:post, 'https://webhook.example.com/api')
          .to_timeout
      end

      it 'returns timeout error' do
        post "/forest/_actions/users/0/trigger-webhook",
             params: {
               data: {
                 attributes: {
                   ids: [user.id],
                   parent_association_name: nil
                 }
               }
             }.to_json,
             headers: {
               'Authorization' => "Bearer #{auth_token}",
               'Content-Type' => 'application/json'
             }

        expect(response.status).to eq(400)

        json = JSON.parse(response.body)
        expect(json['error']).to include('timed out')
      end
    end

    context 'with bulk action' do
      let(:users) { create_list(:user, 3) }

      before do
        ForestAdminAgent::Builder::AgentFactory.instance.customizer.customize_collection('users') do |collection|
          collection.add_action('Bulk Webhook', {
            scope: 'Bulk',
            execute: lambda { |context, result_builder|
              result_builder.webhook(
                'https://webhook.example.com/bulk',
                body: context.build_webhook_payload
              )
            }
          })
        end

        stub_request(:post, 'https://webhook.example.com/bulk')
          .to_return(status: 200, body: { processed: 3 }.to_json)
      end

      it 'sends all records in webhook payload' do
        post "/forest/_actions/users/0/bulk-webhook",
             params: {
               data: {
                 attributes: {
                   ids: users.map(&:id),
                   parent_association_name: nil
                 }
               }
             }.to_json,
             headers: {
               'Authorization' => "Bearer #{auth_token}",
               'Content-Type' => 'application/json'
             }

        expect(response.status).to eq(200)

        # Verify webhook was called with all records
        expect(WebMock).to have_requested(:post, 'https://webhook.example.com/bulk')
          .with(body: hash_including(
            action: hash_including(scope: 'Bulk'),
            records: array_including(
              hash_including(id: users[0].id),
              hash_including(id: users[1].id),
              hash_including(id: users[2].id)
            )
          ))
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

### Phase 1: Core Implementation (Days 1-4)

- [ ] Define `WebhookResult` class in toolkit
  - [ ] Add `url`, `method`, `headers`, `body` attributes
  - [ ] Add `valid_url?` validation method
  - [ ] Add `valid_method?` validation method
  - [ ] Add `valid?` overall validation
- [ ] Add `ResultBuilder#webhook` method
- [ ] Create `WebhookExecutor` service
  - [ ] HTTP client setup with Faraday
  - [ ] Request execution for all HTTP methods
  - [ ] Timeout handling (30s default)
  - [ ] Error handling (network, HTTP errors)
  - [ ] Response parsing (JSON, text)
  - [ ] Large response truncation (>1MB)
- [ ] Update action execution handler
  - [ ] Detect webhook results
  - [ ] Call `WebhookExecutor.execute`
  - [ ] Format success response
  - [ ] Format error response
- [ ] Add `ActionContext#webhook` helper
- [ ] Add `ActionContext#build_webhook_payload` helper

### Phase 2: Testing (Days 5-8)

- [ ] Write unit tests for `WebhookResult`
  - [ ] Initialization
  - [ ] URL validation
  - [ ] Method validation
  - [ ] Overall validation
- [ ] Write unit tests for `WebhookExecutor`
  - [ ] Successful webhook (2xx)
  - [ ] Client errors (4xx)
  - [ ] Server errors (5xx)
  - [ ] Timeout errors
  - [ ] Connection failures
  - [ ] SSL errors
  - [ ] Invalid configuration
  - [ ] All HTTP methods
  - [ ] Large responses
  - [ ] Non-JSON responses
- [ ] Write integration tests
  - [ ] Successful webhook end-to-end
  - [ ] Error responses
  - [ ] Timeout handling
  - [ ] Bulk actions
  - [ ] Custom headers
  - [ ] Different HTTP methods
- [ ] Test with real services (staging)
  - [ ] Slack webhooks
  - [ ] SendGrid API
  - [ ] Stripe API

### Phase 3: Documentation & Examples (Days 9-11)

- [ ] Document `WebhookResult` API
- [ ] Document `WebhookExecutor` service
- [ ] Document `ResultBuilder#webhook` usage
- [ ] Create example: Slack notification
- [ ] Create example: Email via SendGrid
- [ ] Create example: Payment via Stripe
- [ ] Create example: Zendesk ticket creation
- [ ] Create example: CI/CD trigger
- [ ] Document security best practices
- [ ] Document timeout configuration
- [ ] Update CHANGELOG

### Phase 4: Deployment (Days 12-14)

- [ ] Security review
  - [ ] Webhook URL validation
  - [ ] Header injection prevention
  - [ ] Sensitive data in logs
- [ ] Code review
- [ ] Deploy to staging
- [ ] Test with production webhook URLs (safe endpoints)
- [ ] Monitor webhook execution times
- [ ] Monitor failure rates
- [ ] Deploy to production
- [ ] Update parity report
- [ ] Announce feature to users

---

## 🎯 Common Integration Patterns

### Pattern 1: Slack Notifications

```ruby
SLACK_WEBHOOK_URL = ENV['SLACK_WEBHOOK_URL']

def notify_slack(message, channel: '#notifications')
  {
    channel: channel,
    username: 'ForestAdmin Bot',
    icon_emoji: ':robot_face:',
    text: message
  }
end

# Usage in action:
result_builder.webhook(
  SLACK_WEBHOOK_URL,
  body: notify_slack("User #{record['name']} was updated")
)
```

### Pattern 2: Email Service (SendGrid, Mailgun, Postmark)

```ruby
def send_email_via_sendgrid(to:, subject:, html_content:)
  {
    personalizations: [{
      to: [{ email: to }],
      subject: subject
    }],
    from: {
      email: 'noreply@example.com',
      name: 'Your App'
    },
    content: [{
      type: 'text/html',
      value: html_content
    }]
  }
end

# Usage:
result_builder.webhook(
  'https://api.sendgrid.com/v3/mail/send',
  headers: { 'Authorization' => "Bearer #{ENV['SENDGRID_API_KEY']}" },
  body: send_email_via_sendgrid(
    to: record['email'],
    subject: 'Welcome!',
    html_content: "<h1>Welcome #{record['name']}</h1>"
  )
)
```

### Pattern 3: Payment Processing

```ruby
def create_stripe_payment(amount_cents:, customer_email:, description:)
  {
    amount: amount_cents,
    currency: 'usd',
    receipt_email: customer_email,
    description: description
  }
end

# Usage:
result_builder.webhook(
  'https://api.stripe.com/v1/payment_intents',
  headers: { 'Authorization' => "Bearer #{ENV['STRIPE_SECRET_KEY']}" },
  body: create_stripe_payment(
    amount_cents: order['total_cents'],
    customer_email: order['customer_email'],
    description: "Order ##{order['id']}"
  )
)
```

### Pattern 4: Microservice Communication

```ruby
def call_microservice(service_name, endpoint, data)
  base_url = ENV["#{service_name.upcase}_SERVICE_URL"]
  api_key = ENV["#{service_name.upcase}_API_KEY"]

  result_builder.webhook(
    "#{base_url}#{endpoint}",
    headers: {
      'X-API-Key' => api_key,
      'X-Request-ID' => SecureRandom.uuid
    },
    body: data
  )
end

# Usage:
call_microservice('inventory', '/api/reserve', {
  product_id: record['product_id'],
  quantity: record['quantity']
})
```

---

## 🚨 Security Considerations

### 1. Webhook URL Validation

**Issue:** Prevent SSRF (Server-Side Request Forgery) attacks

**Solution:**
```ruby
ALLOWED_WEBHOOK_HOSTS = [
  'hooks.slack.com',
  'api.sendgrid.com',
  'api.stripe.com',
  'api.mailgun.net',
  # ... whitelist of allowed hosts
].freeze

def validate_webhook_url(url)
  uri = URI.parse(url)

  # Block localhost/internal IPs
  if ['localhost', '127.0.0.1', '0.0.0.0'].include?(uri.host)
    raise SecurityError, 'Localhost webhooks not allowed'
  end

  # Block private IP ranges
  if IPAddr.new(uri.host).private?
    raise SecurityError, 'Private IP webhooks not allowed'
  end

  # Check whitelist
  unless ALLOWED_WEBHOOK_HOSTS.any? { |host| uri.host.end_with?(host) }
    raise SecurityError, "Webhook host not in whitelist: #{uri.host}"
  end

  true
rescue IPAddr::InvalidAddressError
  # Not an IP, continue with host validation
  true
end
```

### 2. Header Injection Prevention

**Issue:** Prevent malicious header injection

**Solution:**
```ruby
def sanitize_headers(headers)
  headers.each do |key, value|
    # Remove newlines and null bytes
    sanitized_key = key.to_s.gsub(/[\r\n\0]/, '')
    sanitized_value = value.to_s.gsub(/[\r\n\0]/, '')

    # Validate header name format
    unless sanitized_key.match?(/\A[A-Za-z0-9\-]+\z/)
      raise SecurityError, "Invalid header name: #{key}"
    end

    headers[sanitized_key] = sanitized_value
  end
end
```

### 3. Sensitive Data in Logs

**Issue:** API keys, tokens in logs

**Solution:**
```ruby
def log_webhook_execution(webhook_result, response)
  sanitized_headers = webhook_result.headers.dup
  sanitized_headers['Authorization'] = '[REDACTED]' if sanitized_headers['Authorization']

  logger.info(
    event: 'webhook_executed',
    url: webhook_result.url,
    method: webhook_result.method,
    headers: sanitized_headers,
    status: response[:status],
    success: response[:success]
  )
end
```

### 4. Timeout Protection

**Issue:** Prevent hung requests

**Solution:**
```ruby
# Already implemented in WebhookExecutor
DEFAULT_TIMEOUT = 30 # seconds
conn.options.timeout = timeout
conn.options.open_timeout = 10
```

### 5. Rate Limiting

**Issue:** Prevent abuse

**Solution:**
```ruby
class WebhookRateLimiter
  def initialize(max_requests: 100, per_seconds: 60)
    @max_requests = max_requests
    @per_seconds = per_seconds
    @requests = []
  end

  def check_rate_limit!(webhook_url)
    now = Time.now
    @requests.reject! { |time| time < now - @per_seconds }

    if @requests.count >= @max_requests
      raise RateLimitError, 'Too many webhook requests'
    end

    @requests << now
  end
end
```

---

## 📈 Performance Considerations

### Webhook Timeout Configuration

```ruby
# Default: 30 seconds
# Adjust based on webhook service SLAs

# Fast webhooks (Slack, etc): 10s
WebhookExecutor.execute(result, timeout: 10)

# Slow webhooks (report generation): 60s
WebhookExecutor.execute(result, timeout: 60)

# Very slow (video processing): 120s
WebhookExecutor.execute(result, timeout: 120)
```

### Async Webhook Execution (Future Enhancement)

For very slow webhooks, consider async execution:

```ruby
# Execute webhook in background job
class WebhookJob < ApplicationJob
  def perform(webhook_result, user_id)
    response = WebhookExecutor.execute(webhook_result)

    # Notify user of completion via WebSocket or email
    notify_user(user_id, response)
  end
end

# In action:
execute: lambda { |context, result_builder|
  webhook = result_builder.webhook('https://slow-service.com/api', ...)

  # Queue for background execution
  WebhookJob.perform_later(webhook, context.caller.id)

  result_builder.success('Webhook queued for execution')
}
```

### Memory Management

```ruby
# Large response handling
MAX_RESPONSE_SIZE = 1_048_576 # 1MB

if response.body.bytesize > MAX_RESPONSE_SIZE
  {
    truncated: true,
    message: 'Response too large',
    preview: response.body[0...1000]
  }
end
```

---

## ✅ Acceptance Criteria

### Functional Requirements

- [ ] `WebhookResult` class defined with all attributes
- [ ] `ResultBuilder#webhook` creates webhook results
- [ ] `WebhookExecutor` service executes HTTP requests
- [ ] All HTTP methods supported (GET, POST, PUT, PATCH, DELETE)
- [ ] Custom headers included in requests
- [ ] Request body JSON-encoded
- [ ] Timeout configurable (default 30s)
- [ ] Success responses (2xx) return success result
- [ ] Client errors (4xx) return error result with details
- [ ] Server errors (5xx) return error result with details
- [ ] Network errors handled gracefully
- [ ] SSL errors handled gracefully
- [ ] Timeout errors handled gracefully
- [ ] Large responses (>1MB) truncated
- [ ] JSON responses parsed correctly
- [ ] Non-JSON responses returned as text
- [ ] Action context helpers implemented

### Security Requirements

- [ ] Webhook URL validation prevents SSRF
- [ ] Header injection prevention
- [ ] Sensitive data redacted from logs
- [ ] Timeout protection active
- [ ] Rate limiting (optional but recommended)

### Error Handling

- [ ] Invalid webhook URL returns validation error
- [ ] Invalid HTTP method returns validation error
- [ ] Connection failures return clear error message
- [ ] Timeout returns clear error message
- [ ] HTTP errors include status and response body
- [ ] All errors caught and formatted consistently

### Performance

- [ ] Webhook execution completes within timeout
- [ ] Memory usage reasonable for large responses
- [ ] Concurrent webhook executions don't block each other
- [ ] No memory leaks in long-running processes

### Testing

- [ ] Unit test coverage >95%
- [ ] All HTTP methods tested
- [ ] All error scenarios tested
- [ ] Integration tests with WebMock
- [ ] Real webhook testing in staging

### Documentation

- [ ] API documentation complete
- [ ] Usage examples for common services
- [ ] Security best practices documented
- [ ] Timeout configuration documented
- [ ] CHANGELOG updated

---

## 🚀 Success Metrics

**Track after deployment:**

1. **Webhook Action Usage:** Number of actions using webhooks
2. **Success Rate:** % of successful webhook executions (target >95%)
3. **Failure Rate:** % of failed webhooks by error type
4. **Average Execution Time:** Time to complete webhook calls
5. **Timeout Rate:** % of webhooks that timeout
6. **Popular Integrations:** Which services users integrate with most
7. **User Feedback:** Satisfaction with webhook functionality

---

## 🔗 Integration Examples Summary

| Service | Use Case | Authentication | Endpoint Pattern |
|---------|----------|----------------|------------------|
| Slack | Notifications | Webhook URL | POST to incoming webhook |
| SendGrid | Email sending | API Key | POST /v3/mail/send |
| Mailgun | Email sending | API Key | POST /messages |
| Stripe | Payments | Secret Key | POST to various endpoints |
| Zendesk | Ticket creation | Basic Auth | POST /api/v2/tickets.json |
| GitHub | CI/CD trigger | Bearer token | POST to actions API |
| Twilio | SMS sending | API Key/Secret | POST /Messages.json |
| Zapier | Workflow trigger | Webhook URL | POST to zap webhook |

---

This implementation completes webhook action support and enables powerful integrations with external services, matching the Node.js agent functionality!
