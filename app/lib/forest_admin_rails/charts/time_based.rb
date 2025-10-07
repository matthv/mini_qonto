# frozen_string_literal: true

require 'date'

module ForestAdminRails
  module Charts
    module TimeBased
      module_function

      CHART_CONFIGURATIONS = {
        'Yearly incomes trend' => {
          range: 'Year',
          values: [
            { date: Date.new(2021, 1, 1), value: 120_000 },
            { date: Date.new(2022, 1, 1), value: 150_000 },
            { date: Date.new(2023, 1, 1), value: 185_000 },
            { date: Date.new(2024, 1, 1), value: 210_000 }
          ]
        },
        'Monthly incomes trend' => {
          range: 'Month',
          values: [
            { date: Date.new(2024, 1, 1), value: 16_500 },
            { date: Date.new(2024, 2, 1), value: 18_200 },
            { date: Date.new(2024, 3, 1), value: 19_750 },
            { date: Date.new(2024, 4, 1), value: 20_300 }
          ]
        },
        'Weekly incomes trend' => {
          range: 'Week',
          values: [
            { date: Date.new(2024, 4, 1), value: 4_200 },
            { date: Date.new(2024, 4, 8), value: 4_450 },
            { date: Date.new(2024, 4, 15), value: 4_780 },
            { date: Date.new(2024, 4, 22), value: 4_950 }
          ]
        },
        'Daily incomes trend' => {
          range: 'Day',
          values: [
            { date: Date.new(2024, 4, 22), value: 620 },
            { date: Date.new(2024, 4, 23), value: 680 },
            { date: Date.new(2024, 4, 24), value: 700 },
            { date: Date.new(2024, 4, 25), value: 710 }
          ]
        }
      }.freeze

      def register(agent)
        CHART_CONFIGURATIONS.each do |chart_name, configuration|
          agent.add_chart(chart_name) do |_context, result_builder|
            result_builder.time_based(configuration[:range], configuration[:values])
          end
        end
      end

      TimeBased = self
    end
  end
end
