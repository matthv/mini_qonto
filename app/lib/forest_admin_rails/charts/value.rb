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

        agent.add_chart('Failing incomes chart') do |_context, _result_builder|
          raise(StandardError, 'Unexpected chart failure')
        end

        agent.customize_collection('Api__BankAccount') do |collection|
          collection.add_chart('Bank accounts total incomes') do |_context, result_builder|
            total_amount = Api::Income.sum(:amount)

            result_builder.value(total_amount || 0)
          end
        end
      end

      Charts = self
    end
  end
end
