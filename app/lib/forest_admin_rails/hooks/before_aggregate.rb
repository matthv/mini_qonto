# frozen_string_literal: true

module ForestAdminRails
  module Hooks
    module BeforeAggregate
      module_function

      BANK_ACCOUNT_COLLECTION = 'Api__BankAccount'

      def register(agent)
        agent.customize_collection(BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_hook('Before', 'Aggregate') do |context|
            # Log aggregation request
            Rails.logger.info("Aggregate operation: #{context.operation} on field: #{context.field}")

            # Limit aggregation to non-sensitive fields
            sensitive_fields = %w[iban account_number swift_code]
            if sensitive_fields.include?(context.field)
              raise ForestAdminDatasourceToolkit::Exceptions::ForbiddenError, 'Cannot aggregate on sensitive fields'
            end
          end
        end
      end
    end
  end
end
