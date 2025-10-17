# TODO 001: Update Field Endpoint - Implementation Guide

## High Priority (P1) - Forest Admin Agent Ruby

**Project:** mini_qonto
**Target Package:** forest_admin_agent (via agent-ruby)
**Estimated Effort:** 1-2 weeks
**Priority:** P1 - Required for full CRUD parity

---

## 🎯 Executive Summary

Implement missing endpoint for updating individual elements within array-type fields, enabling granular modifications without replacing entire arrays.

**Current Gap:**

- Cannot update single element in array field via REST API
- Must fetch entire record, modify array locally, send full update
- Inefficient for large arrays
- No support for nested object updates within arrays

**Target Solution:**

- New endpoint: `PUT /forest/:collection_name/:id/relationships/:field_name/:index`
- Updates single array element at specific index
- Supports nested object field updates within array elements
- Validates array bounds and field types
- Atomic operation with proper permission checks

**Use Cases:**

- Update one tag in a tags array without fetching all tags
- Modify specific item in order line items array
- Update status of one task in tasks array
- Change property of nested object at array index

---

## 📊 Node.js Reference Implementation

### Route Definition

**File:** `agent-nodejs/packages/agent/src/routes/modification/update-field.ts`

```typescript
export default class UpdateField extends CollectionRoute {
  readonly type = RouteType.PrivateRoute;

  setupRoutes(router: Router): void {
    router.put(
      `${this.options.prefix}/:collectionName/:id/relationships/:fieldName/:index`,
      this.handleUpdateField.bind(this)
    );
  }

  async handleUpdateField(context: Context): Promise<void> {
    await this.services.authorization.assertCanEdit(
      context,
      this.collection.name
    );

    const { id, fieldName, index } = context.params;
    const recordId = IdUtils.unpackId(this.collection.schema, id);
    const arrayIndex = Number(index);

    // Validate field is an array
    const field = this.collection.schema.fields[fieldName];
    if (field?.type !== "Column" || !field.columnType?.startsWith("Array<")) {
      throw new ValidationError(`Field ${fieldName} is not an array`);
    }

    // Fetch current record
    const record = await this.collection.get(this.caller, recordId);
    if (!record) {
      throw new NotFoundError(`Record with id ${id} not found`);
    }

    // Validate array index
    const array = record[fieldName] as unknown[];
    if (!Array.isArray(array) || arrayIndex < 0 || arrayIndex >= array.length) {
      throw new ValidationError(
        `Invalid index ${arrayIndex} for array of length ${array?.length || 0}`
      );
    }

    // Parse new value from request body
    const newValue = this.parseValue(context.request.body, field.columnType);

    // Update array element
    array[arrayIndex] = newValue;

    // Update record
    await this.collection.update(this.caller, recordId, { [fieldName]: array });

    // Fetch updated record and return
    const updated = await this.collection.get(this.caller, recordId);
    context.response.body = this.services.serializer.serialize(
      this.collection,
      updated
    );
    context.response.status = 200;
  }

  private parseValue(body: any, columnType: string): unknown {
    // Extract value from JSON:API format
    const value = body?.data?.attributes?.value;

    // Parse based on array element type
    const elementType = this.extractElementType(columnType); // Array<String> → String

    switch (elementType) {
      case "String":
        return String(value);
      case "Number":
        return Number(value);
      case "Boolean":
        return Boolean(value);
      case "Json":
        return value; // Complex objects
      default:
        return value;
    }
  }
}
```

### Key Features:

1. **Route Pattern:** `PUT /:collection/:id/relationships/:field/:index`
2. **Validation:**
   - Field must exist and be array type
   - Record must exist
   - Index must be within array bounds
3. **Permission Check:** Requires `edit` permission on collection
4. **Atomic Update:** Read → Modify → Write with proper isolation
5. **Response:** Returns full updated record (JSON:API format)

---

## 🏗️ Ruby Implementation Architecture

### Overview

```
┌─────────────────────────────────────────────────┐
│  PUT /forest/:collection/:id/relationships/     │
│         :field_name/:index                      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  UpdateField Route Handler                      │
│  - Parse params (id, field_name, index)        │
│  - Check permissions (can edit?)               │
│  - Validate field is array type                │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Fetch Current Record                           │
│  - Unpack composite ID                          │
│  - Load record from collection                  │
│  - Return 404 if not found                      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Validate Array & Index                         │
│  - Check field value is array                   │
│  - Check index within bounds [0, length-1]      │
│  - Return 422 if invalid                        │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Parse New Value                                │
│  - Extract from JSON:API body                   │
│  - Coerce to correct type (String/Number/etc)   │
│  - Validate nested structure if object          │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Update Array Element                           │
│  - Clone array to avoid mutation side effects   │
│  - Replace element at index                     │
│  - Update record with modified array            │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Return Updated Record                          │
│  - Fetch fresh record after update              │
│  - Serialize to JSON:API format                 │
│  - Return 200 with updated data                 │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Details

### File 1: Create UpdateField Route

**Location:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/routes/resources/update_field.rb`

```ruby
# frozen_string_literal: true

module ForestAdminAgent
  module Routes
    module Resources
      class UpdateField < AbstractAuthenticatedRoute
        include ForestAdminAgent::Http::ErrorHandling

        def setup_routes(router)
          router.add_route(
            'forest_update_field',
            'put',
            '/forest/:collection_name/:id/relationships/:field_name/:index',
            ->(args) { handle_request(args) },
            'json'
          )
        end

        def handle_request(args = {})
          build(args)

          # Parse parameters
          record_id = Utils::Id.unpack_id(@collection.schema, args[:params][:id])
          field_name = args[:params][:field_name].to_sym
          array_index = parse_index(args[:params][:index])

          # Check permissions
          @permissions.can?(:edit, @collection)

          # Validate field is array type
          field_schema = @collection.schema[:fields][field_name]
          validate_array_field!(field_schema, field_name)

          # Fetch current record
          record = fetch_record(record_id)

          # Validate array and index
          array = record[field_name]
          validate_array_value!(array, field_name, array_index)

          # Parse new value from request body
          new_value = parse_value_from_body(args[:params], field_schema)

          # Update array element
          updated_array = array.dup
          updated_array[array_index] = new_value

          # Update record
          @collection.update(@caller, record_id, { field_name => updated_array })

          # Fetch and return updated record
          projection = Utils::QueryStringParser.parse_projection_with_pks(@collection, args)
          updated_record = @collection.get(@caller, record_id, projection)

          # Serialize response
          serialized = Serializer::ForestSerializer.serialize(@collection, updated_record)

          {
            content: serialized,
            status: 200
          }
        end

        private

        # Parse and validate array index
        def parse_index(index_param)
          index = Integer(index_param)
          raise Http::Exceptions::ValidationError, 'Index must be non-negative' if index.negative?

          index
        rescue ArgumentError
          raise Http::Exceptions::ValidationError, "Invalid index: #{index_param}"
        end

        # Validate field exists and is array type
        def validate_array_field!(field_schema, field_name)
          unless field_schema
            raise Http::Exceptions::NotFoundError, "Field '#{field_name}' does not exist"
          end

          unless field_schema[:type] == 'Column'
            raise Http::Exceptions::ValidationError, "Field '#{field_name}' is not a column field"
          end

          column_type = field_schema[:column_type]
          unless column_type.to_s.start_with?('Array')
            raise Http::Exceptions::ValidationError,
                  "Field '#{field_name}' is not an array (type: #{column_type})"
          end
        end

        # Fetch record by ID
        def fetch_record(record_id)
          projection = ForestAdminDatasourceToolkit::Components::Query::Projection.new(@collection.schema[:fields].keys)
          record = @collection.get(@caller, record_id, projection)

          unless record
            raise Http::Exceptions::NotFoundError, "Record not found"
          end

          record
        end

        # Validate array value and index bounds
        def validate_array_value!(array, field_name, array_index)
          unless array.is_a?(Array)
            raise Http::Exceptions::UnprocessableError,
                  "Field '#{field_name}' value is not an array (got: #{array.class})"
          end

          if array_index >= array.length
            raise Http::Exceptions::ValidationError,
                  "Index #{array_index} out of bounds for array of length #{array.length}"
          end
        end

        # Parse new value from request body
        def parse_value_from_body(params, field_schema)
          # Extract value from JSON:API format
          # Expected format: { data: { attributes: { value: <new_value> } } }
          body = params[:body] || {}
          value = body.dig('data', 'attributes', 'value')

          # Coerce to correct type based on array element type
          element_type = extract_element_type(field_schema[:column_type])
          coerce_value(value, element_type)
        end

        # Extract element type from array column type
        # E.g., "Array<String>" → "String"
        # E.g., "Array<Json>" → "Json"
        def extract_element_type(column_type)
          match = column_type.to_s.match(/Array<(.+)>/)
          match ? match[1] : 'String'
        end

        # Coerce value to expected type
        def coerce_value(value, element_type)
          return value if value.nil?

          case element_type
          when 'String'
            value.to_s
          when 'Number'
            value.is_a?(Numeric) ? value : Float(value)
          when 'Boolean'
            # Handle boolean coercion
            return true if value == true || value.to_s.downcase == 'true'
            return false if value == false || value.to_s.downcase == 'false'

            raise Http::Exceptions::ValidationError, "Invalid boolean value: #{value}"
          when 'Date', 'DateTime', 'Timeonly', 'Dateonly'
            # Parse date/time strings
            value.is_a?(String) ? Time.parse(value) : value
          when 'Json'
            # JSON objects/arrays - no coercion needed
            value
          else
            # Default: return as-is for complex types
            value
          end
        rescue ArgumentError, TypeError => e
          raise Http::Exceptions::ValidationError,
                "Cannot coerce value to type #{element_type}: #{e.message}"
        end
      end
    end
  end
end
```

**Key Implementation Points:**

1. **Route Registration:** Uses `router.add_route` with PUT method
2. **Parameter Parsing:** Extracts collection, ID, field name, index
3. **Permission Check:** Uses `@permissions.can?(:edit, @collection)`
4. **Field Validation:** Checks field exists and is array type via schema
5. **Record Fetching:** Unpacks composite ID and loads record
6. **Array Validation:** Checks value is array and index in bounds
7. **Value Parsing:** Extracts from JSON:API body format
8. **Type Coercion:** Converts value to correct type based on array element type
9. **Array Update:** Duplicates array, modifies element, updates record
10. **Response:** Returns full updated record in JSON:API format

---

### File 2: Register Route in Router

**Location:** `agent-ruby/packages/forest_admin_agent/lib/forest_admin_agent/http/router.rb`

**Add to route list:**

```ruby
module ForestAdminAgent
  module Http
    class Router
      def self.routes
        @routes ||= begin
          routes = {}

          # Existing routes...
          [
            Routes::System::HealthCheck,
            Routes::Security::Authentication,
            Routes::Security::ScopeInvalidation,
            Routes::Resources::List,
            Routes::Resources::Count,
            Routes::Resources::Show,
            Routes::Resources::Store,
            Routes::Resources::Update,
            Routes::Resources::UpdateField,  # ← NEW ROUTE
            Routes::Resources::Delete,
            Routes::Resources::Csv,
            # ... other routes
          ].each do |route_class|
            instance = route_class.new
            instance.setup_routes(self)
          end

          routes
        end
      end
    end
  end
end
```

---

### File 3: Add Tests

**Location:** `agent-ruby/packages/forest_admin_agent/spec/lib/forest_admin_agent/routes/resources/update_field_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe ForestAdminAgent::Routes::Resources::UpdateField do
  let(:route) { described_class.new }
  let(:collection) { instance_double('Collection') }
  let(:caller) { instance_double('Caller') }
  let(:permissions) { instance_double('Permissions') }

  let(:schema) do
    {
      fields: {
        id: { type: 'Column', column_type: 'Number', is_primary_key: true },
        tags: { type: 'Column', column_type: 'Array<String>' },
        scores: { type: 'Column', column_type: 'Array<Number>' },
        metadata: { type: 'Column', column_type: 'Array<Json>' },
        name: { type: 'Column', column_type: 'String' }
      }
    }
  end

  before do
    allow(route).to receive(:collection).and_return(collection)
    allow(route).to receive(:caller).and_return(caller)
    allow(route).to receive(:permissions).and_return(permissions)
    allow(collection).to receive(:schema).and_return(schema)
    allow(collection).to receive(:name).and_return('users')
    allow(permissions).to receive(:can?).with(:edit, collection).and_return(true)
  end

  describe '#handle_request' do
    let(:base_args) do
      {
        params: {
          collection_name: 'users',
          id: '123',
          field_name: 'tags',
          index: '0',
          body: {
            'data' => {
              'attributes' => {
                'value' => 'new-tag'
              }
            }
          }
        },
        headers: {}
      }
    end

    context 'with valid string array update' do
      let(:record) { { id: 123, tags: ['old-tag', 'keep-tag'], name: 'Test' } }
      let(:updated_record) { { id: 123, tags: ['new-tag', 'keep-tag'], name: 'Test' } }

      before do
        allow(ForestAdminAgent::Utils::Id).to receive(:unpack_id).and_return([123])
        allow(collection).to receive(:get).and_return(record, updated_record)
        allow(collection).to receive(:update)
      end

      it 'updates the array element at specified index' do
        result = route.handle_request(base_args)

        expect(collection).to have_received(:update).with(
          caller,
          [123],
          { tags: ['new-tag', 'keep-tag'] }
        )
        expect(result[:status]).to eq(200)
      end

      it 'returns the updated record' do
        result = route.handle_request(base_args)

        expect(result[:content]).to be_present
        expect(result[:status]).to eq(200)
      end
    end

    context 'with number array update' do
      let(:record) { { id: 123, scores: [10, 20, 30] } }
      let(:updated_record) { { id: 123, scores: [99, 20, 30] } }
      let(:args) do
        base_args.merge(
          params: base_args[:params].merge(
            field_name: 'scores',
            body: { 'data' => { 'attributes' => { 'value' => 99 } } }
          )
        )
      end

      before do
        allow(ForestAdminAgent::Utils::Id).to receive(:unpack_id).and_return([123])
        allow(collection).to receive(:get).and_return(record, updated_record)
        allow(collection).to receive(:update)
      end

      it 'updates numeric array element' do
        result = route.handle_request(args)

        expect(collection).to have_received(:update).with(
          caller,
          [123],
          { scores: [99, 20, 30] }
        )
        expect(result[:status]).to eq(200)
      end
    end

    context 'with JSON array update' do
      let(:record) { { id: 123, metadata: [{ key: 'old' }, { key: 'keep' }] } }
      let(:updated_record) { { id: 123, metadata: [{ key: 'new', value: 123 }, { key: 'keep' }] } }
      let(:args) do
        base_args.merge(
          params: base_args[:params].merge(
            field_name: 'metadata',
            body: { 'data' => { 'attributes' => { 'value' => { key: 'new', value: 123 } } } }
          )
        )
      end

      before do
        allow(ForestAdminAgent::Utils::Id).to receive(:unpack_id).and_return([123])
        allow(collection).to receive(:get).and_return(record, updated_record)
        allow(collection).to receive(:update)
      end

      it 'updates JSON object in array' do
        result = route.handle_request(args)

        expect(collection).to have_received(:update).with(
          caller,
          [123],
          { metadata: [{ key: 'new', value: 123 }, { key: 'keep' }] }
        )
        expect(result[:status]).to eq(200)
      end
    end

    context 'with last element update' do
      let(:record) { { id: 123, tags: ['first', 'second', 'last'] } }
      let(:updated_record) { { id: 123, tags: ['first', 'second', 'updated'] } }
      let(:args) do
        base_args.merge(
          params: base_args[:params].merge(
            index: '2',
            body: { 'data' => { 'attributes' => { 'value' => 'updated' } } }
          )
        )
      end

      before do
        allow(ForestAdminAgent::Utils::Id).to receive(:unpack_id).and_return([123])
        allow(collection).to receive(:get).and_return(record, updated_record)
        allow(collection).to receive(:update)
      end

      it 'updates last element' do
        result = route.handle_request(args)

        expect(collection).to have_received(:update).with(
          caller,
          [123],
          { tags: ['first', 'second', 'updated'] }
        )
        expect(result[:status]).to eq(200)
      end
    end

    context 'with permission denied' do
      before do
        allow(permissions).to receive(:can?).with(:edit, collection)
          .and_raise(ForestAdminAgent::Http::Exceptions::ForbiddenError)
      end

      it 'raises ForbiddenError' do
        expect { route.handle_request(base_args) }
          .to raise_error(ForestAdminAgent::Http::Exceptions::ForbiddenError)
      end
    end

    context 'with non-existent field' do
      let(:args) do
        base_args.merge(params: base_args[:params].merge(field_name: 'nonexistent'))
      end

      it 'raises NotFoundError' do
        expect { route.handle_request(args) }
          .to raise_error(ForestAdminAgent::Http::Exceptions::NotFoundError, /does not exist/)
      end
    end

    context 'with non-array field' do
      let(:args) do
        base_args.merge(params: base_args[:params].merge(field_name: 'name'))
      end

      it 'raises ValidationError' do
        expect { route.handle_request(args) }
          .to raise_error(ForestAdminAgent::Http::Exceptions::ValidationError, /not an array/)
      end
    end

    context 'with non-existent record' do
      before do
        allow(ForestAdminAgent::Utils::Id).to receive(:unpack_id).and_return([999])
        allow(collection).to receive(:get).and_return(nil)
      end

      it 'raises NotFoundError' do
        expect { route.handle_request(base_args) }
          .to raise_error(ForestAdminAgent::Http::Exceptions::NotFoundError, /not found/)
      end
    end

    context 'with index out of bounds' do
      let(:record) { { id: 123, tags: ['one', 'two'] } }
      let(:args) do
        base_args.merge(params: base_args[:params].merge(index: '5'))
      end

      before do
        allow(ForestAdminAgent::Utils::Id).to receive(:unpack_id).and_return([123])
        allow(collection).to receive(:get).and_return(record)
      end

      it 'raises ValidationError' do
        expect { route.handle_request(args) }
          .to raise_error(ForestAdminAgent::Http::Exceptions::ValidationError, /out of bounds/)
      end
    end

    context 'with negative index' do
      let(:args) do
        base_args.merge(params: base_args[:params].merge(index: '-1'))
      end

      it 'raises ValidationError' do
        expect { route.handle_request(args) }
          .to raise_error(ForestAdminAgent::Http::Exceptions::ValidationError, /non-negative/)
      end
    end

    context 'with invalid index format' do
      let(:args) do
        base_args.merge(params: base_args[:params].merge(index: 'abc'))
      end

      it 'raises ValidationError' do
        expect { route.handle_request(args) }
          .to raise_error(ForestAdminAgent::Http::Exceptions::ValidationError, /Invalid index/)
      end
    end

    context 'with field value not an array' do
      let(:record) { { id: 123, tags: nil } }

      before do
        allow(ForestAdminAgent::Utils::Id).to receive(:unpack_id).and_return([123])
        allow(collection).to receive(:get).and_return(record)
      end

      it 'raises UnprocessableError' do
        expect { route.handle_request(base_args) }
          .to raise_error(ForestAdminAgent::Http::Exceptions::UnprocessableError, /not an array/)
      end
    end

    context 'with type coercion' do
      context 'string to number' do
        let(:record) { { id: 123, scores: [10, 20] } }
        let(:updated_record) { { id: 123, scores: [99, 20] } }
        let(:args) do
          base_args.merge(
            params: base_args[:params].merge(
              field_name: 'scores',
              body: { 'data' => { 'attributes' => { 'value' => '99' } } }
            )
          )
        end

        before do
          allow(ForestAdminAgent::Utils::Id).to receive(:unpack_id).and_return([123])
          allow(collection).to receive(:get).and_return(record, updated_record)
          allow(collection).to receive(:update)
        end

        it 'coerces string to number' do
          result = route.handle_request(args)

          expect(collection).to have_received(:update).with(
            caller,
            [123],
            { scores: [99.0, 20] }
          )
          expect(result[:status]).to eq(200)
        end
      end

      context 'invalid number coercion' do
        let(:record) { { id: 123, scores: [10, 20] } }
        let(:args) do
          base_args.merge(
            params: base_args[:params].merge(
              field_name: 'scores',
              body: { 'data' => { 'attributes' => { 'value' => 'not-a-number' } } }
            )
          )
        end

        before do
          allow(ForestAdminAgent::Utils::Id).to receive(:unpack_id).and_return([123])
          allow(collection).to receive(:get).and_return(record)
        end

        it 'raises ValidationError' do
          expect { route.handle_request(args) }
            .to raise_error(ForestAdminAgent::Http::Exceptions::ValidationError, /Cannot coerce/)
        end
      end
    end

    context 'with composite primary key' do
      let(:record) { { tenant_id: 1, user_id: 123, tags: ['old', 'tag'] } }
      let(:updated_record) { { tenant_id: 1, user_id: 123, tags: ['new', 'tag'] } }

      before do
        allow(ForestAdminAgent::Utils::Id).to receive(:unpack_id).and_return([1, 123])
        allow(collection).to receive(:get).and_return(record, updated_record)
        allow(collection).to receive(:update)
      end

      it 'handles composite key correctly' do
        result = route.handle_request(base_args)

        expect(collection).to have_received(:update).with(
          caller,
          [1, 123],
          { tags: ['new', 'tag'] }
        )
        expect(result[:status]).to eq(200)
      end
    end
  end
end
```

---

### File 4: Integration Tests

**Location:** `agent-ruby/packages/forest_admin_agent/spec/integration/update_field_spec.rb`

```ruby
require 'spec_helper'

RSpec.describe 'Update Field Endpoint', type: :request do
  let(:auth_token) { generate_jwt_token }
  let(:user) { create(:user, tags: ['ruby', 'rails', 'forest']) }

  before do
    allow(ForestAdminAgent::Services::Permissions).to receive(:new).and_return(
      instance_double('Permissions', can?: true, get_scope: nil)
    )
  end

  describe 'PUT /forest/:collection/:id/relationships/:field/:index' do
    context 'with valid request' do
      it 'updates array element at index' do
        put "/forest/users/#{user.id}/relationships/tags/1",
            params: { data: { attributes: { value: 'sinatra' } } }.to_json,
            headers: {
              'Authorization' => "Bearer #{auth_token}",
              'Content-Type' => 'application/json'
            }

        expect(response.status).to eq(200)

        user.reload
        expect(user.tags).to eq(['ruby', 'sinatra', 'forest'])
      end

      it 'returns updated record in JSON:API format' do
        put "/forest/users/#{user.id}/relationships/tags/0",
            params: { data: { attributes: { value: 'python' } } }.to_json,
            headers: {
              'Authorization' => "Bearer #{auth_token}",
              'Content-Type' => 'application/json'
            }

        expect(response.status).to eq(200)

        json = JSON.parse(response.body)
        expect(json['data']['type']).to eq('users')
        expect(json['data']['attributes']['tags']).to include('python')
      end
    end

    context 'with last element' do
      it 'updates last element in array' do
        last_index = user.tags.length - 1

        put "/forest/users/#{user.id}/relationships/tags/#{last_index}",
            params: { data: { attributes: { value: 'admin' } } }.to_json,
            headers: {
              'Authorization' => "Bearer #{auth_token}",
              'Content-Type' => 'application/json'
            }

        expect(response.status).to eq(200)

        user.reload
        expect(user.tags.last).to eq('admin')
      end
    end

    context 'with number array' do
      let(:product) { create(:product, ratings: [4.5, 3.8, 5.0]) }

      it 'updates numeric array element' do
        put "/forest/products/#{product.id}/relationships/ratings/1",
            params: { data: { attributes: { value: 4.2 } } }.to_json,
            headers: {
              'Authorization' => "Bearer #{auth_token}",
              'Content-Type' => 'application/json'
            }

        expect(response.status).to eq(200)

        product.reload
        expect(product.ratings).to eq([4.5, 4.2, 5.0])
      end
    end

    context 'with JSON array' do
      let(:order) { create(:order, line_items: [
        { sku: 'ABC', quantity: 2, price: 10.0 },
        { sku: 'DEF', quantity: 1, price: 20.0 }
      ]) }

      it 'updates JSON object in array' do
        new_item = { sku: 'ABC', quantity: 5, price: 10.0 }

        put "/forest/orders/#{order.id}/relationships/line_items/0",
            params: { data: { attributes: { value: new_item } } }.to_json,
            headers: {
              'Authorization' => "Bearer #{auth_token}",
              'Content-Type' => 'application/json'
            }

        expect(response.status).to eq(200)

        order.reload
        expect(order.line_items[0]['quantity']).to eq(5)
      end
    end

    context 'with non-existent record' do
      it 'returns 404' do
        put "/forest/users/99999/relationships/tags/0",
            params: { data: { attributes: { value: 'test' } } }.to_json,
            headers: {
              'Authorization' => "Bearer #{auth_token}",
              'Content-Type' => 'application/json'
            }

        expect(response.status).to eq(404)

        json = JSON.parse(response.body)
        expect(json['errors'][0]['detail']).to include('not found')
      end
    end

    context 'with non-existent field' do
      it 'returns 404' do
        put "/forest/users/#{user.id}/relationships/nonexistent/0",
            params: { data: { attributes: { value: 'test' } } }.to_json,
            headers: {
              'Authorization' => "Bearer #{auth_token}",
              'Content-Type' => 'application/json'
            }

        expect(response.status).to eq(404)

        json = JSON.parse(response.body)
        expect(json['errors'][0]['detail']).to include('does not exist')
      end
    end

    context 'with non-array field' do
      it 'returns 422' do
        put "/forest/users/#{user.id}/relationships/name/0",
            params: { data: { attributes: { value: 'test' } } }.to_json,
            headers: {
              'Authorization' => "Bearer #{auth_token}",
              'Content-Type' => 'application/json'
            }

        expect(response.status).to eq(422)

        json = JSON.parse(response.body)
        expect(json['errors'][0]['detail']).to include('not an array')
      end
    end

    context 'with index out of bounds' do
      it 'returns 422' do
        put "/forest/users/#{user.id}/relationships/tags/999",
            params: { data: { attributes: { value: 'test' } } }.to_json,
            headers: {
              'Authorization' => "Bearer #{auth_token}",
              'Content-Type' => 'application/json'
            }

        expect(response.status).to eq(422)

        json = JSON.parse(response.body)
        expect(json['errors'][0]['detail']).to include('out of bounds')
      end
    end

    context 'with negative index' do
      it 'returns 422' do
        put "/forest/users/#{user.id}/relationships/tags/-1",
            params: { data: { attributes: { value: 'test' } } }.to_json,
            headers: {
              'Authorization' => "Bearer #{auth_token}",
              'Content-Type' => 'application/json'
            }

        expect(response.status).to eq(422)

        json = JSON.parse(response.body)
        expect(json['errors'][0]['detail']).to include('non-negative')
      end
    end

    context 'with permission denied' do
      before do
        allow_any_instance_of(ForestAdminAgent::Services::Permissions).to receive(:can?)
          .with(:edit, anything)
          .and_raise(ForestAdminAgent::Http::Exceptions::ForbiddenError)
      end

      it 'returns 403' do
        put "/forest/users/#{user.id}/relationships/tags/0",
            params: { data: { attributes: { value: 'test' } } }.to_json,
            headers: {
              'Authorization' => "Bearer #{auth_token}",
              'Content-Type' => 'application/json'
            }

        expect(response.status).to eq(403)
      end
    end

    context 'with concurrent updates' do
      it 'handles race conditions correctly' do
        threads = []
        results = []

        5.times do |i|
          threads << Thread.new do
            put "/forest/users/#{user.id}/relationships/tags/0",
                params: { data: { attributes: { value: "tag-#{i}" } } }.to_json,
                headers: {
                  'Authorization' => "Bearer #{auth_token}",
                  'Content-Type' => 'application/json'
                }
            results << response.status
          end
        end

        threads.each(&:join)

        # All should succeed
        expect(results).to all(eq(200))

        # Final value should be one of the updates
        user.reload
        expect(user.tags[0]).to match(/tag-\d/)
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

### Phase 1: Core Implementation (Days 1-3)

- [ ] Create `UpdateField` route class with request handler
- [ ] Implement parameter parsing (id, field_name, index)
- [ ] Add permission check (`can?(:edit)`)
- [ ] Implement field validation (exists, is array type)
- [ ] Implement record fetching with ID unpacking
- [ ] Add array and index validation
- [ ] Implement value parsing from JSON:API body
- [ ] Add type coercion logic (String, Number, Boolean, Json)
- [ ] Implement array element update
- [ ] Return updated record in JSON:API format
- [ ] Register route in router
- [ ] Add error handling for all edge cases

### Phase 2: Testing (Days 4-6)

- [ ] Write unit tests for `UpdateField` route
  - [ ] Valid string array update
  - [ ] Valid number array update
  - [ ] Valid JSON array update
  - [ ] Update last element
  - [ ] Permission denied
  - [ ] Non-existent field
  - [ ] Non-array field
  - [ ] Non-existent record
  - [ ] Index out of bounds
  - [ ] Negative index
  - [ ] Invalid index format
  - [ ] Field value not an array
  - [ ] Type coercion (string to number)
  - [ ] Invalid type coercion
  - [ ] Composite primary key
- [ ] Write integration tests
  - [ ] Valid request end-to-end
  - [ ] JSON:API response format
  - [ ] Last element update
  - [ ] Number array update
  - [ ] JSON object array update
  - [ ] 404 non-existent record
  - [ ] 404 non-existent field
  - [ ] 422 non-array field
  - [ ] 422 index out of bounds
  - [ ] 422 negative index
  - [ ] 403 permission denied
  - [ ] Concurrent updates (race conditions)

### Phase 3: Edge Cases & Polish (Days 7-8)

- [ ] Handle empty arrays gracefully
- [ ] Handle null array values
- [ ] Handle very large arrays (performance)
- [ ] Add support for nested array updates (Array<Array<T>>)
- [ ] Optimize array cloning for large arrays
- [ ] Add request logging
- [ ] Add performance monitoring
- [ ] Test with all array element types:
  - [ ] String
  - [ ] Number
  - [ ] Boolean
  - [ ] Date/DateTime
  - [ ] Json (nested objects)
  - [ ] Enum values
- [ ] Test with composite primary keys
- [ ] Test with scoped records (permissions)

### Phase 4: Documentation & Deployment (Days 9-10)

- [ ] Update code documentation
- [ ] Update API documentation
- [ ] Add usage examples
- [ ] Update CHANGELOG
- [ ] Create PR with detailed description
- [ ] Request code review
- [ ] Address review feedback
- [ ] Merge to main branch
- [ ] Deploy to staging
- [ ] Test in staging environment
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] Update parity report

---

## 🧪 Testing Strategy

### Unit Tests Coverage

**Target: >95% code coverage**

1. **Happy Path Tests:**

   - String array update
   - Number array update
   - Boolean array update
   - JSON object array update
   - Date array update
   - First element
   - Middle element
   - Last element

2. **Error Path Tests:**

   - Permission denied (403)
   - Non-existent field (404)
   - Non-existent record (404)
   - Non-array field (422)
   - Index out of bounds (422)
   - Negative index (422)
   - Invalid index format (422)
   - Field value not array (422)
   - Invalid type coercion (422)

3. **Edge Case Tests:**
   - Empty array handling
   - Single-element array
   - Very large arrays (1000+ elements)
   - Null values in array
   - Nested objects in JSON arrays
   - Composite primary keys
   - Type coercion edge cases

### Integration Tests Coverage

**Full end-to-end request flow:**

1. **Successful Updates:**

   - Complete request/response cycle
   - Database persistence verification
   - JSON:API format validation
   - Multiple data types

2. **Error Scenarios:**

   - HTTP status codes correct
   - Error messages clear
   - Error response format JSON:API compliant

3. **Concurrency:**
   - Multiple simultaneous updates
   - Race condition handling
   - Transaction isolation

### Performance Tests

```ruby
# spec/performance/update_field_performance_spec.rb
RSpec.describe 'UpdateField Performance' do
  it 'updates element in large array efficiently' do
    user = create(:user, tags: Array.new(1000) { |i| "tag-#{i}" })

    time = Benchmark.measure do
      put "/forest/users/#{user.id}/relationships/tags/500",
          params: { data: { attributes: { value: 'updated' } } }.to_json,
          headers: auth_headers
    end

    expect(time.real).to be < 1.0  # Less than 1 second
    expect(response.status).to eq(200)
  end

  it 'handles concurrent updates without deadlocks' do
    user = create(:user, tags: ['a', 'b', 'c'])

    threads = 10.times.map do |i|
      Thread.new do
        put "/forest/users/#{user.id}/relationships/tags/#{i % 3}",
            params: { data: { attributes: { value: "thread-#{i}" } } }.to_json,
            headers: auth_headers
      end
    end

    expect { threads.each(&:join) }.not_to raise_error
  end
end
```

---

## 🎯 Use Cases & Examples

### Use Case 1: Update Tag in Tags Array

**Scenario:** User wants to fix a typo in one tag without re-uploading all tags

**Current Approach (Without Endpoint):**

```javascript
// Frontend must do:
1. GET /forest/posts/123 - Fetch entire record
2. Parse response, modify tags array locally
3. PUT /forest/posts/123 - Send entire record back
```

**With Update Field Endpoint:**

```javascript
// Frontend can:
PUT / forest / posts / 123 / relationships / tags / 2;
Body: {
  data: {
    attributes: {
      value: "corrected-tag";
    }
  }
}
```

**Benefits:**

- Single request instead of two
- No need to fetch entire record
- Atomic operation
- Less bandwidth usage

---

### Use Case 2: Update Order Line Item Quantity

**Scenario:** Admin needs to adjust quantity of one item in an order

**Data Structure:**

```json
{
  "id": 456,
  "line_items": [
    { "sku": "ABC-123", "quantity": 2, "price": 19.99 },
    { "sku": "DEF-456", "quantity": 1, "price": 29.99 },
    { "sku": "GHI-789", "quantity": 3, "price": 9.99 }
  ]
}
```

**Request:**

```http
PUT /forest/orders/456/relationships/line_items/0
Content-Type: application/json

{
  "data": {
    "attributes": {
      "value": {
        "sku": "ABC-123",
        "quantity": 5,
        "price": 19.99
      }
    }
  }
}
```

**Result:**

```json
{
  "line_items": [
    { "sku": "ABC-123", "quantity": 5, "price": 19.99 },
    { "sku": "DEF-456", "quantity": 1, "price": 29.99 },
    { "sku": "GHI-789", "quantity": 3, "price": 9.99 }
  ]
}
```

---

### Use Case 3: Update Task Status in Task List

**Scenario:** Project management app with tasks array, need to update one task's status

**Data Structure:**

```json
{
  "id": 789,
  "tasks": [
    { "name": "Design mockup", "status": "completed", "assignee": "Alice" },
    { "name": "Implement feature", "status": "in_progress", "assignee": "Bob" },
    { "name": "Write tests", "status": "pending", "assignee": "Charlie" }
  ]
}
```

**Request:**

```http
PUT /forest/projects/789/relationships/tasks/1
Content-Type: application/json

{
  "data": {
    "attributes": {
      "value": {
        "name": "Implement feature",
        "status": "completed",
        "assignee": "Bob"
      }
    }
  }
}
```

---

### Use Case 4: Update Rating in Ratings Array

**Scenario:** Product has multiple user ratings, need to correct one rating

**Request:**

```http
PUT /forest/products/321/relationships/ratings/3
Content-Type: application/json

{
  "data": {
    "attributes": {
      "value": 4.5
    }
  }
}
```

**Type Coercion:**

- If value sent as string "4.5", automatically coerced to float
- If value sent as integer 4, coerced to float 4.0
- Validates it's a valid number

---

## 🚨 Edge Cases & Error Handling

### Edge Case 1: Empty Array

**Scenario:** Field value is empty array `[]`

**Behavior:**

```ruby
# Any index will be out of bounds
PUT /forest/users/123/relationships/tags/0

# Response: 422 Unprocessable Entity
{
  "errors": [{
    "detail": "Index 0 out of bounds for array of length 0"
  }]
}
```

---

### Edge Case 2: Null Array Value

**Scenario:** Field value is `null` instead of array

**Behavior:**

```ruby
PUT /forest/users/123/relationships/tags/0

# Response: 422 Unprocessable Entity
{
  "errors": [{
    "detail": "Field 'tags' value is not an array (got: NilClass)"
  }]
}
```

---

### Edge Case 3: Very Large Array (Performance)

**Scenario:** Array has 10,000+ elements

**Optimization:**

```ruby
# Use array indexing directly, don't iterate
array = record[field_name]
updated_array = array.dup  # Shallow copy is O(n)
updated_array[index] = new_value  # O(1)

# For very large arrays, consider:
# 1. Database-native array update (PostgreSQL array_replace)
# 2. Lazy copy-on-write
```

**PostgreSQL Optimization (Optional):**

```ruby
# Instead of fetch → modify → update
# Use native array update:
collection.execute_raw_query(
  "UPDATE #{table} SET #{field} = array_replace(#{field}, $1, $2) WHERE id = $3",
  [old_value, new_value, record_id]
)
```

---

### Edge Case 4: Nested Arrays (Array<Array<T>>)

**Scenario:** Field is array of arrays

**Schema:**

```ruby
{
  matrix: { type: 'Column', column_type: 'Array<Array<Number>>' }
}
```

**Current Implementation:**

- Only updates first-level array element
- To update nested element: update entire sub-array

**Example:**

```ruby
# matrix = [[1,2,3], [4,5,6], [7,8,9]]
# To update matrix[1][2] (value 6):

PUT /forest/data/123/relationships/matrix/1
Body: { value: [4, 5, 99] }  # Update entire sub-array

# Result: [[1,2,3], [4,5,99], [7,8,9]]
```

**Future Enhancement:**
Consider supporting: `PUT /forest/data/123/relationships/matrix/1/2`

---

### Edge Case 5: Type Coercion Edge Cases

**String to Number:**

```ruby
"123" → 123.0        # Valid
"12.5" → 12.5        # Valid
"" → Error           # Invalid
"abc" → Error        # Invalid
"123abc" → Error     # Invalid
```

**Boolean Coercion:**

```ruby
true → true          # Valid
"true" → true        # Valid
1 → true             # Valid (truthy)
false → false        # Valid
"false" → false      # Valid
0 → false            # Valid (falsy)
"yes" → Error        # Invalid
```

---

### Edge Case 6: Race Conditions

**Scenario:** Two users update same array element simultaneously

**Behavior:**

```ruby
# Initial: tags = ['a', 'b', 'c']

# Request 1 (User A): Update index 1 to 'x'
# Request 2 (User B): Update index 1 to 'y'

# Result: Last write wins (database isolation level)
# Final: ['a', 'y', 'c']  (or ['a', 'x', 'c'] depending on timing)
```

**Mitigation:**

- Use database transactions (Rails default)
- Consider optimistic locking for critical updates
- Add version field for conflict detection

**Optimistic Locking (Optional):**

```ruby
# Add version field to schema
collection.update(caller, record_id, {
  field_name => updated_array,
  version => record[:version] + 1
}, where: { version: record[:version] })

# Raises if version mismatch (concurrent update detected)
```

---

## 📈 Performance Considerations

### Benchmark Targets

| Operation                             | Target Time | Max Memory |
| ------------------------------------- | ----------- | ---------- |
| Update element in 10-element array    | <50ms       | <5MB       |
| Update element in 100-element array   | <100ms      | <10MB      |
| Update element in 1000-element array  | <200ms      | <20MB      |
| Update element in 10000-element array | <500ms      | <50MB      |

### Optimization Strategies

1. **Shallow Copy for Large Arrays:**

```ruby
# Good: Shallow copy (O(n) but fast)
updated_array = array.dup
updated_array[index] = new_value

# Avoid: Deep copy (O(n*m) for nested structures)
updated_array = Marshal.load(Marshal.dump(array))
```

2. **Database-Level Updates (PostgreSQL):**

```ruby
# For PostgreSQL arrays, consider native operations:
# Instead of: fetch → modify in Ruby → save
# Use: UPDATE table SET arr[idx] = value WHERE id = ?

if database_type == :postgresql && !complex_type
  execute_sql("UPDATE #{table} SET #{field}[#{index+1}] = ? WHERE id = ?",
              [new_value, record_id])
end
```

3. **Lazy Loading:**

```ruby
# Only fetch necessary fields
projection = Projection.new([field_name] + primary_keys)
record = collection.get(caller, record_id, projection)
```

4. **Connection Pooling:**

```ruby
# Ensure adequate connection pool for concurrent updates
# config/database.yml
pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 10 } %>
```

---

## 🚀 Deployment Plan

### Phase 1: Development (Week 1)

- [ ] Day 1-2: Implement core route handler
- [ ] Day 3-4: Write comprehensive tests
- [ ] Day 5: Code review and refinement

### Phase 2: Staging (Week 2)

- [ ] Day 1: Deploy to staging environment
- [ ] Day 2: Integration testing with frontend
- [ ] Day 3: Performance testing with production-like data
- [ ] Day 4: Security review
- [ ] Day 5: Bug fixes and polish

### Phase 3: Production (Week 3)

- [ ] Day 1: Deploy to production (off-peak hours)
- [ ] Day 2-7: Monitor for errors, performance issues
- [ ] Update documentation and announce feature

---

## ✅ Acceptance Criteria

### Functional Requirements

- [ ] Endpoint `PUT /forest/:collection/:id/relationships/:field/:index` responds
- [ ] Permission check enforced (edit permission required)
- [ ] Field validation (must exist, must be array type)
- [ ] Record validation (must exist)
- [ ] Array validation (value must be array)
- [ ] Index validation (must be in bounds: 0 to length-1)
- [ ] Value parsing from JSON:API body format
- [ ] Type coercion based on array element type
- [ ] Array element update succeeds
- [ ] Returns updated record in JSON:API format
- [ ] All array element types supported:
  - [ ] String
  - [ ] Number
  - [ ] Boolean
  - [ ] Date/DateTime
  - [ ] Json (nested objects/arrays)
- [ ] Composite primary keys handled correctly
- [ ] Error responses follow JSON:API error format

### Error Handling

- [ ] 403 if permission denied
- [ ] 404 if field doesn't exist
- [ ] 404 if record doesn't exist
- [ ] 422 if field not array type
- [ ] 422 if index out of bounds
- [ ] 422 if index negative
- [ ] 422 if index invalid format
- [ ] 422 if field value not array
- [ ] 422 if type coercion fails
- [ ] Error messages clear and helpful

### Performance

- [ ] <200ms response time for typical arrays (<100 elements)
- [ ] <500ms response time for large arrays (<1000 elements)
- [ ] No memory leaks
- [ ] Handles concurrent updates safely
- [ ] Database connection pool not exhausted

### Testing

- [ ] Unit test coverage >95%
- [ ] All integration tests pass
- [ ] Performance benchmarks meet targets
- [ ] Edge cases handled correctly
- [ ] Concurrent update tests pass

### Documentation

- [ ] Code documented with inline comments
- [ ] API documentation updated
- [ ] Usage examples provided
- [ ] CHANGELOG updated
- [ ] Migration guide for frontend teams

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue 1: "Field not found" despite field existing**

- Check field name matches schema exactly (case-sensitive)
- Verify collection name is correct
- Check field type in schema (must be Column)

**Issue 2: "Index out of bounds" for valid index**

- Array might be empty (length 0)
- Check actual array value in database
- Verify index is 0-based, not 1-based

**Issue 3: "Type coercion failed"**

- Check array element type in schema
- Ensure value format matches expected type
- Review type coercion logic for edge cases

**Issue 4: Concurrent updates causing data loss**

- Implement optimistic locking
- Add version field to records
- Use database transactions properly

---

## 🎯 Success Metrics

**Track after deployment:**

1. **Endpoint Usage:** Number of requests to UpdateField endpoint
2. **Success Rate:** % of successful updates (target >99%)
3. **Error Rate:** % of 4xx/5xx responses (target <1%)
4. **Response Time:** P50, P95, P99 (targets: <100ms, <300ms, <500ms)
5. **Array Sizes:** Distribution of array lengths being updated
6. **Frontend Impact:** Reduced API calls due to direct updates

---

This endpoint is critical for achieving full CRUD parity with the Node.js agent and improving user experience when working with array-type fields.
