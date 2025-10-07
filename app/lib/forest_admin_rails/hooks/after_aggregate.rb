# frozen_string_literal: true

module ForestAdminRails
  module Hooks
    module AfterAggregate
      module_function

      BANK_ACCOUNT_COLLECTION = 'Api__BankAccount'

      def register(agent)
        agent.customize_collection(BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_hook('After', 'Aggregate') do |context|
          end
        end
      end
    end
  end
end
