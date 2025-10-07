# frozen_string_literal: true

module ForestAdminRails
  module Charts
    module Distribution
      module_function

      CHART_NAME = 'Income distribution'

      def register(agent)
        agent.add_chart(CHART_NAME) do |_context, result_builder|
          sample_data = {
            'Subscriptions' => 48,
            'One-off sales' => 32,
            'Affiliate' => 15,
            'Other' => 5
          }

          result_builder.distribution(sample_data)
        end
      end

      Distribution = self
    end
  end
end
