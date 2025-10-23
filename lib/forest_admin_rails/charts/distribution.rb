# frozen_string_literal: true

module ForestAdminRails
  module Charts
    module Distribution
      module_function

      CHART_NAME = 'Income distribution'

      def register(agent)
        register_agent_chart(agent)
        register_collection_chart(agent)
      end

      def register_agent_chart(agent)
        agent.add_chart(CHART_NAME) do |_context, result_builder|
          sample_data = distribution_sample

          result_builder.distribution(sample_data)
        end
      end

      def register_collection_chart(agent)
        agent.customize_collection('Api__BankAccount') do |collection|
          collection.add_chart(CHART_NAME) do |_context, result_builder|
            result_builder.distribution(distribution_sample)
          end
        end
      end

      def distribution_sample
        {
          'Subscriptions' => 48,
          'One-off sales' => 32,
          'Affiliate' => 15,
          'Other' => 5
        }
      end

      Distribution = self
    end
  end
end
