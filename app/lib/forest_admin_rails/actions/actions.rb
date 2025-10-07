# frozen_string_literal: true

module ForestAdminRails
  module Actions
    module_function

    BANK_ACCOUNT_COLLECTION = 'Api__BankAccount'

    def register(agent)
      action = ForestAdminDatasourceCustomizer::Decorators::Action::BaseAction.new(
        scope: ForestAdminDatasourceCustomizer::Decorators::Action::Types::ActionScope::SINGLE,
        description: 'Mark the selected bank account as reviewed'
      ) do |context, result_builder|
        result_builder.success(message: "Bank account #{context.record_id} marked as reviewed.")
      end

      agent.customize_collection(BANK_ACCOUNT_COLLECTION) do |collection|
        collection.add_action('Mark as reviewed', action)
      end
    end

    Actions = self
  end
end
