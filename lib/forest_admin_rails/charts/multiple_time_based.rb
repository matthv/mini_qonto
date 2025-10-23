# frozen_string_literal: true

require 'date'

module ForestAdminRails
  module Charts
    module MultipleTimeBased
      module_function

      CHART_NAME = 'Income trend comparison'

      def register(agent)
        register_agent_chart(agent)
        register_collection_chart(agent)
      end

      def register_agent_chart(agent)
        agent.add_chart(CHART_NAME) do |_context, result_builder|
          result_builder.multiple_time_based('Month', chart_dates, chart_lines)
        end
      end

      def register_collection_chart(agent)
        agent.customize_collection('Api__BankAccount') do |collection|
          collection.add_chart(CHART_NAME) do |_context, result_builder|
            result_builder.multiple_time_based('Month', chart_dates, chart_lines)
          end
        end
      end

      def chart_dates
        [
          Date.new(2024, 1, 1),
          Date.new(2024, 2, 1),
          Date.new(2024, 3, 1),
          Date.new(2024, 4, 1)
        ]
      end

      def chart_lines
        [
          { label: 'Enterprise plan', values: [120, 135, 150, 170] },
          { label: 'Business plan', values: [95, 110, 118, 125] },
          { label: 'Starter plan', values: [60, 72, 68, 75] }
        ]
      end

      MultipleTimeBased = self
    end
  end
end
