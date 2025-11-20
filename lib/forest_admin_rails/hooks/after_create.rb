# frozen_string_literal: true

module ForestAdminRails
  module Hooks
    module AfterCreate
      module_function

      BANK_ACCOUNT_COLLECTION = 'Api__BankAccount'

      def register(agent)
        agent.customize_collection(BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_hook('After', 'Create') do |context|
            # Send notification email to user
            Rails.logger.info("New bank account created: #{context.record['id']}")

            # Trigger async verification job
            # BankAccountVerificationJob.perform_later(context.record['id'])

            # Update metrics
            Rails.cache.increment('bank_accounts_created_today', 1)
          end
        end
      end
    end
  end
end
