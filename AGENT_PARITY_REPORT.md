# Backend Agent Parity Audit Report

## Node.js (Source of Truth) vs Ruby (Target Implementation)

**Generated:** 2025-10-17
**Auditor:** Claude Code
**Scope:** Backend server logic only (no CLI)

---

## Section A: Summary of Findings

### Overview

The Ruby agent implementation demonstrates **~90% feature parity** with the Node.js agent. The implementation is production-ready with comprehensive CRUD operations, authentication, authorization, and external integrations.

### Major Gaps Identified

1. **Missing Routes**

   - ❌ Update Field endpoint for array field element manipulation
   - ✅ Extra: Ruby has explicit logout endpoint (Node.js doesn't)

2. **Streaming & Memory Management**

   - ❌ CSV export loads full dataset into memory (Node.js streams)
   - ❌ File action results with streaming not visible
   - Impact: Memory issues with large exports

3. **Webhook Support**

   - ❌ Webhook action result type not implemented
   - Impact: Limited action response types

4. **Configuration Granularity**

   - ❌ Missing body size limits configuration
   - ❌ Missing experimental feature flags
   - ❌ Missing skipSchemaUpdate option
   - Impact: Less deployment flexibility

5. **Error Response Format**
   - ⚠️ Missing error.data payload field
   - ⚠️ Missing error name in response
   - ⚠️ Missing status code in error body
   - Impact: Less detailed error information

### Architectural Differences (Acceptable)

- **Concurrency Model**: Node.js async/await vs Ruby sync + Rails threading
- **JWT Validation**: Node.js uses global middleware, Ruby validates per-route
- **IP Whitelist Scope**: Node.js applies globally, Ruby only on auth routes
- **Caching Strategy**: Node.js in-memory, Ruby file-based
- **SSE Handling**: Node.js abstracts via client library, Ruby custom implementation

### Ruby Implementation Strengths

- ✅ Explicit logout endpoint
- ✅ Schema append capability (`append_schema_path`)
- ✅ File-based caching (resilient across restarts)
- ✅ Permission refetch on denial (retry logic)
- ✅ Granular SSE cache key invalidation

---

## Section B: Parity Matrix

| Capability                | NodeJS Reference                                     | Ruby Status                | Notes                                 |
| ------------------------- | ---------------------------------------------------- | -------------------------- | ------------------------------------- |
| **HTTP Endpoints**        |
| Health Check              | `GET /`                                              | Present                    | Ruby forces schema send in production |
| Authentication Start      | `POST /authentication`                               | Present                    | Full parity                           |
| Auth Callback             | `GET /authentication/callback`                       | Present                    | Full parity                           |
| Logout                    | N/A                                                  | Present                    | Ruby has extra endpoint               |
| List Records              | `GET /:collection`                                   | Present                    | Full parity                           |
| Count Records             | `GET /:collection/count`                             | Present                    | Full parity                           |
| Show Record               | `GET /:collection/:id`                               | Present                    | Full parity                           |
| Create Record             | `POST /:collection`                                  | Present                    | Full parity                           |
| Update Record             | `PUT /:collection/:id`                               | Present                    | Full parity                           |
| Delete Record             | `DELETE /:collection/:id`                            | Present                    | Full parity                           |
| Bulk Delete               | `DELETE /:collection`                                | Present                    | Full parity                           |
| CSV Export                | `GET /:collection.csv`                               | Present                    | Not streamed (loads in memory)        |
| Update Field              | `PUT /:collection/:id/relationships/:field/:index`   | Missing                    | Array field updates not supported     |
| List Related              | `GET /:collection/:id/relationships/:relation`       | Present                    | Full parity                           |
| Count Related             | `GET /:collection/:id/relationships/:relation/count` | Present                    | Full parity                           |
| CSV Related               | `GET /:collection/:id/relationships/:relation.csv`   | Present                    | Not streamed                          |
| Associate Related         | `POST /:collection/:id/relationships/:relation`      | Present                    | Full parity                           |
| Dissociate Related        | `DELETE /:collection/:id/relationships/:relation`    | Present                    | Full parity                           |
| Update Relation           | `PUT /:collection/:id/relationships/:relation`       | Present                    | Full parity                           |
| Collection Chart          | `POST /stats/:collection`                            | Present                    | Full parity                           |
| API Charts                | Dynamic generation                                   | Present                    | Full parity                           |
| Execute Action            | `POST /_actions/:collection/:index/:slug`            | Present                    | Full parity                           |
| Action Hooks              | Load/Change/Search                                   | Present                    | Full parity                           |
| Native Query              | `POST /_internal/native_query`                       | Present                    | Full parity                           |
| Capabilities              | `POST /_internal/capabilities`                       | Present                    | Full parity                           |
| **Middleware**            |
| CORS                      | @koa/cors                                            | Rack::Cors                 | Full parity + private network access  |
| Body Parser               | @koa/bodyparser                                      | Rails default              | Less configurable                     |
| JWT Validation            | koa-jwt (global)                                     | Per-route check            | Different approach                    |
| Logger                    | Custom middleware                                    | Rails logger               | Different implementation              |
| Error Handler             | Custom middleware                                    | Module inclusion           | Different pattern                     |
| IP Whitelist              | Global middleware                                    | Auth routes only           | Narrower scope                        |
| **Authentication**        |
| OAuth Flow                | OIDC                                                 | OIDC                       | Full parity                           |
| JWT Signing               | jsonwebtoken/HS256                                   | JWT.encode/HS256           | Full parity                           |
| Token Storage             | Cookie `forest_session_token`                        | Authorization header       | Different approach                    |
| Token Validation          | koa-jwt                                              | Manual JWT.decode          | Different approach                    |
| Logout                    | N/A                                                  | POST endpoint              | Ruby extra feature                    |
| **Authorization**         |
| Permission Actions        | browse/read/add/edit/delete/export                   | Same via can?()            | Full parity                           |
| Smart Actions             | ActionAuthorizationService                           | can_smart_action?          | Full parity                           |
| Scopes                    | getScope() → ConditionTree                           | get_scope()                | Full parity                           |
| Context Variables         | Injected via service                                 | ContextVariablesInjector   | Full parity                           |
| Permission Caching        | In-memory, 15min TTL                                 | File-based, 15min TTL      | Different storage                     |
| Cache Invalidation        | invalidateScopeCache()                               | invalidate_cache()         | Full parity                           |
| IP Whitelist              | forest-ip-utils                                      | Custom implementation      | Full parity                           |
| **Configuration**         |
| Auth Secret               | ✅ authSecret                                        | ✅ auth_secret             | Full parity                           |
| Env Secret                | ✅ envSecret                                         | ✅ env_secret              | Full parity                           |
| Forest Server URL         | ✅ forestServerUrl                                   | ✅ forest_server_url       | Full parity                           |
| Logger                    | ✅ logger function                                   | ✅ logger lambda           | Full parity                           |
| Logger Level              | ✅ loggerLevel                                       | ✅ logger_level            | Full parity                           |
| Schema Path               | ✅ schemaPath                                        | ✅ schema_path             | Full parity                           |
| URL Prefix                | ✅ prefix                                            | ❌ Not configurable        | Rails routing handles                 |
| Max Body Size             | ✅ maxBodySize                                       | ❌ Not exposed             | Missing                               |
| Skip Schema Update        | ✅ skipSchemaUpdate                                  | ❌ Not exposed             | Missing                               |
| Experimental Flags        | ✅ experimental.\*                                   | ❌ Not exposed             | Missing                               |
| Append Schema             | ❌ Not supported                                     | ✅ append_schema_path      | Ruby extra feature                    |
| Cache Directory           | N/A (in-memory)                                      | ✅ cache_dir               | Ruby file-based                       |
| **Data Serialization**    |
| JSON:API Format           | json-api-serializer                                  | jsonapi-serializers        | Full parity                           |
| ID Packing                | Pipe separator `\|`                                  | Same                       | Full parity                           |
| Composite IDs             | Supported                                            | Supported                  | Full parity                           |
| Relationships             | All types supported                                  | All types supported        | Full parity                           |
| Search Metadata           | serializeWithSearchMetadata()                        | handle_search_decorator()  | Full parity                           |
| Serializer Caching        | WeakMap per schema                                   | Re-created each time       | No optimization                       |
| **External Integrations** |
| ForestAdmin Client        | @forestadmin/forestadmin-client                      | Custom Faraday client      | Different approach                    |
| Schema Submission         | postSchema()                                         | POST /forest/apimaps       | Full parity                           |
| Schema Hash Check         | Implicit in client                                   | Explicit API call          | Different approach                    |
| SSE                       | Client library (abstract)                            | ld-eventsource (manual)    | Different approach                    |
| SSE Event Handling        | onRefreshCustomizations → restart                    | Event → cache invalidation | Different strategy                    |
| Webhooks                  | Webhook action type                                  | Not implemented            | Missing                               |
| **Error Handling**        |
| ValidationError           | ✅ → 400                                             | ✅ Custom class            | Full parity                           |
| ForbiddenError            | ✅ → 403                                             | ✅ → 403                   | Full parity                           |
| NotFoundError             | ✅ → 404                                             | ✅ → 404                   | Full parity                           |
| UnprocessableError        | ✅ → 422                                             | ✅ → 422                   | Full parity                           |
| BadRequestError           | ✅ → 400                                             | ❌ Not distinct            | Partial                               |
| BusinessError             | ✅ → 422                                             | ❌ Not distinct            | Partial                               |
| Error Response Format     | `{ errors: [{ name, detail, status, data }] }`       | Varies                     | Different format                      |
| Error Name in Response    | ✅ Included                                          | ❌ Not included            | Missing                               |
| Error Data Payload        | ✅ BusinessError.data                                | ❌ Not supported           | Missing                               |
| Custom Error Messages     | ✅ customizeErrorMessage                             | ✅ customize_error_message | Full parity                           |
| Debug Logging             | ✅ Colored console output                            | ⚠️ Less detailed           | Partial                               |
| **Async/Concurrency**     |
| Concurrency Model         | Async/await, Promises                                | Sync + Rails threading     | Fundamental difference                |
| CSV Streaming             | ✅ Async generator                                   | ❌ Full array in memory    | Missing                               |
| Large Dataset Handling    | Paginated + streamed                                 | Paginated only             | Partial                               |
| Memory Efficiency         | Constant memory                                      | O(n) for exports           | Less efficient                        |
| **Startup/Shutdown**      |
| Datasource Building       | Async                                                | Sync                       | Full parity (different paradigm)      |
| Schema Generation         | Parallel with router                                 | Sequential                 | Different approach                    |
| Route Bootstrap           | Parallel                                             | Sequential                 | Different approach                    |
| SSE Subscription          | In start()                                           | In load_configuration()    | Full parity                           |
| Graceful Shutdown         | forestAdminClient.close()                            | Implicit Rails shutdown    | Partial visibility                    |
| Health Check Response     | 200 with message                                     | 204 + force schema send    | Different behavior                    |

---

## Section C: TODO Backlog

### TODO 001: Implement Update Field Endpoint

**NodeJS Reference:** `agent-nodejs/packages/agent/src/routes/modification/update-field.ts`

**Ruby Status:** Missing

**Expected Behavior:**

- Endpoint: `PUT /forest/:collection_name/:id/relationships/:field_name/:index`
- Allows updating individual elements in array-type fields
- Supports nested object updates within arrays
- Validates field type is array before allowing operation

**Implementation Notes:**

- Create new route class `ForestAdminAgent::Routes::Resources::UpdateField`
- Extend `AbstractAuthenticatedRoute`
- Parse composite ID using existing `IdUtils.unpack_id`
- Extract field name and index from params
- Validate field schema is array type
- Use collection.update() to modify specific array element
- Return updated record via serializer

**Acceptance Criteria:**

- Can update element at specific array index via REST API
- Returns 404 if index out of bounds
- Returns 422 if field is not an array
- Proper permission checks (assertCanEdit)
- Integration tests for array field updates

**Priority:** P1
**Effort:** M

---

### TODO 002: Implement CSV Streaming Export

**NodeJS Reference:** `agent-nodejs/packages/agent/src/utils/csv-generator.ts` (async generator pattern)

**Ruby Status:** Partial (loads all records into memory)

**Expected Behavior:**

- CSV export streams data to client in chunks
- Constant memory usage regardless of export size
- Paginated record fetching (1000 records per chunk)
- Supports backpressure from HTTP client
- Handles client disconnection gracefully

**Implementation Notes:**

- Use Ruby `Enumerator` pattern for lazy evaluation
- Implement chunked pagination in `CsvGenerator.generate`
- Return `Enumerator::Yielder` from route handler
- Configure Rails streaming response:
  ```ruby
  response.headers['Content-Type'] = 'text/csv'
  response.headers['Content-Disposition'] = "attachment; filename=#{filename}"
  self.response_body = CsvGenerator.stream(records, projection)
  ```
- Implement `CsvGenerator.stream` method:
  ```ruby
  def self.stream(collection, caller, filter, projection)
    Enumerator.new do |yielder|
      yielder << header_row
      offset = 0
      loop do
        batch = collection.list(caller, filter.page(offset, 1000), projection)
        break if batch.empty?
        batch.each { |record| yielder << format_row(record, projection) }
        offset += 1000
      end
    end
  end
  ```

**Acceptance Criteria:**

- Memory usage remains constant for exports of any size
- Export of 100k+ records doesn't cause memory issues
- Client can start downloading immediately (chunked transfer)
- Proper error handling if stream interrupted
- Performance comparable to Node.js implementation

**Priority:** P0
**Effort:** L

---

### TODO 003: Add Webhook Action Result Type

**NodeJS Reference:** `agent-nodejs/packages/agent/src/services/model-customizations/actions/webhook/execute-webhook.ts`

**Ruby Status:** Missing

**Expected Behavior:**

- Actions can declare result type 'Webhook'
- When action executed, agent POSTs to webhook URL
- Webhook receives: `{ action: { name, scope }, record(s): [...] }`
- Webhook response displayed to user as action result
- Error handling for webhook failures

**Implementation Notes:**

- Add webhook result type to action execution router
- Create `ForestAdminAgent::Services::Actions::WebhookExecutor` class
- Use Faraday to POST to webhook URL
- Payload format:
  ```ruby
  {
    action: { name: action_name, scope: 'Single|Bulk|Global' },
    record: record_data  # or records: [...]
  }
  ```
- Handle HTTP errors and timeouts
- Return webhook response to frontend
- Add configuration for webhook timeout (default 30s)

**Acceptance Criteria:**

- Actions with webhook type execute correctly
- Webhook receives proper payload format
- Webhook response displayed in UI
- Timeouts handled gracefully
- 4xx/5xx errors from webhook shown to user
- Test coverage for webhook execution

**Priority:** P1
**Effort:** M

---

### TODO 004: Implement Streaming File Action Results

**NodeJS Reference:** Action result type 'File' with `stream` property

**Ruby Status:** Not visible in codebase

**Expected Behavior:**

- Actions can return file downloads
- Large files streamed (not loaded into memory)
- Proper Content-Type and Content-Disposition headers
- Supports binary files (PDFs, images, archives)

**Implementation Notes:**

- Add 'File' result type to action execution
- Support result format:
  ```ruby
  {
    type: 'File',
    stream: IO/StringIO/Enumerator,
    name: 'filename.ext',
    mimeType: 'application/pdf'
  }
  ```
- In ForestController, detect File result type:
  ```ruby
  if result[:type] == 'File'
    send_data result[:stream].read,
              filename: result[:name],
              type: result[:mimeType],
              disposition: 'attachment'
  end
  ```
- Support streaming for large files using `send_file` or chunked streaming

**Acceptance Criteria:**

- Actions can return file downloads
- Large files (>50MB) stream efficiently
- Proper MIME types set
- Filename with special characters handled
- Binary files work correctly
- Test coverage for file actions

**Priority:** P1
**Effort:** M

---

### TODO 005: Add Body Size Limit Configuration

**NodeJS Reference:** `options.maxBodySize`, `options.bodyParserOptions.jsonLimit`

**Ruby Status:** Missing (uses Rails defaults)

**Expected Behavior:**

- Configuration option to limit request body size
- Applies to POST/PUT/PATCH requests
- Returns 413 Payload Too Large for oversized requests
- Default: 50MB (match Node.js)

**Implementation Notes:**

- Add configuration option to `ForestAdminRails.config`:
  ```ruby
  setting :max_body_size, default: 50.megabytes
  ```
- Add Rack middleware to check Content-Length header:
  ```ruby
  class BodySizeLimitMiddleware
    def call(env)
      if env['CONTENT_LENGTH'].to_i > @max_size
        return [413, {}, ['Payload Too Large']]
      end
      @app.call(env)
    end
  end
  ```
- Insert middleware early in stack
- Document configuration in README

**Acceptance Criteria:**

- Large request bodies rejected with 413
- Configurable via `max_body_size` option
- Default matches Node.js (50MB)
- Error message clear and helpful
- Test coverage for limit enforcement

**Priority:** P2
**Effort:** S

---

### TODO 006: Add Experimental Feature Flags

**NodeJS Reference:** `options.experimental.webhookCustomActions`, `options.experimental.updateRecordCustomActions`

**Ruby Status:** Missing

**Expected Behavior:**

- Configuration option for experimental features
- Flags: `webhook_custom_actions`, `update_record_custom_actions`
- Features disabled by default
- Allow gradual rollout of new features

**Implementation Notes:**

- Add configuration hash to `ForestAdminRails.config`:
  ```ruby
  setting :experimental, default: {
    webhook_custom_actions: false,
    update_record_custom_actions: false
  }
  ```
- Check flags before executing experimental features
- Add to schema metadata for frontend awareness
- Document experimental features in changelog

**Acceptance Criteria:**

- Flags configurable in initialization
- Features properly gated by flags
- Schema metadata includes experimental flags
- Documentation explains each flag
- Flags default to false (opt-in)

**Priority:** P2
**Effort:** S

---

### TODO 007: Add skipSchemaUpdate Configuration

**NodeJS Reference:** `options.skipSchemaUpdate`

**Ruby Status:** Missing

**Expected Behavior:**

- Configuration flag to skip schema updates
- Useful for cloud deployments (AWS Lambda, Cloud Run)
- Useful when multiple instances run simultaneously
- Schema loaded from file, not sent to server

**Implementation Notes:**

- Add configuration option:
  ```ruby
  setting :skip_schema_update, default: false
  ```
- In `AgentFactory#send_schema`, check flag:
  ```ruby
  def send_schema(force: false)
    return if Facades::Container.cache(:skip_schema_update) && !force
    # ... existing logic
  end
  ```
- Log when schema update skipped
- Document use cases in README

**Acceptance Criteria:**

- Flag properly skips schema POST
- Schema still loaded from file
- Health check doesn't trigger schema send
- Useful for serverless deployments
- Test coverage for skip behavior

**Priority:** P2
**Effort:** S

---

### TODO 008: Enhance Error Response Format

**NodeJS Reference:** `agent-nodejs/packages/agent/src/routes/system/error-handling.ts` (lines 44-62)

**Ruby Status:** Partial (missing fields)

**Expected Behavior:**

- Error response includes:
  - `name`: Error class name
  - `detail`: Error message
  - `status`: HTTP status code
  - `data`: Additional error payload (optional)
- Format: `{ errors: [{ name, detail, status, data }] }`

**Implementation Notes:**

- Update error handling in ForestController:
  ```ruby
  def exception_handler(exception)
    data = {
      errors: [{
        name: exception.class.name.demodulize,
        detail: get_error_message(exception),
        status: exception.try(:status) || 500,
        data: exception.try(:data)
      }]
    }
    render json: data, status: exception.try(:status) || 500
  end
  ```
- Add `data` attribute to custom exception classes
- Update tests to check new format

**Acceptance Criteria:**

- All error responses include name, detail, status
- BusinessError.data payload included when present
- Format matches Node.js exactly
- Frontend can parse error responses
- Test coverage for error format

**Priority:** P2
**Effort:** S

---

### TODO 009: Implement Serializer Caching

**NodeJS Reference:** `agent-nodejs/packages/agent/src/services/serializer.ts` (WeakMap caching)

**Ruby Status:** Missing (serializers re-created each request)

**Expected Behavior:**

- Serializer instances cached per collection schema
- Cache invalidated when schema changes
- Reduces object allocation overhead
- Improves response time

**Implementation Notes:**

- Create singleton cache for serializers:

  ```ruby
  class SerializerCache
    @cache = {}

    def self.get(collection)
      key = collection.object_id
      @cache[key] ||= ForestSerializer.new(collection)
    end

    def self.invalidate
      @cache.clear
    end
  end
  ```

- Use in serialization:
  ```ruby
  def self.serialize(collection, records)
    serializer = SerializerCache.get(collection)
    serializer.serialize(records)
  end
  ```
- Clear cache on schema reload

**Acceptance Criteria:**

- Serializers reused across requests
- Memory usage doesn't grow unbounded
- Performance improvement measurable (>5% faster)
- Cache invalidated on schema change
- Test coverage for caching behavior

**Priority:** P2
**Effort:** M

---

### TODO 010: Add Global JWT Middleware (Optional)

**NodeJS Reference:** `agent-nodejs/packages/agent/src/routes/security/authentication.ts` (koa-jwt middleware)

**Ruby Status:** Divergent (per-route validation)

**Expected Behavior:**

- JWT validation handled by Rack middleware
- Applied globally before route processing
- Sets current user in request context
- Consistent with Node.js architecture

**Implementation Notes:**

- Create Rack middleware:

  ```ruby
  class JwtAuthenticationMiddleware
    def call(env)
      return @app.call(env) if public_route?(env)

      token = extract_token(env)
      decoded = JWT.decode(token, secret, true, { algorithm: 'HS256' })
      env['forest.user'] = decoded[0]

      @app.call(env)
    rescue JWT::DecodeError
      [401, {}, [{ error: 'Invalid token' }.to_json]]
    end
  end
  ```

- Insert in middleware stack after CORS
- Remove per-route authentication checks
- Access user via `request.env['forest.user']`

**Acceptance Criteria:**

- JWT validation centralized
- All authenticated routes protected
- Public routes (health check) bypass validation
- Performance impact minimal
- Test coverage for middleware

**Priority:** P3
**Effort:** M

---

### TODO 011: Extend IP Whitelist Scope to All Routes

**NodeJS Reference:** `agent-nodejs/packages/agent/src/routes/security/ip-whitelist.ts` (global middleware)

**Ruby Status:** Divergent (authentication routes only)

**Expected Behavior:**

- IP whitelist check applies to all Forest Admin routes
- Consistent security posture with Node.js
- Early rejection of unauthorized IPs

**Implementation Notes:**

- Create Rack middleware:

  ```ruby
  class IpWhitelistMiddleware
    def call(env)
      return @app.call(env) unless whitelist_enabled?

      ip = env['action_dispatch.remote_ip']
      unless IpWhitelist.new.ip_matches_any_rule?(ip)
        return [403, {}, [{ error: "IP rejected: #{ip}" }.to_json]]
      end

      @app.call(env)
    end
  end
  ```

- Insert middleware early in stack
- Remove IP check from authentication route
- Log rejected IPs

**Acceptance Criteria:**

- All routes protected by IP whitelist
- Non-whitelisted IPs rejected with 403
- Performance impact minimal
- Whitelist rules properly applied
- Test coverage for middleware

**Priority:** P3
**Effort:** S

---

### TODO 012: Add BadRequestError and BusinessError Types

**NodeJS Reference:** `@forestadmin/datasource-toolkit` error types

**Ruby Status:** Partial (not distinct types)

**Expected Behavior:**

- `BadRequestError` (400) for invalid request format
- `BusinessError` (422) for business logic violations
- Distinct from ValidationError

**Implementation Notes:**

- Create error classes:

  ```ruby
  class BadRequestError < HttpException
    def initialize(message)
      super(message, 400, 'BadRequestError')
    end
  end

  class BusinessError < HttpException
    attr_reader :data

    def initialize(message, data = nil)
      super(message, 422, 'BusinessError')
      @data = data
    end
  end
  ```

- Use in appropriate contexts:
  - BadRequestError: Malformed JSON, invalid query params
  - BusinessError: Invariant violations, workflow errors
- Update error handler to recognize new types

**Acceptance Criteria:**

- New error types defined
- Used appropriately in codebase
- Error responses include correct status codes
- BusinessError.data included in response
- Test coverage for new errors

**Priority:** P3
**Effort:** S

---

### TODO 013: Add Detailed Debug Logging

**NodeJS Reference:** `agent-nodejs/packages/agent/src/routes/system/error-handling.ts` (lines 93-113, colored console output)

**Ruby Status:** Partial (less detailed)

**Expected Behavior:**

- Non-production mode shows detailed error logs
- Color-coded console output
- Request details: method, path, query, body
- Full stack traces
- Clear error boundaries

**Implementation Notes:**

- Enhance error logging:

  ```ruby
  def debug_log_error(request, exception)
    return if Facades::Container.cache(:is_production)

    puts "\n\e[33m===== An exception was raised =====\e[0m"
    puts "#{request.method} \e[34m#{request.path}\e[36m?#{request.query_string}\e[0m"

    if %w[POST PUT PATCH].include?(request.method)
      puts "Body \e[36m#{request.body.read}\e[0m"
    end

    puts "\e[31m#{exception.message}\e[0m"
    puts exception.backtrace.join("\n")
    puts "\e[33m===================================\e[0m\n"
  end
  ```

- Call in exception_handler
- Format similar to Node.js output

**Acceptance Criteria:**

- Debug logs match Node.js format
- Color coding works in terminal
- Only active in non-production
- Request details included
- Stack trace readable

**Priority:** P3
**Effort:** S

---

## Section D: Test & Observability Plan

### API-Level Tests

**Endpoint Compatibility Tests:**

1. Create test suite that compares responses from Node.js and Ruby implementations
2. Test cases for each endpoint in parity matrix
3. Assert response format, status codes, headers match
4. Test error scenarios (404, 403, 422, 500)

**Test Scenarios:**

```ruby
describe 'API Parity Tests' do
  it 'lists records with same format as Node.js' do
    response = get '/forest/users'
    expect(response.status).to eq(200)
    expect(response.body).to match_json_schema('jsonapi')
    # Compare with Node.js response structure
  end

  it 'handles CSV export' do
    response = get '/forest/users.csv'
    expect(response.headers['Content-Type']).to include('text/csv')
    expect(response.body).to include('id,name,email')
  end

  it 'executes smart actions' do
    response = post '/forest/_actions/users/0/send_email'
    expect(response.status).to eq(200)
    expect(response.body).to have_key('success')
  end
end
```

### Integration Tests

**Authentication Flow:**

- OAuth initiation returns authorization URL
- Callback exchanges code for token
- Token validates correctly on subsequent requests
- Logout invalidates token

**Permission System:**

- CRUD permissions enforced
- Scopes filter records correctly
- Smart action permissions checked
- IP whitelist blocks unauthorized IPs

**Data Operations:**

- Create/Update/Delete operations work
- Relationships associate/dissociate correctly
- Bulk operations handle multiple records
- CSV export generates valid CSV

### Expected Logs/Metrics/Traces

**Startup Logs:**

```
[Info] Forest Admin Agent starting...
[Info] Loading configuration from ForestAdminRails.config
[Info] Building datasource with X collections
[Info] Registering Y routes
[Info] Schema sent to Forest Admin API
[Info] SSE connection established
[Info] Successfully mounted on Rails
```

**Request Logs:**

```
[Info] [200] GET /forest/users - 45ms
[Warn] [403] POST /forest/products - 12ms - IP rejected: 192.168.1.100
[Error] [500] PUT /forest/orders/123 - 89ms - ActiveRecord::RecordNotFound
```

**Error Logs (Debug Mode):**

```
===== An exception was raised =====
PUT /forest/orders/123?timezone=Europe/Paris
Body { "data": { "attributes": { "status": "shipped" } } }
 ActiveRecord::RecordNotFound: Couldn't find Order with id=123
   /app/routes/resources/update.rb:23:in `handle_request`
   ...
===================================
```

**Metrics to Track:**

- Request throughput (requests/sec)
- Response times (p50, p95, p99)
- Error rates by status code
- CSV export memory usage
- Permission cache hit rate
- Schema sync frequency

### Monitoring Recommendations

1. **Application Performance Monitoring (APM):**

   - New Relic, DataDog, or Scout APM
   - Track endpoint performance
   - Monitor memory usage during exports

2. **Error Tracking:**

   - Sentry or Rollbar
   - Capture and group exceptions
   - Alert on critical errors

3. **Logging:**

   - Structured JSON logging in production
   - Log aggregation (Splunk, ELK, CloudWatch)
   - Correlation IDs for request tracing

4. **Health Checks:**
   - Monitor `/forest/` endpoint
   - Alert if health check fails
   - Track schema sync success/failure

---

## Section E: Risks / Incompatibilities

### Semantic Differences: Node.js vs Ruby

#### 1. Concurrency Model

**Risk:** Fundamentally different execution models

**Node.js:**

- Single-threaded event loop
- Non-blocking I/O
- Async/await for concurrency
- Promises for parallel operations

**Ruby:**

- Multi-threaded (Puma) or multi-process (Unicorn)
- Blocking I/O by default
- Thread safety concerns
- No native async/await

**Impact:**

- Ruby implementation is inherently synchronous
- CSV exports block thread until complete
- Large exports can cause thread starvation
- Need careful thread-safe coding practices

**Mitigation:**

- Implement streaming exports (TODO 002)
- Use thread pools appropriately
- Consider async libraries for high-load scenarios
- Monitor thread usage and saturation

---

#### 2. Exception Handling

**Risk:** Different exception propagation models

**Node.js:**

- Promises catch errors via `.catch()` or `try/catch`
- Errors don't crash entire process
- Middleware error handlers catch all

**Ruby:**

- Exceptions bubble up call stack
- Uncaught exceptions can crash thread
- Rails rescues exceptions at controller level

**Impact:**

- Need comprehensive error handling at route level
- Missing `rescue` blocks can leak sensitive data
- Stack traces may differ in format

**Mitigation:**

- Wrap all route logic in `rescue` blocks
- Use Rails error handling consistently
- Test exception scenarios thoroughly
- Never let exceptions bubble to Rack level

---

#### 3. JSON Serialization

**Risk:** Subtle differences in JSON encoding

**Node.js:**

- `JSON.stringify()` handles undefined → omitted
- BigInt not supported (throws)
- Date → ISO string
- NaN/Infinity → null

**Ruby:**

- `to_json` handles nil → null
- BigDecimal supported
- Date → string (custom format)
- NaN/Infinity → null

**Impact:**

- Potential schema mismatches
- Frontend may receive unexpected formats
- Numeric precision differences

**Mitigation:**

- Use JSON:API serializer consistently
- Explicit type coercion in serializers
- Test with edge cases (nil, NaN, large numbers)
- Document any format differences

---

#### 4. HTTP Client Behavior

**Risk:** Different HTTP library semantics

**Node.js (superagent):**

- Follows redirects automatically
- Timeout handling via `.timeout()`
- Automatic retries not default

**Ruby (Faraday):**

- Redirects configurable
- Timeout via `request: { timeout: x }`
- Retry logic via middleware

**Impact:**

- Webhook behavior may differ
- Timeout handling inconsistent
- SSL verification defaults differ

**Mitigation:**

- Configure Faraday to match superagent behavior
- Explicit timeout settings
- Test webhook integration thoroughly
- Document HTTP client configuration

---

#### 5. ID Type Coercion

**Risk:** Different string/number coercion rules

**Node.js:**

- String to Number: `Number("123")` → 123
- Empty string: `Number("")` → 0
- Invalid: `Number("abc")` → NaN

**Ruby:**

- String to Integer: `"123".to_i` → 123
- Empty string: `"".to_i` → 0
- Invalid: `"abc".to_i` → 0 (no error!)

**Impact:**

- Invalid IDs silently coerced to 0
- Query filters may behave differently
- Primary key lookups could fail silently

**Mitigation:**

- Use `Integer("123")` which raises on invalid input
- Validate ID format explicitly
- Test with malformed ID inputs
- Match Node.js validation logic exactly

---

#### 6. Timezone Handling

**Risk:** Different timezone library behaviors

**Node.js (luxon):**

- IANA timezone database
- DST handling automatic
- Invalid timezone → error

**Ruby (ActiveSupport::TimeZone):**

- IANA + Rails timezone names
- DST handling automatic
- Invalid timezone → falls back to UTC

**Impact:**

- Timezone validation differs
- Date queries may return different results
- User timezone context handling

**Mitigation:**

- Validate timezones using same list as Node.js
- Test DST transitions
- Document accepted timezone formats
- Use IANA names exclusively

---

#### 7. CSV Generation

**Risk:** Different CSV encoding behaviors

**Node.js (@fast-csv/format):**

- Streams output
- Configurable delimiters
- Automatic quoting

**Ruby (CSV stdlib):**

- Generates full string or array
- Configurable delimiters
- Automatic quoting

**Impact:**

- Memory usage differs significantly
- Large exports may timeout in Ruby
- Character encoding differences (UTF-8 BOM)

**Mitigation:**

- Implement streaming CSV (TODO 002)
- Force UTF-8 encoding explicitly
- Test with large datasets (100k+ records)
- Match quoting behavior exactly

---

#### 8. Event Loop vs Thread Pool

**Risk:** Performance characteristics differ

**Node.js:**

- Event loop handles all I/O
- CPU-bound tasks block event loop
- Single request can't block others (usually)

**Ruby (Rails + Puma):**

- Thread pool handles requests
- CPU-bound tasks block thread
- Can exhaust thread pool

**Impact:**

- Ruby may need more resources for same load
- Concurrent request handling differs
- Background jobs recommended for heavy tasks

**Mitigation:**

- Configure adequate thread pool size
- Move heavy operations to background jobs
- Monitor thread pool saturation
- Use timeouts aggressively

---

#### 9. Authentication Cookie Handling

**Risk:** JWT storage mechanism differs

**Node.js:**

- JWT in cookie `forest_session_token`
- Cookie-based sessions
- CSRF protection needed

**Ruby:**

- JWT in `Authorization` header
- Header-based sessions
- No CSRF concerns

**Impact:**

- Frontend integration may differ
- Cookie vs header authentication
- Session persistence across domains

**Mitigation:**

- Document authentication method clearly
- Support both cookie and header (if feasible)
- Test with production frontend
- Ensure CORS configured correctly

---

### Summary of Incompatibility Risks

| Risk                      | Severity | Likelihood | Impact                               |
| ------------------------- | -------- | ---------- | ------------------------------------ |
| CSV memory usage          | High     | High       | Production outages for large exports |
| Thread pool exhaustion    | High     | Medium     | Degraded performance under load      |
| ID coercion bugs          | Medium   | Medium     | Data integrity issues                |
| Timezone inconsistencies  | Medium   | Low        | Incorrect date filtering             |
| JSON encoding differences | Low      | Low        | Frontend parsing errors              |
| HTTP client behavior      | Low      | Low        | Webhook integration issues           |
| Exception handling gaps   | Medium   | Low        | Information leakage                  |
| Event loop vs threading   | Low      | Low        | Performance characteristics          |
| Cookie authentication     | Low      | Low        | Frontend integration issues          |

**Highest Risk Items:**

1. **CSV Memory Usage** → TODO 002 (P0)
2. **Thread Pool Exhaustion** → Monitor and configure
3. **ID Coercion** → Add explicit validation

---

## Section F: Open Questions / Clarifications

### Implementation Questions

1. **Webhook Actions:**

   - Q: Should Ruby implement webhook actions with same payload format as Node.js?
   - Context: Node.js POSTs to webhook URL with action context
   - Blocker: No webhook implementation visible in Ruby codebase
   - Recommendation: Implement per TODO 003

2. **File Streaming in Actions:**

   - Q: Does Ruby support file action results? If so, where is it implemented?
   - Context: Node.js supports `result.type = 'File'` with streaming
   - Blocker: No evidence of file actions in code review
   - Recommendation: Implement per TODO 004 or clarify if already exists

3. **JWT Cookie vs Header:**

   - Q: Why does Ruby use Authorization header instead of cookie?
   - Context: Node.js uses cookie `forest_session_token`
   - Impact: Frontend integration may differ
   - Recommendation: Clarify intended authentication method, consider supporting both

4. **IP Whitelist Scope:**

   - Q: Is IP whitelist intentionally limited to auth routes only?
   - Context: Node.js applies IP whitelist globally
   - Security Impact: Non-auth routes accessible from any IP
   - Recommendation: Extend to all routes per TODO 011 or document rationale

5. **Schema Append Feature:**
   - Q: What is the use case for `append_schema_path`?
   - Context: Ruby has this feature, Node.js doesn't
   - Impact: Allows merging multiple schema files
   - Recommendation: Document use case, consider porting to Node.js

### Configuration Questions

6. **Body Size Limits:**

   - Q: What is the actual body size limit in Ruby (Rails default)?
   - Context: Node.js defaults to 50MB
   - Impact: Large imports may fail unexpectedly
   - Recommendation: Document actual limit, implement configuration per TODO 005

7. **Experimental Flags:**

   - Q: Are experimental features planned for Ruby?
   - Context: Node.js has `experimental.webhookCustomActions`, etc.
   - Impact: Feature rollout strategy
   - Recommendation: Implement feature flag system per TODO 006

8. **Serializer Performance:**
   - Q: Has serializer caching been considered for Ruby?
   - Context: Node.js caches serializer instances, Ruby recreates each time
   - Impact: Performance overhead on high-traffic endpoints
   - Recommendation: Benchmark impact, implement caching per TODO 009 if measurable

### Architecture Questions

9. **SSE Cache Invalidation Strategy:**

   - Q: Why does Ruby invalidate specific cache keys vs Node.js full restart?
   - Context: Node.js restarts agent on SSE events, Ruby invalidates caches
   - Impact: Different behavior on configuration changes
   - Recommendation: Document both approaches, clarify if behavior should match

10. **Permission Refetch Logic:**

    - Q: Why does Ruby retry permission checks once on denial?
    - Context: Node.js throws immediately on permission denial
    - Impact: Potential race conditions on permission updates
    - Recommendation: Document rationale, consider porting to Node.js

11. **File-based vs In-memory Caching:**
    - Q: What drove decision to use file-based caching in Ruby?
    - Context: Node.js uses in-memory with TTL
    - Impact: Persistence across restarts, shared cache in multi-process
    - Recommendation: Document tradeoffs, benchmark performance impact

### Testing Questions

12. **CSV Streaming Tests:**

    - Q: How to test streaming behavior comprehensively?
    - Context: Need to verify memory doesn't grow with dataset size
    - Recommendation: Memory profiling tests, large dataset integration tests

13. **Cross-implementation Tests:**

    - Q: Should there be a shared test suite for Node.js and Ruby?
    - Context: Ensure behavioral parity across implementations
    - Recommendation: Create API contract tests that run against both

14. **Load Testing:**
    - Q: What are the expected load characteristics?
    - Context: Ruby threading model differs from Node.js event loop
    - Recommendation: Load test both implementations, document capacity

### Documentation Questions

15. **Migration Guide:**

    - Q: Is there a migration guide from Node.js to Ruby agent?
    - Context: Users may switch implementations
    - Impact: Configuration differences, behavior changes
    - Recommendation: Create migration guide highlighting differences

16. **Performance Benchmarks:**

    - Q: Are there performance benchmarks comparing Node.js and Ruby?
    - Context: Users may choose based on performance
    - Recommendation: Publish benchmarks for common operations

17. **Feature Parity Status:**
    - Q: Is this parity report the canonical source of truth?
    - Context: Need to track parity over time
    - Recommendation: Maintain parity matrix, update with each release

---

## Conclusion

The Ruby agent implementation has achieved impressive feature parity with the Node.js agent (~90%), with most core functionality working correctly. The primary gaps are in advanced features (streaming, webhooks, array field updates) and configuration granularity.

### Immediate Priorities:

1. **CSV Streaming (P0)** - Critical for production use with large datasets
2. **Update Field Endpoint (P1)** - Required for full CRUD parity
3. ~~**Webhook Actions (P1)** - Expanding action capabilities~~ Not a priority
4. **File Actions (P1)** - Complete action result types

### Recommended Timeline:

- **Sprint 1 (2 weeks):** CSV Streaming (TODO 002)
- **Sprint 2 (1 week):** Update Field Endpoint (TODO 001)
- **Sprint 3 (2 weeks):** ~~Webhook~~ + File Actions (TODO 003, 004)
- **Sprint 4 (1 week):** Configuration enhancements (TODO 005-007)
- **Sprint 5 (1 week):** Error handling + optimizations (TODO 008-009)

With these improvements, the Ruby agent will achieve near-complete parity with Node.js while maintaining its architectural strengths (file-based caching, explicit cache invalidation, Rails integration).
