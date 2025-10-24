# frozen_string_literal: true

module ForestAdminRails
  module Fields
    module BankAccountFields
      module_function

      def register(agent)
        agent.customize_collection(ForestAdminRails::Actions::BANK_ACCOUNT_COLLECTION) do |collection|
          # Add smart field 'identifier' that concatenates id and last 4 digits of IBAN
          field_definition = ForestAdminDatasourceCustomizer::Decorators::Computed::ComputedDefinition.new(
            column_type: ForestAdminDatasourceToolkit::Schema::PrimitiveType::STRING,
            dependencies: ['id', 'iban'],
            values: proc do |records|
              records.map do |record|
                id = record['id'] || record[:id]
                iban = record['iban'] || record[:iban]

                # Get last 4 digits of IBAN (removing spaces if any)
                last_4_digits = iban.to_s.gsub(/\s+/, '')[-4..-1] || ''

                # Concatenate id and last 4 digits
                "#{id}_#{last_4_digits}"
              end
            end
          )

          collection.add_field('identifier', field_definition)

          # Enable filtering/search on the identifier field
          collection.emulate_field_filtering('identifier')
        end
      end
    end
  end
end
