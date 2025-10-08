# frozen_string_literal: true

require_relative 'update_iban_action'
require_relative 'bulk_vip_status_action'

module ForestAdminRails
  module Actions
    module_function

    BANK_ACCOUNT_COLLECTION = 'Api__BankAccount'

    def register(agent)
      UpdateIbanAction.register(agent)
      BulkVipStatusAction.register(agent)
    end

    Actions = self
  end
end
