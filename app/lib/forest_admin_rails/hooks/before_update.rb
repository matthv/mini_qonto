# frozen_string_literal: true

module ForestAdminRails
  module Hooks
    module BeforeUpdate
      module_function

      BANK_ACCOUNT_COLLECTION = 'Api__BankAccount'

      def register(agent)
        agent.customize_collection(BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_hook('Before', 'Update') do |context|
            # Prevent updating IBAN if account is verified
            if context.patch.key?('iban')
              record = context.collection.get(context.filter)
              if record['verified_at'].present?
                raise ForestAdminDatasourceToolkit::Exceptions::ForbiddenError, 'Cannot update IBAN of verified account'
              end
            end

            # Track last updated timestamp
            context.patch['updated_at'] = Time.current
          end
        end
      end
    end
  end
end
