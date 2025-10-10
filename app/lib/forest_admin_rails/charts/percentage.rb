# frozen_string_literal: true

module ForestAdminRails
  module Charts
    module Percentage
      module_function

      CHART_NAME = 'Total incomes progression'

      def register(agent)
        agent.add_chart(CHART_NAME) do |_context, result_builder|
          result_builder.percentage(44)
        end
      end

      Percentage = self
    end
  end
end
