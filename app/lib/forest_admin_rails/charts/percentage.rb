# frozen_string_literal: true

module ForestAdminRails
  module Charts
    module Percentage
      module_function

      CHART_NAME = 'Total incomes progression'

      def register(agent)
        register_agent_chart(agent)
        register_collection_chart(agent)
      end

      def register_agent_chart(agent)
        agent.add_chart(CHART_NAME) do |_context, result_builder|
          result_builder.percentage(percentage_value)
        end
      end

      def register_collection_chart(agent)
        agent.customize_collection('Api__BankAccount') do |collection|
          collection.add_chart(CHART_NAME) do |_context, result_builder|
            result_builder.percentage(percentage_value)
          end
        end
      end

      def percentage_value
        44
      end

      Percentage = self
    end
  end
end
