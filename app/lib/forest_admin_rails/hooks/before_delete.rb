# frozen_string_literal: true

module ForestAdminRails
  module Hooks
    module BeforeDelete
      module_function

      BANK_ACCOUNT_COLLECTION = 'Api__BankAccount'

      def register(agent)
        agent.customize_collection(BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_hook('Before', 'Delete') do |context|
            # Prevent deletion of active accounts
            record = context.collection.get(context.filter)
            if record['status'] == 'active'
              raise ForestAdminDatasourceToolkit::Exceptions::ForbiddenError, 'Cannot delete active bank account'
            end

            # Require admin permission for deletion
            unless context.caller.permission_level == 'admin'
              raise ForestAdminDatasourceToolkit::Exceptions::ForbiddenError, 'Only admins can delete bank accounts'
            end
          end
        end
      end
    end
  end
end
