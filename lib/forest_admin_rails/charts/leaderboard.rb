# frozen_string_literal: true

module ForestAdminRails
  module Charts
    module Leaderboard
      module_function

      CHART_NAME = 'Income leaderboard'

      def register(agent)
        register_agent_chart(agent)
        register_collection_chart(agent)
      end

      def register_agent_chart(agent)
        agent.add_chart(CHART_NAME) do |_context, result_builder|
          result_builder.leaderboard(leaderboard_sample)
        end
      end

      def register_collection_chart(agent)
        agent.customize_collection('Api__BankAccount') do |collection|
          collection.add_chart(CHART_NAME) do |_context, result_builder|
            result_builder.leaderboard(leaderboard_sample)
          end
        end
      end

      def leaderboard_sample
        {
          'Enterprise plan' => 180,
          'Business plan' => 120,
          'Starter plan' => 80,
          'Add-ons' => 45
        }
      end

      Leaderboard = self
    end
  end
end
