# frozen_string_literal: true

module ForestAdminRails
  module Hooks
    module BeforeList
      module_function

      BANK_ACCOUNT_COLLECTION = 'Api__BankAccount'

      def register(agent)
        agent.customize_collection(BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_hook('Before', 'List') do |context|
            # Log the list request
            Rails.logger.info("Listing bank accounts for user: #{context.caller.id}")

            # Add a filter to exclude archived accounts
            context.filter = context.filter.and({ field: 'status', operator: 'not_equal', value: 'archived' })
          end
        end
      end
    end
  end
end
