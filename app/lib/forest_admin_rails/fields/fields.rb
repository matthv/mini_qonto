# frozen_string_literal: true

module ForestAdminRails
  module Fields
    module_function

    require_relative 'bank_account_fields'

    def register(agent)
      BankAccountFields.register(agent)
    end

    Fields = self
  end
end
