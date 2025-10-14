# frozen_string_literal: true

module ForestAdminRails
  module Actions
    module UpdateIbanAction
      module_function

      IBAN_FORM_FIELD_ID = 'newIban'
      IBAN_MAX_LENGTH = 34

      def format_iban(raw_iban)
        sanitized = raw_iban.to_s.gsub(/\s+/, '')
        trimmed = sanitized[0, IBAN_MAX_LENGTH] || ''

        return '' if trimmed.empty?

        trimmed.scan(/.{1,4}/).join(' ')
      end

      def iban_starts_with_fr76?(raw_iban)
        raw_iban.to_s.gsub(/\s+/, '').upcase.start_with?('FR76')
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
        }
      ].freeze

      def register(agent)
        action = ForestAdminDatasourceCustomizer::Decorators::Action::BaseAction.new(
          scope: ForestAdminDatasourceCustomizer::Decorators::Action::Types::ActionScope::SINGLE,
          description: 'Update the IBAN stored on the selected bank account',
          form: ACTION_FORM,
          submit_button_label: 'Update IBAN'
        ) do |context, result_builder|
          selected_record = context.get_record(%w[id iban organization_id])
          new_iban = context.get_form_value(IBAN_FORM_FIELD_ID)

          unless iban_starts_with_fr76?(new_iban)
            result_builder.error(message: 'The IBAN must start with FR76.')
          else
            new_iban = format_iban(new_iban)
            record_details = %w[id iban organization_id].map do |field|
              value = selected_record&.dig(field) || selected_record&.dig(field.to_sym)
              "#{field}=#{value}" if value
            end.compact.join(', ')

            context.collection.update(context.filter, { iban: new_iban })

            collection_name = context.collection.schema[:name] || ForestAdminRails::Actions::BANK_ACCOUNT_COLLECTION
            native_driver = context.collection.native_driver.class.name
            schema_fields = context
                              .datasource
                              .get_collection(ForestAdminRails::Actions::BANK_ACCOUNT_COLLECTION)
                              .schema[:fields] || {}
            datasource_fields = schema_fields.keys.take(3).join(', ')
            caller = context.caller
            caller_name_parts = [caller&.first_name, caller&.last_name].compact
            caller_name = if caller_name_parts.empty?
                            caller&.email
                          else
                            caller_name_parts.join(' ')
                          end
            caller_timezone = caller&.timezone

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
                  #{caller_name.nil? || caller_name.empty? ? '' : "<li><strong>User:</strong> #{caller_name}</li>"}
                  #{caller_timezone.nil? || caller_timezone.empty? ? '' : "<li><strong>Timezone:</strong> #{caller_timezone}</li>"}
                </ul>
              </div>
            HTML

            result_builder.success(message: message, options: { html: html_content })
          end
        end


        agent.customize_collection(ForestAdminRails::Actions::BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_action('Update IBAN', action)
        end
      end
    end
  end
end
