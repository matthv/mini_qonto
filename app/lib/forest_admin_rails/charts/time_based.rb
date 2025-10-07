# frozen_string_literal: true

module ForestAdminRails
  module Charts
    module TimeBased
      module_function

      MONTH_WINDOW = 5

      def register(agent)
        agent.add_chart('Monthly incomes trend') do |_context, result_builder|
          end_month = Time.zone.now.beginning_of_month
          start_month = end_month - MONTH_WINDOW.months

          amounts = Api::Income
            .where(created_at: start_month..end_month.end_of_month)
            .group("DATE_TRUNC('month', created_at)")
            .sum(:amount)

          monthly_totals = amounts.each_with_object({}) do |(timestamp, total), acc|
            acc[timestamp.to_date] = total || 0
          end

          values = (0..MONTH_WINDOW).map do |offset|
            month_start = (start_month + offset.months).to_date
            { date: month_start, value: monthly_totals.fetch(month_start, 0) }
          end

          result_builder.time_based('Month', values)
        end
      end

      Charts = self
    end
  end
end
