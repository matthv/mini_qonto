# TODO 002: CSV Streaming Export - Implementation Guide

## Critical Priority (P0) - Forest Admin Agent Ruby

**Project:** mini_qonto
**Target Package:** forest_admin_agent (via agent-ruby)
**Estimated Effort:** 3-5 days
**Priority:** P0 - Critical for production use with large datasets

---

## 🎯 Executive Summary

Transform CSV export from memory-intensive to streaming architecture to prevent OOM errors and timeouts with large datasets.

**Current Problem:**

- Loads ALL records into memory before generating CSV
- 100k records = ~500MB memory usage
- Export times >180 seconds cause timeouts
- Risk of application crashes with large exports

**Target Solution:**

- Stream records in 1000-record batches
- Constant ~10MB memory usage regardless of size
- Client receives data within 1 second (TTFB)
- Can handle million+ record exports safely

---

## 📊 Current vs Target Architecture

### Current Flow (Problematic)

```
┌─────────────┐
│  Request    │
│  GET /csv   │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│  Fetch ALL records   │◄── ❌ Memory spike here
│  (100k records)      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Build entire CSV    │◄── ❌ More memory
│  string in memory    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Send full response  │◄── ❌ Client waits entire time
└──────────────────────┘
```

### Target Flow (Streaming)

```
┌─────────────┐
│  Request    │
│  GET /csv   │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│  Send CSV header     │◄── ✅ Immediate response
└──────┬───────────────┘
       │
       ▼
    ┌──┴──────────────────────┐
    │                         │
    ▼                         ▼
┌────────────┐          ┌────────────┐
│ Fetch 1000 │          │ Fetch 1000 │  ✅ Small batches
│  records   │   ...    │  records   │
└─────┬──────┘          └─────┬──────┘
      │                       │
      ▼                       ▼
┌────────────┐          ┌────────────┐
│ Convert &  │          │ Convert &  │  ✅ Constant memory
│   Stream   │   ...    │   Stream   │
└─────┬──────┘          └─────┬──────┘
      │                       │
      └───────┬───────────────┘
              ▼
      ┌───────────────┐
      │   Response    │  ✅ Chunked transfer
      │   Complete    │
      └───────────────┘
```

---

## 🔧 Implementation Details

### File 1: Create Streaming CSV Generator

**Location:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/utils/csv_generator_stream.rb`

```ruby
# frozen_string_literal: true

require 'csv'

module ForestAdminAgent
  module Utils
    class CsvGeneratorStream
      CHUNK_SIZE = 1000

      # @param collection [ForestAdminDatasourceToolkit::Collection] The collection to export
      # @param caller [ForestAdminDatasourceToolkit::Components::Caller] The authenticated caller
      # @param filter [ForestAdminDatasourceToolkit::Components::Query::Filter] Query filter
      # @param projection [ForestAdminDatasourceToolkit::Components::Query::Projection] Fields to include
      # @param limit_export_size [Integer, nil] Maximum number of records to export
      # @return [Enumerator] Lazy enumerator that yields CSV rows
      def self.stream(collection, caller, filter, projection, limit_export_size = nil)
        Enumerator.new do |yielder|
          begin
            # Yield header row first (client receives immediately)
            yielder << generate_header(projection)

            offset = 0

            loop do
              # Fetch batch of records
              batch_filter = filter.override({ page: Page.new(offset, CHUNK_SIZE) })
              records = collection.list(caller, batch_filter, projection)

              # Break if no more records
              break if records.empty?

              # Convert each record to CSV row and yield immediately
              records.each do |record|
                yielder << generate_row(record, projection)
              end

              # Update offset
              offset += CHUNK_SIZE

              # Check if we've reached the export limit
              break if limit_export_size && offset >= limit_export_size

              # Check if this was a partial batch (last batch)
              break if records.length < CHUNK_SIZE

              # Periodic garbage collection to prevent memory creep
              GC.start(full_mark: false) if (offset % 10_000).zero?
            end
          rescue IOError, Errno::EPIPE => e
            # Client disconnected - clean up gracefully
            Facades::Container.logger&.log(
              'Info',
              "CSV export interrupted at offset #{offset}: #{e.message}"
            )
          end
        end
      end

      # Generate CSV header row from projection
      # @param projection [Projection] Field projection
      # @return [String] CSV header line
      def self.generate_header(projection)
        headers = projection.columns.map(&:to_s)
        CSV.generate_line(headers)
      end

      # Generate CSV row from record data
      # @param record [Hash] Record data
      # @param projection [Projection] Field projection
      # @return [String] CSV data line
      def self.generate_row(record, projection)
        values = projection.columns.map do |column|
          value = record[column]
          format_value(value)
        end
        CSV.generate_line(values)
      end

      # Format individual value for CSV output
      # @param value [Object] Value to format
      # @return [String] Formatted value
      def self.format_value(value)
        case value
        when nil
          ''
        when Date, DateTime, Time
          value.respond_to?(:iso8601) ? value.iso8601 : value.to_s
        when TrueClass, FalseClass
          value.to_s
        when Array, Hash
          # Serialize complex types as JSON, truncate if too large
          json = value.to_json
          json.length > 10_000 ? "#{json[0...10_000]}..." : json
        when String
          # Truncate very long strings
          value.length > 10_000 ? "#{value[0...10_000]}..." : value
        else
          value.to_s
        end
      end

      private_class_method :generate_header, :generate_row, :format_value
    end
  end
end
```

**Key Implementation Points:**

1. **Enumerator Pattern:** Ruby's `Enumerator` provides lazy evaluation - rows generated on-demand
2. **Batching:** Fetches 1000 records at a time via `Page.new(offset, CHUNK_SIZE)`
3. **Immediate Yielding:** Each row yielded as soon as converted (not accumulated)
4. **Memory Management:** Periodic GC prevents memory creep in very long exports
5. **Error Handling:** Gracefully handles client disconnection (IOError, EPIPE)
6. **Value Formatting:** Handles dates, booleans, arrays, nulls, and truncates large values

---

### File 2: Update CSV Route Handler

**Location:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/routes/resources/csv.rb`

**Changes Required:**

```ruby
# frozen_string_literal: true

module ForestAdminAgent
  module Routes
    module Resources
      class Csv < AbstractAuthenticatedRoute
        def setup_routes(router)
          router.add_route(
            'forest_csv',
            'get',
            '/forest/:collection_name.csv',
            ->(args) { handle_request(args) },
            'csv'
          )
        end

        def handle_request(args = {})
          build(args)

          # Check permissions
          @permissions.can?(:browse, @collection)
          @permissions.can?(:export, @collection)

          # Parse query parameters
          projection = Utils::QueryStringParser.parse_projection_with_pks(@collection, args)
          filter = build_filter(args)

          # Return streaming enumerator instead of full CSV string
          {
            content: {
              type: 'Stream',  # New type flag
              enumerator: Utils::CsvGeneratorStream.stream(
                @collection,
                @caller,
                filter,
                projection,
                Facades::Container.cache(:limit_export_size)
              ),
              headers: {
                'Content-Type' => 'text/csv; charset=utf-8',
                'Content-Disposition' => "attachment; filename=\"#{filename}\"",
                'Cache-Control' => 'no-cache',
                'X-Accel-Buffering' => 'no'  # Disable nginx buffering
              }
            },
            status: 200
          }
        end

        private

        def filename
          now = Time.now.strftime('%Y%m%d_%H%M%S')
          "#{@collection.name}_export_#{now}.csv"
        end

        def build_filter(args)
          # Get scope-based filter
          scope = @permissions.get_scope(@collection)

          # Parse condition tree from query
          condition_tree = Utils::QueryStringParser.parse_condition_tree(@collection, args)

          # Combine scope and filter
          combined_filter = if scope && condition_tree
                              ForestAdminDatasourceToolkit::Components::Query::ConditionTree::ConditionTreeFactory
                                .intersect([scope, condition_tree])
                            else
                              scope || condition_tree
                            end

          # Build full filter with search, segment, pagination
          Utils::ContextFilterFactory.build(
            @collection,
            @caller,
            combined_filter,
            args,
            include_pagination: true  # Important: respect pagination for export limits
          )
        end
      end
    end
  end
end
```

**Key Changes:**

1. **Return Type:** Changed from `{ export: csv_string }` to `{ type: 'Stream', enumerator: ... }`
2. **Headers:** Added CSV-specific headers including filename
3. **Nginx Buffering:** Disabled via `X-Accel-Buffering: no` for immediate streaming
4. **Filter Building:** Properly combines scope + conditions + search + segment

---

### File 3: Update Rails Controller

**Location:** `agent-ruby/packages/forest_admin_rails/app/controllers/forest_admin_rails/forest_controller.rb`

**Changes Required:**

```ruby
def forest_response(data = {})
  # Handle streaming responses (NEW)
  if data.dig(:content, :type) == 'Stream'
    return handle_streaming_response(data)
  end

  # Handle file downloads
  if data.dig(:content, :type) == 'File'
    return send_data(
      data[:content][:stream].read,
      filename: data[:content][:name],
      type: data[:content][:mimeType],
      disposition: 'attachment'
    )
  end

  # Handle regular JSON/CSV responses
  response.headers.merge!(data.dig(:content, :headers) || {})

  format.json { render json: data[:content], status: data[:status] }
  format.csv { render plain: data[:content][:export], status: data[:status] }
end

private

# Handle streaming response (enumerator-based)
def handle_streaming_response(data)
  enumerator = data[:content][:enumerator]
  headers = data[:content][:headers] || {}

  # Merge headers
  response.headers.merge!(headers)

  # Set response status
  response.status = data[:status] || 200

  # Stream the enumerator
  # Rails will automatically use chunked transfer encoding
  self.response_body = enumerator
end
```

**Key Changes:**

1. **Streaming Detection:** Check for `type: 'Stream'` in response
2. **Header Management:** Apply custom headers (Content-Type, Content-Disposition)
3. **Body Assignment:** Set `response_body = enumerator` (Rails handles chunking)
4. **Status Code:** Properly set HTTP status

---

### File 4: Update Related CSV Route

**Location:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/routes/resources/related/csv_related.rb`

**Changes Required:**

```ruby
def handle_request(args = {})
  build(args)

  # Parse parent ID
  parent_id = Utils::Id.unpack_id(@collection.schema, args[:params][:parent_id])

  # Get relation name
  relation_name = args[:params][:relation_name]

  # Check permissions on related collection
  @permissions.can?(:browse, @related_collection)
  @permissions.can?(:export, @related_collection)

  # Build projection for related records
  projection = Utils::QueryStringParser.parse_projection_with_pks(@related_collection, args)

  # Build filter for related records
  filter = build_related_filter(args, parent_id, relation_name)

  # Return streaming response
  {
    content: {
      type: 'Stream',
      enumerator: Utils::CsvGeneratorStream.stream(
        @related_collection,
        @caller,
        filter,
        projection,
        Facades::Container.cache(:limit_export_size)
      ),
      headers: {
        'Content-Type' => 'text/csv; charset=utf-8',
        'Content-Disposition' => "attachment; filename=\"#{filename(relation_name)}\"",
        'Cache-Control' => 'no-cache',
        'X-Accel-Buffering' => 'no'
      }
    },
    status: 200
  }
end

private

def filename(relation_name)
  now = Time.now.strftime('%Y%m%d_%H%M%S')
  "#{@collection.name}_#{relation_name}_export_#{now}.csv"
end

def build_related_filter(args, parent_id, relation_name)
  # Build base filter for related records
  base_filter = @related_collection.get_relation_filter(parent_id, relation_name)

  # Parse additional conditions from query
  condition_tree = Utils::QueryStringParser.parse_condition_tree(@related_collection, args)

  # Combine filters
  combined = if base_filter && condition_tree
               ForestAdminDatasourceToolkit::Components::Query::ConditionTree::ConditionTreeFactory
                 .intersect([base_filter, condition_tree])
             else
               base_filter || condition_tree
             end

  # Apply scope and other filters
  Utils::ContextFilterFactory.build(
    @related_collection,
    @caller,
    combined,
    args,
    include_pagination: true
  )
end
```

---

## 🧪 Testing Strategy

### Test File 1: Unit Tests

**Location:** `agent-ruby/packages/forest_admin_agent/spec/lib/forest_admin_agent/utils/csv_generator_stream_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe ForestAdminAgent::Utils::CsvGeneratorStream do
  let(:collection) { instance_double('Collection') }
  let(:caller) { instance_double('Caller') }
  let(:filter) { instance_double('Filter') }
  let(:projection) do
    instance_double('Projection', columns: [:id, :name, :email, :created_at])
  end

  describe '.stream' do
    context 'with empty dataset' do
      it 'yields only header' do
        allow(filter).to receive(:override).and_return(filter)
        allow(collection).to receive(:list).and_return([])

        enumerator = described_class.stream(collection, caller, filter, projection)
        rows = enumerator.to_a

        expect(rows.size).to eq(1)
        expect(rows.first).to eq("id,name,email,created_at\n")
      end
    end

    context 'with small dataset' do
      let(:records) do
        [
          { id: 1, name: 'Alice', email: 'alice@example.com', created_at: Time.parse('2025-01-01 12:00:00 UTC') },
          { id: 2, name: 'Bob', email: 'bob@example.com', created_at: Time.parse('2025-01-02 13:00:00 UTC') }
        ]
      end

      it 'yields header plus data rows' do
        allow(filter).to receive(:override).and_return(filter)
        allow(collection).to receive(:list).and_return(records, [])

        enumerator = described_class.stream(collection, caller, filter, projection)
        rows = enumerator.to_a

        expect(rows.size).to eq(3)  # header + 2 rows
        expect(rows[0]).to include('id,name,email,created_at')
        expect(rows[1]).to include('1,Alice,alice@example.com')
        expect(rows[2]).to include('2,Bob,bob@example.com')
      end

      it 'formats dates as ISO8601' do
        allow(filter).to receive(:override).and_return(filter)
        allow(collection).to receive(:list).and_return(records, [])

        enumerator = described_class.stream(collection, caller, filter, projection)
        rows = enumerator.to_a

        expect(rows[1]).to include('2025-01-01T12:00:00')
        expect(rows[2]).to include('2025-01-02T13:00:00')
      end
    end

    context 'with large dataset' do
      it 'fetches records in batches of 1000' do
        batch1 = Array.new(1000) { |i| { id: i, name: "User#{i}", email: "user#{i}@example.com" } }
        batch2 = Array.new(500) { |i| { id: 1000 + i, name: "User#{1000 + i}", email: "user#{1000 + i}@example.com" } }

        call_count = 0
        allow(filter).to receive(:override) do |opts|
          call_count += 1
          filter
        end

        allow(collection).to receive(:list) do
          case call_count
          when 1 then batch1
          when 2 then batch2
          else []
          end
        end

        enumerator = described_class.stream(collection, caller, filter, projection)
        rows = enumerator.to_a

        expect(rows.size).to eq(1 + 1500)  # header + 1500 records
        expect(call_count).to eq(2)  # 2 batches
      end
    end

    context 'with export limit' do
      it 'respects limit_export_size' do
        records = Array.new(1000) { |i| { id: i, name: "User#{i}" } }

        allow(filter).to receive(:override).and_return(filter)
        allow(collection).to receive(:list).and_return(records)

        enumerator = described_class.stream(collection, caller, filter, projection, 500)
        rows = enumerator.to_a

        expect(rows.size).to eq(1 + 500)  # header + 500 records (not 1000)
      end
    end

    context 'with special characters' do
      let(:records) do
        [
          { id: 1, name: 'User, with comma', email: 'test@example.com' },
          { id: 2, name: 'User "with quotes"', email: 'test2@example.com' },
          { id: 3, name: "User\nwith\nnewlines", email: 'test3@example.com' }
        ]
      end

      it 'properly escapes CSV special characters' do
        allow(filter).to receive(:override).and_return(filter)
        allow(collection).to receive(:list).and_return(records, [])

        enumerator = described_class.stream(collection, caller, filter, projection)
        rows = enumerator.to_a

        # CSV.generate_line handles escaping
        expect(rows[1]).to include('"User, with comma"')
        expect(rows[2]).to include('User ""with quotes""')
      end
    end

    context 'with complex data types' do
      let(:records) do
        [
          { id: 1, name: 'Test', tags: ['ruby', 'rails'], metadata: { key: 'value' } }
        ]
      end
      let(:projection) { instance_double('Projection', columns: [:id, :name, :tags, :metadata]) }

      it 'serializes arrays and hashes as JSON' do
        allow(filter).to receive(:override).and_return(filter)
        allow(collection).to receive(:list).and_return(records, [])

        enumerator = described_class.stream(collection, caller, filter, projection)
        rows = enumerator.to_a

        expect(rows[1]).to include('["ruby","rails"]')
        expect(rows[1]).to include('{"key":"value"}')
      end
    end

    context 'with nil values' do
      let(:records) do
        [
          { id: 1, name: nil, email: 'test@example.com' }
        ]
      end

      it 'formats nil as empty string' do
        allow(filter).to receive(:override).and_return(filter)
        allow(collection).to receive(:list).and_return(records, [])

        enumerator = described_class.stream(collection, caller, filter, projection)
        rows = enumerator.to_a

        # CSV with empty field between two commas
        expect(rows[1]).to match(/\d+,,test@example\.com/)
      end
    end

    context 'with very large values' do
      let(:records) do
        [
          { id: 1, name: 'A' * 20_000, email: 'test@example.com' }
        ]
      end

      it 'truncates values over 10KB' do
        allow(filter).to receive(:override).and_return(filter)
        allow(collection).to receive(:list).and_return(records, [])

        enumerator = described_class.stream(collection, caller, filter, projection)
        rows = enumerator.to_a

        expect(rows[1]).to include('...')
        expect(rows[1].length).to be < 15_000  # Much less than 20k
      end
    end
  end
end
```

---

### Test File 2: Integration Tests

**Location:** `agent-ruby/packages/forest_admin_agent/spec/integration/csv_export_streaming_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe 'CSV Export Streaming', type: :request do
  let(:collection_name) { 'users' }
  let(:auth_token) { generate_jwt_token }

  before do
    # Setup authenticated session
    allow(ForestAdminAgent::Services::Permissions).to receive(:new).and_return(
      instance_double('Permissions', can?: true, get_scope: nil)
    )
  end

  context 'with small dataset' do
    before { create_list(:user, 10) }

    it 'exports all records as CSV' do
      get "/forest/#{collection_name}.csv", headers: { 'Authorization' => "Bearer #{auth_token}" }

      expect(response.status).to eq(200)
      expect(response.headers['Content-Type']).to include('text/csv')
      expect(response.headers['Content-Disposition']).to include('attachment')
      expect(response.headers['Content-Disposition']).to include('users_export_')

      csv = CSV.parse(response.body, headers: true)
      expect(csv.length).to eq(10)
    end
  end

  context 'with large dataset' do
    before { create_list(:user, 5000) }

    it 'streams response with chunked transfer encoding' do
      get "/forest/#{collection_name}.csv", headers: { 'Authorization' => "Bearer #{auth_token}" }

      expect(response.status).to eq(200)
      # Rails uses chunked transfer for enumerator responses
      expect(response.headers['Transfer-Encoding']).to eq('chunked').or be_nil  # May not be visible in tests

      csv = CSV.parse(response.body, headers: true)
      expect(csv.length).to eq(5000)
    end

    it 'maintains low memory usage during export' do
      # Track memory before
      memory_before = memory_usage_mb

      get "/forest/#{collection_name}.csv", headers: { 'Authorization' => "Bearer #{auth_token}" }

      # Force GC to get accurate measurement
      GC.start
      memory_after = memory_usage_mb

      memory_increase = memory_after - memory_before

      # Memory increase should be minimal (< 20MB for 5k records)
      expect(memory_increase).to be < 20
    end
  end

  context 'with export limit configured' do
    before do
      ForestAdminAgent::Facades::Container.cache[:limit_export_size] = 100
      create_list(:user, 1000)
    end

    after do
      ForestAdminAgent::Facades::Container.cache.delete(:limit_export_size)
    end

    it 'respects limit_export_size configuration' do
      get "/forest/#{collection_name}.csv", headers: { 'Authorization' => "Bearer #{auth_token}" }

      expect(response.status).to eq(200)

      csv = CSV.parse(response.body, headers: true)
      expect(csv.length).to eq(100)  # Limited, not 1000
    end
  end

  context 'with filters applied' do
    before do
      create_list(:user, 50, active: true)
      create_list(:user, 50, active: false)
    end

    it 'exports only filtered records' do
      filter_json = { field: 'active', operator: 'equal', value: true }.to_json

      get "/forest/#{collection_name}.csv",
          params: { filters: filter_json },
          headers: { 'Authorization' => "Bearer #{auth_token}" }

      expect(response.status).to eq(200)

      csv = CSV.parse(response.body, headers: true)
      expect(csv.length).to eq(50)  # Only active users
    end
  end

  context 'with related records export' do
    let(:company) { create(:company) }

    before { create_list(:user, 100, company: company) }

    it 'exports related records as CSV' do
      get "/forest/companies/#{company.id}/relationships/users.csv",
          headers: { 'Authorization' => "Bearer #{auth_token}" }

      expect(response.status).to eq(200)
      expect(response.headers['Content-Type']).to include('text/csv')

      csv = CSV.parse(response.body, headers: true)
      expect(csv.length).to eq(100)
    end
  end

  context 'with permission denied' do
    before do
      allow_any_instance_of(ForestAdminAgent::Services::Permissions).to receive(:can?)
        .with(:export, anything)
        .and_raise(ForestAdminAgent::Http::Exceptions::ForbiddenError)
    end

    it 'returns 403 Forbidden' do
      get "/forest/#{collection_name}.csv", headers: { 'Authorization' => "Bearer #{auth_token}" }

      expect(response.status).to eq(403)
    end
  end

  private

  def memory_usage_mb
    `ps -o rss= -p #{Process.pid}`.to_i / 1024.0
  end

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

### Test File 3: Performance Tests

**Location:** `spec/performance/csv_export_performance_spec.rb`

```ruby
require 'spec_helper'
require 'benchmark'
require 'memory_profiler'

RSpec.describe 'CSV Export Performance', type: :performance do
  let(:auth_token) { generate_jwt_token }

  context 'response time' do
    [1_000, 10_000, 50_000].each do |record_count|
      it "exports #{record_count} records in reasonable time" do
        create_list(:user, record_count)

        time = Benchmark.measure do
          get "/forest/users.csv", headers: { 'Authorization' => "Bearer #{auth_token}" }
          expect(response.status).to eq(200)
        end

        # Performance targets (adjust based on your hardware)
        max_time = case record_count
                   when 1_000 then 5    # 5 seconds
                   when 10_000 then 20  # 20 seconds
                   when 50_000 then 60  # 60 seconds
                   end

        puts "  ✓ #{record_count} records exported in #{time.real.round(2)}s"
        expect(time.real).to be < max_time
      end
    end
  end

  context 'memory usage' do
    it 'maintains constant memory usage across different dataset sizes' do
      results = []

      [1_000, 10_000, 50_000].each do |record_count|
        # Clean database
        User.destroy_all
        GC.start

        create_list(:user, record_count)

        # Measure memory
        report = MemoryProfiler.report do
          get "/forest/users.csv", headers: { 'Authorization' => "Bearer #{auth_token}" }
          expect(response.status).to eq(200)
        end

        memory_mb = report.total_allocated_memsize / 1024.0 / 1024.0
        results << { count: record_count, memory: memory_mb }

        puts "  ✓ #{record_count} records: #{memory_mb.round(2)} MB allocated"
      end

      # Memory usage should not scale linearly with record count
      # With streaming, 10x records should not use 10x memory
      ratio_10k_to_1k = results[1][:memory] / results[0][:memory]
      ratio_50k_to_10k = results[2][:memory] / results[1][:memory]

      expect(ratio_10k_to_1k).to be < 5   # Should not be 10x
      expect(ratio_50k_to_10k).to be < 3  # Should grow sublinearly
    end
  end

  context 'time to first byte' do
    before { create_list(:user, 10_000) }

    it 'responds quickly with first chunk' do
      start_time = Time.now
      first_byte_time = nil

      # Manually stream response to capture TTFB
      uri = URI("http://localhost:#{Rails.application.config.port}/forest/users.csv")
      Net::HTTP.start(uri.host, uri.port) do |http|
        request = Net::HTTP::Get.new(uri)
        request['Authorization'] = "Bearer #{auth_token}"

        http.request(request) do |response|
          response.read_body do |chunk|
            first_byte_time ||= Time.now
            break  # Only measure time to first chunk
          end
        end
      end

      ttfb = first_byte_time - start_time

      puts "  ✓ Time to First Byte: #{(ttfb * 1000).round(2)}ms"
      expect(ttfb).to be < 1.0  # Less than 1 second
    end
  end

  context 'concurrent exports' do
    before { create_list(:user, 5_000) }

    it 'handles multiple concurrent exports' do
      threads = []
      results = []

      5.times do
        threads << Thread.new do
          time = Benchmark.measure do
            get "/forest/users.csv", headers: { 'Authorization' => "Bearer #{auth_token}" }
          end
          results << { status: response.status, time: time.real }
        end
      end

      threads.each(&:join)

      # All requests should succeed
      expect(results.map { |r| r[:status] }).to all(eq(200))

      # Average time should be reasonable even under load
      avg_time = results.sum { |r| r[:time] } / results.size
      puts "  ✓ Average time for 5 concurrent exports: #{avg_time.round(2)}s"
      expect(avg_time).to be < 30
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

### Phase 1: Core Implementation (Day 1-2)

- [ ] Create `CsvGeneratorStream` class with streaming logic
- [ ] Add proper error handling (IOError, EPIPE)
- [ ] Add value formatting (dates, booleans, arrays, nulls)
- [ ] Add truncation for large values (>10KB)
- [ ] Update `Csv` route to return streaming response
- [ ] Update `CsvRelated` route to return streaming response
- [ ] Update `ForestController` to handle `Stream` response type
- [ ] Add `X-Accel-Buffering: no` header for nginx compatibility

### Phase 2: Testing (Day 2-3)

- [ ] Write unit tests for `CsvGeneratorStream`
  - [ ] Empty dataset
  - [ ] Small dataset
  - [ ] Large dataset (batching)
  - [ ] Export limit
  - [ ] Special characters
  - [ ] Complex data types
  - [ ] Nil values
  - [ ] Large values (truncation)
- [ ] Write integration tests
  - [ ] Small dataset export
  - [ ] Large dataset streaming
  - [ ] Memory usage verification
  - [ ] Export limit enforcement
  - [ ] Filter application
  - [ ] Related records export
  - [ ] Permission checks
- [ ] Write performance tests
  - [ ] Response time benchmarks
  - [ ] Memory usage profiling
  - [ ] Time to first byte
  - [ ] Concurrent exports

### Phase 3: Edge Cases & Optimization (Day 3-4)

- [ ] Handle client disconnection gracefully
- [ ] Add periodic garbage collection (every 10k records)
- [ ] Test with database connection pooling
- [ ] Test with nginx/reverse proxy
- [ ] Test with different application servers (Puma, Unicorn)
- [ ] Verify thread safety
- [ ] Profile memory with `memory_profiler` gem
- [ ] Benchmark against Node.js implementation

### Phase 4: Documentation & Deployment (Day 4-5)

- [ ] Update code comments
- [ ] Update README with streaming behavior
- [ ] Document configuration options
- [ ] Create migration guide from old CSV export
- [ ] Add performance benchmarks to docs
- [ ] Update CHANGELOG
- [ ] Create PR with detailed description
- [ ] Request code review
- [ ] Address review feedback
- [ ] Deploy to staging environment
- [ ] Test in staging with production data volumes
- [ ] Deploy to production with monitoring

---

## 🚀 Deployment Considerations

### Application Server Compatibility

**Recommended: Puma (Threaded)**

```ruby
# config/puma.rb
workers ENV.fetch("WEB_CONCURRENCY") { 2 }
threads_count = ENV.fetch("RAILS_MAX_THREADS") { 5 }
threads threads_count, threads_count
```

**Works With:**

- ✅ Puma (recommended)
- ✅ Unicorn (with caveats)
- ⚠️ Passenger (test thoroughly)
- ❌ WEBrick (development only)

### Reverse Proxy Configuration

**Nginx:**

```nginx
location /forest {
  proxy_pass http://rails_app;
  proxy_buffering off;  # Important for streaming!
  proxy_set_header X-Accel-Buffering no;
  proxy_read_timeout 300s;  # Allow long exports
}
```

**HAProxy:**

```
backend rails
  option http-server-close
  timeout server 300s
  server app1 127.0.0.1:3000
```

### Database Considerations

**Connection Pooling:**

```ruby
# config/database.yml
production:
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
  # Increase timeout for long-running queries
  checkout_timeout: 10
```

**Query Optimization:**

```ruby
# Ensure indexes exist for common filters
add_index :users, :created_at
add_index :users, :active
add_index :users, [:company_id, :created_at]
```

### Monitoring

**Add Metrics:**

```ruby
# config/initializers/instrumentation.rb
ActiveSupport::Notifications.subscribe('csv_export.forest_admin') do |name, start, finish, id, payload|
  duration = finish - start
  record_count = payload[:record_count]

  # Send to your metrics system
  StatsD.timing('forest_admin.csv_export.duration', duration)
  StatsD.gauge('forest_admin.csv_export.records', record_count)
end
```

**Usage in CsvGeneratorStream:**

```ruby
ActiveSupport::Notifications.instrument('csv_export.forest_admin', record_count: offset) do
  # ... streaming logic
end
```

### Error Alerting

```ruby
# config/initializers/error_tracking.rb
Rails.error.subscribe do |error, handled:, severity:, context:|
  if context[:source] == 'csv_export'
    Sentry.capture_exception(error, {
      tags: { component: 'csv_export' },
      extra: context
    })
  end
end
```

---

## ✅ Acceptance Criteria (Final Checklist)

### Functional

- [ ] CSV exports use streaming (chunked transfer encoding)
- [ ] Memory usage constant (~10MB) for all dataset sizes
- [ ] Exports complete successfully for 100k+ records
- [ ] Related records export streams correctly
- [ ] Export limit (`limit_export_size`) respected
- [ ] Filters, search, segments applied correctly
- [ ] Permissions checked before export
- [ ] Special characters properly escaped
- [ ] All data types formatted correctly
- [ ] Empty datasets handled (header only)

### Performance

- [ ] Time to first byte < 1 second
- [ ] 100k records export < 60 seconds
- [ ] Memory usage < 15MB for any export size
- [ ] No timeouts on large exports
- [ ] Concurrent exports don't exhaust resources

### Quality

- [ ] Unit test coverage > 90%
- [ ] Integration tests pass
- [ ] Performance tests pass
- [ ] No memory leaks detected
- [ ] Thread-safe implementation
- [ ] Error handling comprehensive
- [ ] Logging appropriate
- [ ] Documentation complete

### Production Readiness

- [ ] Tested with production data volumes
- [ ] Tested with nginx/reverse proxy
- [ ] Tested with Puma/Unicorn
- [ ] Monitoring instrumented
- [ ] Error alerting configured
- [ ] Rollback plan documented
- [ ] Performance benchmarks recorded

---

## 🎯 Success Metrics (Post-Deployment)

**Track These Metrics:**

1. **Export Success Rate:** Target >99.5%
2. **Average Export Time:** 100k records < 60s
3. **P95 Export Time:** < 90s
4. **Memory Usage:** Max 20MB per export
5. **Error Rate:** < 0.5%
6. **Client Timeout Rate:** < 0.1%

**Monitor For:**

- OOM errors (should disappear)
- Export timeouts (should decrease dramatically)
- User complaints about export failures (should reduce)
- Database connection pool saturation (should remain stable)

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue 1: "Response not streaming"**

- Check nginx `proxy_buffering off`
- Verify `X-Accel-Buffering: no` header
- Ensure using Puma (not WEBrick)

**Issue 2: "Memory still growing"**

- Check GC calls (every 10k records)
- Verify no variable accumulation in loop
- Profile with `memory_profiler` gem

**Issue 3: "Slow exports"**

- Check database query performance
- Add indexes for common filters
- Increase database connection pool
- Consider read replica for exports

**Issue 4: "Client disconnection not detected"**

- IOError/EPIPE rescue may be missing
- Test with `curl` and CTRL+C
- Check server logs for cleanup

---

This detailed guide should provide everything needed to implement CSV streaming successfully. The implementation is critical for production stability with large datasets.
