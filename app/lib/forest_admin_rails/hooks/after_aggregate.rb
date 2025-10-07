# frozen_string_literal: true

module ForestAdminRails
  module Hooks
    module AfterAggregate
      module_function

      BANK_ACCOUNT_COLLECTION = 'Api__BankAccount'

      def register(agent)
        agent.customize_collection(BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_hook('After', 'Aggregate') do |context|
            # Log aggregation result
            Rails.logger.info("Aggregation completed: #{context.operation} on #{context.field} = #{context.aggregate}")

            # Cache the aggregation result for performance
            cache_key = "aggregate_#{context.operation}_#{context.field}_#{context.filter.hash}"
            Rails.cache.write(cache_key, context.aggregate, expires_in: 5.minutes)

            # Track analytics
            # AnalyticsService.track_aggregation(context.operation, context.field)
          end
        end
      end
    end
  end
end
