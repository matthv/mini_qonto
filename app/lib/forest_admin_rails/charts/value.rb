# frozen_string_literal: true

module ForestAdminRails
  module Charts
    module Value
      module_function

      def register(agent)
        agent.add_chart('Total incomes amount') do |_context, result_builder|
          total_amount = Api::Income.sum(:amount)

          result_builder.value(total_amount || 0)
        end
      end

      Charts = self
    end
  end
end
