# frozen_string_literal: true

module ForestAdminRails
  module Hooks
    module AfterUpdate
      module_function

      BANK_ACCOUNT_COLLECTION = 'Api__BankAccount'

      def register(agent)
        agent.customize_collection(BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_hook('After', 'Update') do |context|
            # Log the update action
            changed_fields = context.patch.keys
            Rails.logger.info("Bank account #{context.record['id']} updated. Changed fields: #{changed_fields.join(', ')}")

            # Send audit trail event
            # AuditTrailService.log_update(
            #   resource: 'bank_account',
            #   resource_id: context.record['id'],
            #   changed_fields: changed_fields,
            #   user_id: context.caller.id
            # )

            # Invalidate cache
            Rails.cache.delete("bank_account_#{context.record['id']}")
          end
        end
      end
    end
  end
end
