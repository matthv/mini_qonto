# frozen_string_literal: true


module ForestAdminRails
  module Validations
    module FieldValidations
      include ForestAdminDatasourceToolkit::Components::Query::ConditionTree

      module_function

      BANK_ACCOUNT_COLLECTION = "Api__BankAccount"

      def register(agent)
        agent.customize_collection(BANK_ACCOUNT_COLLECTION) do |collection|
          # collection.add_field_validation("iban", Operators::PRESENT)
          # collection.add_field_validation("iban", Operators::STARTS_WITH, "FR76")
        end
      end
    end
  end
end
