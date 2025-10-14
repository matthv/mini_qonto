# frozen_string_literal: true

module ForestAdminRails
  module Hooks
    module AfterDelete
      module_function

      BANK_ACCOUNT_COLLECTION = 'Api__BankAccount'

      def register(agent)
        agent.customize_collection(BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_hook('After', 'Delete') do |context|
            # Log deletion for audit
            if context
               Rails.logger.warn("Bank account deleted: #{context.record['id']} by user: #{context.caller.id}")
            end

            # Archive the deleted record
            # ArchiveService.archive_bank_account(context.record)

            # Send notification to compliance team
            # ComplianceNotifier.bank_account_deleted(context.record['id'], context.caller.id)

            # Update deletion metrics
            Rails.cache.increment('bank_accounts_deleted_today', 1)
          end
        end
      end
    end
  end
end
