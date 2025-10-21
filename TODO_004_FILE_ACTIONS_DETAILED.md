# TODO 004: File Streaming in Actions - Implementation Guide
## High Priority (P1) - Forest Admin Agent Ruby

**Project:** mini_qonto
**Target Package:** forest_admin_agent (via agent-ruby)
**Estimated Effort:** 1-2 weeks
**Priority:** P1 - Complete action result types

---

## 🎯 Executive Summary

Implement support for file downloads as Smart Action results, enabling actions to return files (PDFs, CSVs, Excel, images, archives) that stream efficiently to users without loading entire files into memory.

**Current Gap:**
- Smart Actions can only return success/error messages or redirect URLs
- No support for file downloads as action results
- Cannot generate reports, exports, or documents via actions
- Large files would exhaust memory if attempted

**Target Solution:**
- New action result type: `File`
- Streams file content to browser
- Proper Content-Type and Content-Disposition headers
- Supports large files without memory issues
- Works with both generated files (in-memory) and disk files

**Use Cases:**
- Generate PDF report and download immediately
- Export data to Excel file
- Create ZIP archive of selected records
- Generate invoice PDFs
- Download generated images/charts
- Export audit logs to CSV

---

## 📊 Node.js Reference Implementation

### Action Result Type Definition

**File:** `agent-nodejs/packages/datasource-toolkit/src/interfaces/action.ts`

```typescript
export type ActionResult =
  | { type: 'Success'; message: string; invalidated: Set<string>; }
  | { type: 'Error'; message: string; }
  | { type: 'Webhook'; url: string; method: string; headers: object; body: object; }
  | { type: 'File'; stream: Readable; mimeType: string; name: string; }; // ← File result type
```

### Action Handler Example (Node.js)

```typescript
// Example: Generate PDF report action
{
  scope: 'Single',
  execute: async (context, resultBuilder) => {
    const record = await context.getRecord(['id', 'name', 'data']);

    // Generate PDF (using some PDF library)
    const pdfBuffer = await generatePDF(record);

    // Return as file download
    return resultBuilder.file(
      Readable.from(pdfBuffer),  // Stream
      'application/pdf',          // MIME type
      `report-${record.id}.pdf`   // Filename
    );
  }
}
```

### Response Handling (Node.js)

**File:** `agent-nodejs/packages/agent/src/routes/modification/action/action.ts`

```typescript
async handleActionExecution(context: Context) {
  // Execute action
  const result = await action.execute(context);

  if (result.type === 'File') {
    // Set headers for file download
    context.response.set('Content-Type', result.mimeType);
    context.response.set('Content-Disposition', `attachment; filename="${result.name}"`);
    context.response.set('Cache-Control', 'no-cache');

    // Stream file to response
    context.response.body = result.stream;
    context.response.status = 200;
    return;
  }

  // Handle other result types...
}
```

### Key Features:

1. **Result Type:** `{ type: 'File', stream: Readable, mimeType: string, name: string }`
2. **Streaming:** Uses Node.js Readable stream (doesn't load entire file)
3. **Headers:** Proper Content-Type and Content-Disposition
4. **MIME Types:** Any valid MIME type supported
5. **Filename:** Supports special characters, extensions
6. **Memory Efficient:** Streams large files without memory spike

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
│  - Generate file (PDF, CSV, Excel, etc.)        │
│  - Return result: { type: 'File', ... }         │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
        ┌──────────┴─────────┐
        │                    │
        ▼                    ▼
┌──────────────┐     ┌──────────────┐
│ In-Memory    │     │ Disk File    │
│ File         │     │ (Path)       │
│ (StringIO)   │     │              │
└──────┬───────┘     └──────┬───────┘
       │                    │
       └──────────┬─────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  Result Handler                                 │
│  - Detect File result type                      │
│  - Set HTTP headers (Content-Type, etc.)        │
│  - Stream file content to response              │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Rails Controller Response                      │
│  - send_data (for in-memory files)              │
│  - send_file (for disk files)                   │
│  - Streaming with proper headers                │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Details

### File 1: Add File Result Type to Action Definitions

**Location:** `agent-ruby/packages/forest_admin_datasource_toolkit/lib/forest_admin_datasource_toolkit/interfaces/action.rb`

```ruby
# frozen_string_literal: true

module ForestAdminDatasourceToolkit
  module Interfaces
    module Action
      # Action result types
      class ActionResult
        attr_reader :type

        def initialize(type)
          @type = type
        end
      end

      # Success result
      class SuccessResult < ActionResult
        attr_reader :message, :invalidated

        def initialize(message:, invalidated: [])
          super('Success')
          @message = message
          @invalidated = invalidated
        end
      end

      # Error result
      class ErrorResult < ActionResult
        attr_reader :message

        def initialize(message:)
          super('Error')
          @message = message
        end
      end

      # Webhook result
      class WebhookResult < ActionResult
        attr_reader :url, :method, :headers, :body

        def initialize(url:, method: 'POST', headers: {}, body: {})
          super('Webhook')
          @url = url
          @method = method
          @headers = headers
          @body = body
        end
      end

      # File result (NEW)
      class FileResult < ActionResult
        attr_reader :stream, :mime_type, :name

        # @param stream [IO, StringIO, String] File content stream or path
        # @param mime_type [String] MIME type (e.g., 'application/pdf')
        # @param name [String] Filename for download (e.g., 'report.pdf')
        def initialize(stream:, mime_type:, name:)
          super('File')
          @stream = stream
          @mime_type = mime_type
          @name = name
        end

        # Check if stream is a file path
        def file_path?
          stream.is_a?(String) && File.exist?(stream)
        end

        # Check if stream is in-memory
        def in_memory?
          stream.is_a?(IO) || stream.is_a?(StringIO)
        end
      end

      # Result builder for actions
      class ResultBuilder
        # Build success result
        def success(message, invalidated: [])
          SuccessResult.new(message: message, invalidated: invalidated)
        end

        # Build error result
        def error(message)
          ErrorResult.new(message: message)
        end

        # Build webhook result
        def webhook(url, method: 'POST', headers: {}, body: {})
          WebhookResult.new(url: url, method: method, headers: headers, body: body)
        end

        # Build file result
        # @param stream [IO, StringIO, String] File content or path
        # @param mime_type [String] MIME type
        # @param name [String] Filename
        def file(stream, mime_type, name)
          FileResult.new(stream: stream, mime_type: mime_type, name: name)
        end
      end
    end
  end
end
```

---

### File 2: Update Action Execution Handler

**Location:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/routes/action/actions.rb`

**Add file result handling:**

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
          when ForestAdminDatasourceToolkit::Interfaces::Action::FileResult
            handle_file_result(result)
          when ForestAdminDatasourceToolkit::Interfaces::Action::SuccessResult
            handle_success_result(result)
          when ForestAdminDatasourceToolkit::Interfaces::Action::ErrorResult
            handle_error_result(result)
          when ForestAdminDatasourceToolkit::Interfaces::Action::WebhookResult
            handle_webhook_result(result)
          else
            raise Http::Exceptions::UnprocessableError, "Unknown action result type: #{result.class}"
          end
        end

        private

        # Handle file result (NEW)
        def handle_file_result(result)
          {
            content: {
              type: 'File',
              stream: result.stream,
              mime_type: result.mime_type,
              name: result.name,
              headers: {
                'Content-Type' => result.mime_type,
                'Content-Disposition' => build_content_disposition(result.name),
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
              }
            },
            status: 200
          }
        end

        # Build Content-Disposition header with proper filename encoding
        def build_content_disposition(filename)
          # RFC 5987: Handle special characters and non-ASCII filenames
          ascii_filename = filename.encode('ASCII', invalid: :replace, undef: :replace, replace: '_')
          encoded_filename = CGI.escape(filename)

          if filename == ascii_filename
            # Simple ASCII filename
            "attachment; filename=\"#{filename}\""
          else
            # Non-ASCII filename: provide both formats
            "attachment; filename=\"#{ascii_filename}\"; filename*=UTF-8''#{encoded_filename}"
          end
        end

        def handle_success_result(result)
          {
            content: {
              success: result.message,
              refresh: { relationships: result.invalidated }
            },
            status: 200
          }
        end

        def handle_error_result(result)
          {
            content: { error: result.message },
            status: 400
          }
        end

        def handle_webhook_result(result)
          # Webhook implementation (TODO 003)
          response = execute_webhook(result)
          {
            content: response,
            status: 200
          }
        end
      end
    end
  end
end
```

---

### File 3: Update Rails Controller to Handle File Results

**Location:** `agent-ruby/packages/forest_admin_rails/app/controllers/forest_admin_rails/forest_controller.rb`

**Update `forest_response` method:**

```ruby
def forest_response(data = {})
  # Handle file downloads (NEW)
  if data.dig(:content, :type) == 'File'
    return handle_file_response(data)
  end

  # Handle streaming responses (CSV exports)
  if data.dig(:content, :type) == 'Stream'
    return handle_streaming_response(data)
  end

  # Handle regular JSON responses
  response.headers.merge!(data.dig(:content, :headers) || {})
  format.json { render json: data[:content], status: data[:status] }
  format.csv { render plain: data[:content][:export], status: data[:status] }
end

private

# Handle file download response (NEW)
def handle_file_response(data)
  stream = data[:content][:stream]
  mime_type = data[:content][:mime_type]
  filename = data[:content][:name]
  headers = data[:content][:headers] || {}

  # Merge custom headers
  response.headers.merge!(headers)

  # Determine if stream is file path or in-memory
  if stream.is_a?(String) && File.exist?(stream)
    # Disk file: use send_file (more efficient)
    send_file(
      stream,
      filename: filename,
      type: mime_type,
      disposition: 'attachment',
      stream: true,
      buffer_size: 4096
    )
  elsif stream.is_a?(IO) || stream.is_a?(StringIO)
    # In-memory file: use send_data
    send_data(
      stream.read,
      filename: filename,
      type: mime_type,
      disposition: 'attachment'
    )
  else
    raise ArgumentError, "Invalid stream type: #{stream.class}"
  end
end

# Handle streaming response (existing, for CSV exports)
def handle_streaming_response(data)
  enumerator = data[:content][:enumerator]
  headers = data[:content][:headers] || {}

  response.headers.merge!(headers)
  response.status = data[:status] || 200
  self.response_body = enumerator
end
```

---

### File 4: Action Context Helper Methods

**Location:** `agent-ruby/packages/forest_admin_datasource_toolkit/lib/forest_admin_datasource_toolkit/components/action_context.rb`

**Add helper for building file results:**

```ruby
module ForestAdminDatasourceToolkit
  module Components
    class ActionContext
      # ... existing code ...

      # Helper: Create file result from buffer
      # @param content [String] File content
      # @param mime_type [String] MIME type
      # @param filename [String] Filename
      def file_from_buffer(content, mime_type, filename)
        stream = StringIO.new(content)
        Interfaces::Action::FileResult.new(
          stream: stream,
          mime_type: mime_type,
          name: filename
        )
      end

      # Helper: Create file result from disk path
      # @param path [String] File path
      # @param filename [String] Download filename (optional, uses basename if nil)
      def file_from_path(path, filename = nil)
        unless File.exist?(path)
          raise ArgumentError, "File not found: #{path}"
        end

        # Detect MIME type from extension
        mime_type = detect_mime_type(path)
        filename ||= File.basename(path)

        Interfaces::Action::FileResult.new(
          stream: path,
          mime_type: mime_type,
          name: filename
        )
      end

      private

      # Detect MIME type from file extension
      def detect_mime_type(path)
        ext = File.extname(path).downcase
        MIME_TYPES[ext] || 'application/octet-stream'
      end

      MIME_TYPES = {
        '.pdf' => 'application/pdf',
        '.csv' => 'text/csv',
        '.xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls' => 'application/vnd.ms-excel',
        '.docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc' => 'application/msword',
        '.zip' => 'application/zip',
        '.tar' => 'application/x-tar',
        '.gz' => 'application/gzip',
        '.json' => 'application/json',
        '.xml' => 'application/xml',
        '.txt' => 'text/plain',
        '.html' => 'text/html',
        '.png' => 'image/png',
        '.jpg' => 'image/jpeg',
        '.jpeg' => 'image/jpeg',
        '.gif' => 'image/gif',
        '.svg' => 'image/svg+xml',
        '.mp4' => 'video/mp4',
        '.mp3' => 'audio/mpeg',
        '.wav' => 'audio/wav'
      }.freeze
    end
  end
end
```

---

## 📝 Usage Examples

### Example 1: Generate PDF Report

```ruby
# In your customization code:
collection.add_action('Generate Report', {
  scope: 'Single',
  execute: lambda { |context, result_builder|
    # Fetch record data
    record = context.get_record(['id', 'name', 'email', 'created_at'])

    # Generate PDF using a gem like Prawn
    pdf = Prawn::Document.new
    pdf.text "User Report", size: 20, style: :bold
    pdf.text "ID: #{record['id']}"
    pdf.text "Name: #{record['name']}"
    pdf.text "Email: #{record['email']}"
    pdf.text "Created: #{record['created_at']}"

    # Return as file download
    result_builder.file(
      StringIO.new(pdf.render),
      'application/pdf',
      "user_report_#{record['id']}.pdf"
    )
  }
})
```

---

### Example 2: Export Selected Records to Excel

```ruby
collection.add_action('Export to Excel', {
  scope: 'Bulk',
  execute: lambda { |context, result_builder|
    # Fetch selected records
    records = context.get_records(['id', 'name', 'email', 'status'])

    # Generate Excel using axlsx gem
    package = Axlsx::Package.new
    workbook = package.workbook

    workbook.add_worksheet(name: 'Users') do |sheet|
      # Header row
      sheet.add_row ['ID', 'Name', 'Email', 'Status']

      # Data rows
      records.each do |record|
        sheet.add_row [
          record['id'],
          record['name'],
          record['email'],
          record['status']
        ]
      end
    end

    # Return Excel file
    result_builder.file(
      StringIO.new(package.to_stream.read),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      "users_export_#{Time.now.strftime('%Y%m%d_%H%M%S')}.xlsx"
    )
  }
})
```

---

### Example 3: Generate Invoice PDF from Disk Template

```ruby
collection.add_action('Generate Invoice', {
  scope: 'Single',
  execute: lambda { |context, result_builder|
    record = context.get_record(['id', 'customer_name', 'total', 'items'])

    # Generate invoice using WickedPdf or similar
    html = render_invoice_template(record)
    pdf_path = WickedPdf.new.pdf_from_string(
      html,
      page_size: 'A4',
      margin: { top: 20, bottom: 20, left: 20, right: 20 }
    )

    # Save to temp file
    temp_file = Tempfile.new(['invoice', '.pdf'])
    temp_file.binmode
    temp_file.write(pdf_path)
    temp_file.close

    # Return file from disk path
    context.file_from_path(
      temp_file.path,
      "invoice_#{record['id']}.pdf"
    )
  }
})
```

---

### Example 4: Create ZIP Archive of Files

```ruby
collection.add_action('Download Files', {
  scope: 'Single',
  execute: lambda { |context, result_builder|
    record = context.get_record(['id', 'attachments'])

    # Create ZIP archive
    zip_buffer = Zip::OutputStream.write_buffer do |zip|
      record['attachments'].each do |attachment|
        file_content = download_attachment(attachment['url'])
        zip.put_next_entry(attachment['filename'])
        zip.write(file_content)
      end
    end

    zip_buffer.rewind

    # Return ZIP file
    result_builder.file(
      zip_buffer,
      'application/zip',
      "attachments_#{record['id']}.zip"
    )
  }
})
```

---

### Example 5: Export Audit Log to CSV

```ruby
collection.add_action('Export Audit Log', {
  scope: 'Global',
  execute: lambda { |context, result_builder|
    # Fetch audit log entries
    logs = AuditLog.where('created_at > ?', 30.days.ago).order(created_at: :desc)

    # Generate CSV
    csv_content = CSV.generate do |csv|
      csv << ['Timestamp', 'User', 'Action', 'Resource', 'Details']

      logs.each do |log|
        csv << [
          log.created_at.iso8601,
          log.user_email,
          log.action,
          log.resource_type,
          log.details
        ]
      end
    end

    # Return CSV file
    result_builder.file(
      StringIO.new(csv_content),
      'text/csv',
      "audit_log_#{Time.now.strftime('%Y%m%d')}.csv"
    )
  }
})
```

---

## 🧪 Testing Strategy

### Test File 1: Unit Tests for FileResult

**Location:** `agent-ruby/packages/forest_admin_datasource_toolkit/spec/lib/interfaces/action_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe ForestAdminDatasourceToolkit::Interfaces::Action do
  describe 'FileResult' do
    describe '#initialize' do
      it 'creates file result with in-memory stream' do
        stream = StringIO.new('file content')
        result = described_class::FileResult.new(
          stream: stream,
          mime_type: 'application/pdf',
          name: 'test.pdf'
        )

        expect(result.type).to eq('File')
        expect(result.stream).to eq(stream)
        expect(result.mime_type).to eq('application/pdf')
        expect(result.name).to eq('test.pdf')
      end

      it 'creates file result with file path' do
        path = '/tmp/test.pdf'
        allow(File).to receive(:exist?).with(path).and_return(true)

        result = described_class::FileResult.new(
          stream: path,
          mime_type: 'application/pdf',
          name: 'test.pdf'
        )

        expect(result.stream).to eq(path)
        expect(result.file_path?).to be true
        expect(result.in_memory?).to be false
      end
    end

    describe '#file_path?' do
      it 'returns true for file path string' do
        path = '/tmp/test.pdf'
        allow(File).to receive(:exist?).with(path).and_return(true)

        result = described_class::FileResult.new(
          stream: path,
          mime_type: 'application/pdf',
          name: 'test.pdf'
        )

        expect(result.file_path?).to be true
      end

      it 'returns false for StringIO' do
        result = described_class::FileResult.new(
          stream: StringIO.new('content'),
          mime_type: 'application/pdf',
          name: 'test.pdf'
        )

        expect(result.file_path?).to be false
      end
    end

    describe '#in_memory?' do
      it 'returns true for StringIO' do
        result = described_class::FileResult.new(
          stream: StringIO.new('content'),
          mime_type: 'application/pdf',
          name: 'test.pdf'
        )

        expect(result.in_memory?).to be true
      end

      it 'returns true for IO' do
        file = Tempfile.new('test')
        result = described_class::FileResult.new(
          stream: file,
          mime_type: 'application/pdf',
          name: 'test.pdf'
        )

        expect(result.in_memory?).to be true
        file.close
        file.unlink
      end

      it 'returns false for file path' do
        path = '/tmp/test.pdf'
        allow(File).to receive(:exist?).with(path).and_return(true)

        result = described_class::FileResult.new(
          stream: path,
          mime_type: 'application/pdf',
          name: 'test.pdf'
        )

        expect(result.in_memory?).to be false
      end
    end
  end

  describe 'ResultBuilder' do
    let(:builder) { described_class::ResultBuilder.new }

    describe '#file' do
      it 'creates file result' do
        stream = StringIO.new('content')
        result = builder.file(stream, 'application/pdf', 'report.pdf')

        expect(result).to be_a(described_class::FileResult)
        expect(result.stream).to eq(stream)
        expect(result.mime_type).to eq('application/pdf')
        expect(result.name).to eq('report.pdf')
      end
    end
  end
end
```

---

### Test File 2: Integration Tests

**Location:** `agent-ruby/packages/forest_admin_agent/spec/integration/file_actions_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe 'File Actions', type: :request do
  let(:auth_token) { generate_jwt_token }
  let(:user) { create(:user, name: 'Test User') }

  before do
    allow(ForestAdminAgent::Services::Permissions).to receive(:new).and_return(
      instance_double('Permissions', can_smart_action?: true)
    )

    # Define test action
    ForestAdminAgent::Builder::AgentFactory.instance.customizer.customize_collection('users') do |collection|
      collection.add_action('Generate Report', {
        scope: 'Single',
        execute: lambda { |context, result_builder|
          record = context.get_record(['id', 'name'])
          content = "User Report\nID: #{record['id']}\nName: #{record['name']}"

          result_builder.file(
            StringIO.new(content),
            'text/plain',
            "user_#{record['id']}.txt"
          )
        }
      })
    end
  end

  describe 'POST /forest/_actions/:collection/:index/:slug' do
    context 'with file result' do
      it 'returns file download with correct headers' do
        post "/forest/_actions/users/0/generate-report",
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
        expect(response.headers['Content-Type']).to eq('text/plain')
        expect(response.headers['Content-Disposition']).to include('attachment')
        expect(response.headers['Content-Disposition']).to include("user_#{user.id}.txt")
        expect(response.body).to include('User Report')
        expect(response.body).to include(user.name)
      end
    end

    context 'with PDF file' do
      before do
        ForestAdminAgent::Builder::AgentFactory.instance.customizer.customize_collection('users') do |collection|
          collection.add_action('Generate PDF', {
            scope: 'Single',
            execute: lambda { |context, result_builder|
              # Simulate PDF generation
              pdf_content = "%PDF-1.4\nTest PDF Content"

              result_builder.file(
                StringIO.new(pdf_content),
                'application/pdf',
                "report_#{context.get_record(['id'])['id']}.pdf"
              )
            }
          })
        end
      end

      it 'returns PDF with correct MIME type' do
        post "/forest/_actions/users/0/generate-pdf",
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
        expect(response.headers['Content-Type']).to eq('application/pdf')
        expect(response.body).to start_with('%PDF-1.4')
      end
    end

    context 'with special characters in filename' do
      before do
        ForestAdminAgent::Builder::AgentFactory.instance.customizer.customize_collection('users') do |collection|
          collection.add_action('Generate File', {
            scope: 'Single',
            execute: lambda { |_context, result_builder|
              result_builder.file(
                StringIO.new('content'),
                'text/plain',
                'file with spaces & special chars.txt'
              )
            }
          })
        end
      end

      it 'properly encodes filename in Content-Disposition' do
        post "/forest/_actions/users/0/generate-file",
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
        disposition = response.headers['Content-Disposition']
        expect(disposition).to include('attachment')
        # Should include encoded version for non-ASCII compatibility
        expect(disposition).to match(/filename\*?=/)
      end
    end

    context 'with non-ASCII filename' do
      before do
        ForestAdminAgent::Builder::AgentFactory.instance.customizer.customize_collection('users') do |collection|
          collection.add_action('Generate File', {
            scope: 'Single',
            execute: lambda { |_context, result_builder|
              result_builder.file(
                StringIO.new('content'),
                'text/plain',
                'rapport_été_2024.txt'
              )
            }
          })
        end
      end

      it 'properly encodes non-ASCII filename' do
        post "/forest/_actions/users/0/generate-file",
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
        disposition = response.headers['Content-Disposition']
        # Should use RFC 5987 encoding for non-ASCII
        expect(disposition).to include("filename*=UTF-8''")
      end
    end

    context 'with file from disk' do
      before do
        @temp_file = Tempfile.new(['test', '.txt'])
        @temp_file.write('File content from disk')
        @temp_file.close

        ForestAdminAgent::Builder::AgentFactory.instance.customizer.customize_collection('users') do |collection|
          collection.add_action('Generate File', {
            scope: 'Single',
            execute: lambda { |context, result_builder|
              result_builder.file(
                @temp_file.path,
                'text/plain',
                'disk_file.txt'
              )
            }
          })
        end
      end

      after do
        @temp_file.unlink
      end

      it 'streams file from disk' do
        post "/forest/_actions/users/0/generate-file",
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
        expect(response.body).to eq('File content from disk')
      end
    end

    context 'with large file' do
      before do
        ForestAdminAgent::Builder::AgentFactory.instance.customizer.customize_collection('users') do |collection|
          collection.add_action('Generate Large File', {
            scope: 'Single',
            execute: lambda { |_context, result_builder|
              # Generate 10MB file
              large_content = 'x' * (10 * 1024 * 1024)

              result_builder.file(
                StringIO.new(large_content),
                'application/octet-stream',
                'large_file.bin'
              )
            }
          })
        end
      end

      it 'handles large files without memory issues' do
        memory_before = memory_usage_mb

        post "/forest/_actions/users/0/generate-large-file",
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

        memory_after = memory_usage_mb
        memory_increase = memory_after - memory_before

        expect(response.status).to eq(200)
        expect(response.body.bytesize).to eq(10 * 1024 * 1024)
        # Memory increase should be reasonable (< 30MB with overhead)
        expect(memory_increase).to be < 30
      end
    end

    context 'with bulk action' do
      let(:users) { create_list(:user, 3) }

      before do
        ForestAdminAgent::Builder::AgentFactory.instance.customizer.customize_collection('users') do |collection|
          collection.add_action('Export Users', {
            scope: 'Bulk',
            execute: lambda { |context, result_builder|
              records = context.get_records(['id', 'name', 'email'])

              csv_content = CSV.generate do |csv|
                csv << ['ID', 'Name', 'Email']
                records.each do |record|
                  csv << [record['id'], record['name'], record['email']]
                end
              end

              result_builder.file(
                StringIO.new(csv_content),
                'text/csv',
                "users_export_#{records.length}.csv"
              )
            }
          })
        end
      end

      it 'exports multiple records to CSV' do
        post "/forest/_actions/users/0/export-users",
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
        expect(response.headers['Content-Type']).to eq('text/csv')

        csv = CSV.parse(response.body, headers: true)
        expect(csv.length).to eq(3)
        expect(csv.headers).to eq(['ID', 'Name', 'Email'])
      end
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

## 📋 Implementation Checklist

### Phase 1: Core Implementation (Days 1-3)

- [ ] Define `FileResult` class in toolkit
- [ ] Add `ResultBuilder#file` method
- [ ] Add `ActionContext#file_from_buffer` helper
- [ ] Add `ActionContext#file_from_path` helper
- [ ] Add MIME type detection utility
- [ ] Update action execution handler to detect file results
- [ ] Add `handle_file_result` method in action route
- [ ] Implement `build_content_disposition` with RFC 5987 encoding
- [ ] Update Rails controller `forest_response` method
- [ ] Add `handle_file_response` for both in-memory and disk files
- [ ] Add cache control headers

### Phase 2: Testing (Days 4-7)

- [ ] Write unit tests for `FileResult`
  - [ ] Initialize with StringIO
  - [ ] Initialize with file path
  - [ ] `file_path?` method
  - [ ] `in_memory?` method
- [ ] Write unit tests for `ResultBuilder#file`
- [ ] Write unit tests for `ActionContext` helpers
- [ ] Write integration tests for file actions
  - [ ] Text file download
  - [ ] PDF file download
  - [ ] CSV file download
  - [ ] Special characters in filename
  - [ ] Non-ASCII filename
  - [ ] File from disk
  - [ ] Large file handling
  - [ ] Bulk action with file export
- [ ] Test all MIME types
- [ ] Test Content-Disposition encoding
- [ ] Test cache headers

### Phase 3: Documentation & Examples (Days 8-10)

- [ ] Document `FileResult` API
- [ ] Document `ResultBuilder#file` usage
- [ ] Create example: PDF generation
- [ ] Create example: Excel export
- [ ] Create example: ZIP archive
- [ ] Create example: CSV export
- [ ] Create example: Image generation
- [ ] Update action documentation
- [ ] Update CHANGELOG
- [ ] Create PR with examples

### Phase 4: Deployment (Days 11-12)

- [ ] Code review
- [ ] Deploy to staging
- [ ] Test with real PDF generation
- [ ] Test with large files (50MB+)
- [ ] Test with concurrent actions
- [ ] Monitor memory usage
- [ ] Deploy to production
- [ ] Update parity report

---

## 🎯 Use Cases Summary

| Use Case | File Type | Generation Method | Key Gems |
|----------|-----------|-------------------|----------|
| PDF Report | PDF | Prawn, WickedPdf | `prawn`, `wicked_pdf` |
| Excel Export | XLSX | Axlsx | `caxlsx` |
| CSV Export | CSV | Ruby CSV stdlib | Built-in |
| ZIP Archive | ZIP | Rubyzip | `rubyzip` |
| Invoice | PDF | Template + WickedPdf | `wicked_pdf`, `wkhtmltopdf-binary` |
| QR Code | PNG | RQRCode | `rqrcode`, `chunky_png` |
| Chart/Graph | PNG/SVG | Gruff, LazyHighCharts | `gruff`, `lazy_high_charts` |
| Word Document | DOCX | Sablon | `sablon` |

---

## 🚨 Edge Cases & Error Handling

### Edge Case 1: Empty File

**Scenario:** Action returns empty file content

**Behavior:**
```ruby
result_builder.file(
  StringIO.new(''),
  'text/plain',
  'empty.txt'
)

# Should succeed, download 0-byte file
# Content-Length: 0
```

---

### Edge Case 2: Very Large File (>100MB)

**Scenario:** Action generates very large file

**Best Practice:**
```ruby
# Use disk file instead of in-memory
temp_file = Tempfile.new(['large_export', '.csv'])
CSV.open(temp_file.path, 'w') do |csv|
  # Write millions of rows
  records.find_each(batch_size: 1000) do |record|
    csv << [record.id, record.name, ...]
  end
end

result_builder.file(
  temp_file.path,  # Pass path, not content
  'text/csv',
  'large_export.csv'
)
```

**Rails will use `send_file` which streams efficiently**

---

### Edge Case 3: File Generation Failure

**Scenario:** PDF generation throws error

**Handling:**
```ruby
execute: lambda { |context, result_builder|
  begin
    record = context.get_record(['id', 'data'])
    pdf_content = generate_pdf(record)

    result_builder.file(
      StringIO.new(pdf_content),
      'application/pdf',
      'report.pdf'
    )
  rescue StandardError => e
    # Return error result instead of file
    result_builder.error("Failed to generate PDF: #{e.message}")
  end
}
```

---

### Edge Case 4: Filename Security

**Scenario:** User input in filename could cause path traversal

**Prevention:**
```ruby
def safe_filename(user_input)
  # Remove path separators and null bytes
  basename = File.basename(user_input)
  # Remove any remaining dangerous characters
  basename.gsub(/[^0-9A-Za-z.\-_]/, '_')
end

filename = "report_#{safe_filename(record['company_name'])}.pdf"
```

---

### Edge Case 5: MIME Type Detection Failure

**Scenario:** Unknown file extension

**Fallback:**
```ruby
MIME_TYPES = {
  # ... known types
}.freeze

def detect_mime_type(path)
  ext = File.extname(path).downcase
  MIME_TYPES[ext] || 'application/octet-stream'  # Safe fallback
end
```

---

### Edge Case 6: Tempfile Cleanup

**Scenario:** Temp files accumulate over time

**Solution:**
```ruby
# Use Rails' Tempfile management
temp_file = Tempfile.new(['export', '.pdf'])
begin
  # Generate file
  generate_pdf(temp_file.path)

  # Return file result
  result_builder.file(temp_file.path, 'application/pdf', 'report.pdf')
ensure
  # Cleanup after response sent (Rails handles this with send_file)
  # But can also use finalizer:
  ObjectSpace.define_finalizer(temp_file, proc { temp_file.unlink })
end
```

---

## 📈 Performance Considerations

### Memory Usage

| File Size | In-Memory (StringIO) | Disk (send_file) |
|-----------|----------------------|------------------|
| < 1MB | ✅ Recommended | ⚠️ Overhead |
| 1-10MB | ⚠️ Acceptable | ✅ Better |
| 10-100MB | ❌ High memory | ✅ Recommended |
| > 100MB | ❌ Risk of OOM | ✅ Required |

**Recommendation:** Use in-memory (StringIO) for files <10MB, disk files for larger

---

### Streaming Optimization

**Rails Configuration:**
```ruby
# config/environments/production.rb
config.action_dispatch.x_sendfile_header = 'X-Accel-Redirect' # for nginx
# or
config.action_dispatch.x_sendfile_header = 'X-Sendfile' # for Apache
```

This allows web server to handle file streaming directly, freeing Rails process.

---

### Concurrent Actions

**Database Connection Pool:**
```ruby
# config/database.yml
production:
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 10 } %>
```

**Thread Safety:**
```ruby
# Ensure file generation is thread-safe
execute: lambda { |context, result_builder|
  # Use thread-local temp files
  temp_file = Tempfile.new(['export', '.pdf'], Dir.tmpdir)
  # ... generate file
  result_builder.file(temp_file.path, 'application/pdf', 'report.pdf')
}
```

---

## ✅ Acceptance Criteria

### Functional Requirements

- [ ] `FileResult` class defined with `stream`, `mime_type`, `name`
- [ ] `ResultBuilder#file` creates file results
- [ ] Action execution handler detects file results
- [ ] Rails controller sends file with correct headers
- [ ] Content-Type header matches MIME type
- [ ] Content-Disposition header includes filename
- [ ] Cache-Control headers prevent caching
- [ ] In-memory files (StringIO) download correctly
- [ ] Disk files (path string) download correctly
- [ ] Special characters in filename handled
- [ ] Non-ASCII filenames encoded per RFC 5987
- [ ] Large files (>50MB) stream without memory issues
- [ ] All common MIME types supported
- [ ] Helper methods for common scenarios

### Error Handling

- [ ] Invalid stream type raises error
- [ ] Missing file path raises error
- [ ] File generation errors return error result
- [ ] Temp files cleaned up after response

### Performance

- [ ] <100ms overhead for small files (<1MB)
- [ ] Constant memory for disk files regardless of size
- [ ] Memory usage <20MB for 10MB in-memory file
- [ ] Concurrent actions don't block each other

### Testing

- [ ] Unit test coverage >95%
- [ ] All file types tested (PDF, CSV, XLSX, ZIP)
- [ ] Special character handling tested
- [ ] Large file handling tested
- [ ] Integration tests with real file generation

### Documentation

- [ ] API documentation complete
- [ ] Usage examples for common scenarios
- [ ] MIME type reference
- [ ] Best practices documented
- [ ] CHANGELOG updated

---

## 🚀 Success Metrics

**Track after deployment:**

1. **File Action Usage:** Number of actions returning files
2. **File Types:** Distribution of MIME types used
3. **File Sizes:** Average and P95 file size
4. **Error Rate:** % of failed file actions
5. **Response Time:** Time to first byte for file downloads
6. **Memory Usage:** Peak memory during file generation
7. **User Satisfaction:** Feedback on file download feature

---

This implementation completes the action result type parity with Node.js and enables powerful file generation capabilities for Forest Admin users.