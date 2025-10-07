# frozen_string_literal: true

module ForestAdminRails
  module Charts
    module Leaderboard
      module_function

      CHART_NAME = 'Income leaderboard'

      def register(agent)
        agent.add_chart(CHART_NAME) do |_context, result_builder|
          sample_data = {
            'Enterprise plan' => 180,
            'Business plan' => 120,
            'Starter plan' => 80,
            'Add-ons' => 45
          }

          result_builder.leaderboard(sample_data)
        end
      end

      Leaderboard = self
    end
  end
end
