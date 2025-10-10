# frozen_string_literal: true

module ForestAdminRails
  module Charts
    module Objective
      module_function

      CHART_NAME = 'Total incomes vs objective'

      def register(agent)
        register_agent_chart(agent)
        register_collection_chart(agent)
      end

      def register_agent_chart(agent)
        agent.add_chart(CHART_NAME) do |_context, result_builder|
          result_builder.objective(total_amount, objective_amount)
        end
      end

      def register_collection_chart(agent)
        agent.customize_collection('Api__BankAccount') do |collection|
          collection.add_chart(CHART_NAME) do |_context, result_builder|
            result_builder.objective(total_amount, objective_amount)
          end
        end
      end

      def total_amount
        45_000
      end

      def objective_amount
        10_000
      end

      Objective = self
    end
  end
end
