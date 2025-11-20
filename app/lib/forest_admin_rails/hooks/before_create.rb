# frozen_string_literal: true

module ForestAdminRails
  module Hooks
    module BeforeCreate
      module_function

      BANK_ACCOUNT_COLLECTION = 'Api__BankAccount'

      def register(agent)
        agent.customize_collection(BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_hook('Before', 'Create') do |context|
            # Validate IBAN format before creation
            if context.data['iban'].present?
              iban = context.data['iban'].gsub(/\s+/, '')
              unless iban.match?(/^[A-Z]{2}\d{2}[A-Z0-9]+$/)
                context.raise_validation_error('Invalid IBAN format')
              end
            end
          end
        end
      end
    end
  end
end
