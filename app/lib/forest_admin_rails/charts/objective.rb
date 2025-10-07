# frozen_string_literal: true

module ForestAdminRails
  module Charts
    module Objective
      module_function

      CHART_NAME = 'Total incomes vs objective'

      def register(agent)
        agent.add_chart(CHART_NAME) do |_context, result_builder|
          total_amount = Api::Income.sum(:amount).to_i
          objective_amount = 10000.to_i

          result_builder.objective(total_amount, objective_amount)
        end
      end

      Objective = self
    end
  end
end
