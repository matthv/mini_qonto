# frozen_string_literal: true

module ForestAdminRails
  module Hooks
    module AfterList
      module_function

      BANK_ACCOUNT_COLLECTION = 'Api__BankAccount'

      def register(agent)
        agent.customize_collection(BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_hook('After', 'List') do |context|
            # Mask sensitive data for non-admin users
            unless context.caller.permission_level == 'admin'
              context.records.each do |record|
                if record['iban'].present?
                  record['iban'] = record['iban'][0..3] + '***'
                end
                if record['account_number'].present?
                  record['account_number'] = '****' + record['account_number'][-4..]
                end
              end
            end
          end
        end
      end
    end
  end
end
