# frozen_string_literal: true

module ForestAdminRails
  module Hooks
    module BeforeList
      module_function

      BANK_ACCOUNT_COLLECTION = 'Api__BankAccount'

      def register(agent)
        agent.customize_collection(BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_hook('Before', 'List') do |context|
            # Check if both filter and segment are null/empty
            if context.filter.condition_tree.blank? && context.filter.segment.blank?
              # Add condition to match id = 1
              new_condition = ForestAdminAgent::Utils::ConditionTreeParser.from_plain_object(
                context.collection,
                { field: 'id', operator: 'Equal', value: 1 }
              )
              context._filter = context.filter.override(condition_tree: new_condition)
            end
          end
        end
      end
    end
  end
end
