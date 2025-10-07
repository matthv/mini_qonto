# frozen_string_literal: true

module ForestAdminRails
  module Charts
    module Percentage
      module_function

      CHART_NAME = 'Total incomes progression'

      def register(agent)
        agent.add_chart(CHART_NAME) do |_context, result_builder|
          total_amount = 1000
          objective_amount = 50000

          percentage = objective_amount.positive? ? ((total_amount / objective_amount) * 100).round(2) : 0

          result_builder.percentage(percentage)
        end
      end

      Percentage = self
    end
  end
end
