# frozen_string_literal: true

module ForestAdminRails
  module Actions
    module_function

    BANK_ACCOUNT_COLLECTION = 'Api__BankAccount'
    IBAN_FORM_FIELD_ID = 'newIban'
    IBAN_MAX_LENGTH = 27

    def format_iban(raw_iban)
      sanitized = raw_iban.to_s.gsub(/\s+/, '')
      trimmed = sanitized[0, IBAN_MAX_LENGTH] || ''

      return '' if trimmed.empty?

      trimmed.scan(/.{1,4}/).join(' ')
    end

    ACTION_FORM = [
      {
        type: 'String',
        id: IBAN_FORM_FIELD_ID,
        label: 'New IBAN',
        is_required: true,
        description: 'Provide the IBAN that should replace the current value.',
        default_value: lambda do |context|
          record = context.get_record(%w[iban])
          raw_iban = record&.dig('iban') || record&.dig(:iban)

          format_iban(raw_iban) if raw_iban
        end,
        value: lambda do |context|
          next unless context.has_field_changed(IBAN_FORM_FIELD_ID)

          format_iban(context.get_form_value(IBAN_FORM_FIELD_ID))
        end
      },
    ].freeze

    def register(agent)
      action = ForestAdminDatasourceCustomizer::Decorators::Action::BaseAction.new(
        scope: ForestAdminDatasourceCustomizer::Decorators::Action::Types::ActionScope::SINGLE,
        description: 'Update the IBAN stored on the selected bank account',
        form: ACTION_FORM,
        submit_button_label: 'Update IBAN'
      ) do |context, result_builder|
        # Gather a few pieces of information using the helpers exposed by the action context.
        selected_record = context.get_record(%w[id iban organization_id])
        new_iban = context.get_form_value(IBAN_FORM_FIELD_ID)
        record_details = %w[id iban organization_id].map do |field|
          value = selected_record&.dig(field) || selected_record&.dig(field.to_sym)
          "#{field}=#{value}" if value
        end.compact.join(', ')

        context.collection.update(context.filter, { iban: new_iban })

        collection_name = context.collection.schema[:name] || BANK_ACCOUNT_COLLECTION
        native_driver = context.collection.native_driver.class.name
        schema_fields = context
          .datasource
          .get_collection(BANK_ACCOUNT_COLLECTION)
          .schema[:fields] || {}
        datasource_fields = schema_fields.keys.take(3).join(', ')

        message = "Bank account #{context.record_id} updated."

        html_content = <<~HTML
          <div>
            <p>#{message}</p>
            <ul>
              #{record_details.empty? ? '' : "<li><strong>Existing record details:</strong> #{record_details}</li>"}
              #{new_iban.nil? || new_iban.empty? ? '' : "<li><strong>New IBAN:</strong> #{new_iban}</li>"}
              <li><strong>Collection:</strong> #{collection_name}</li>
              <li><strong>Native driver:</strong> #{native_driver}</li>
              <li><strong>Sample datasource fields:</strong> #{datasource_fields}</li>
            </ul>
          </div>
        HTML

        result_builder.success(message: message, options: { html: html_content })
      end

      agent.customize_collection(BANK_ACCOUNT_COLLECTION) do |collection|
        collection.add_action('Update IBAN', action)
      end
    end

    Actions = self
  end
end
