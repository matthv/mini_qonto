# frozen_string_literal: true

require 'date'

module ForestAdminRails
  module Charts
    module MultipleTimeBased
      module_function

      CHART_NAME = 'Income trend comparison'

      def register(agent)
        agent.add_chart(CHART_NAME) do |_context, result_builder|
          dates = [
            Date.new(2024, 1, 1),
            Date.new(2024, 2, 1),
            Date.new(2024, 3, 1),
            Date.new(2024, 4, 1)
          ]

          lines = [
            { label: 'Enterprise plan', values: [120, 135, 150, 170] },
            { label: 'Business plan', values: [95, 110, 118, 125] },
            { label: 'Starter plan', values: [60, 72, 68, 75] }
          ]

          result_builder.multiple_time_based('Month', dates, lines)
        end
      end

      MultipleTimeBased = self
    end
  end
end
