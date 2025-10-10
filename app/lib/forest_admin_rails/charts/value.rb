# frozen_string_literal: true

module ForestAdminRails
  module Charts
    module Value
      module_function

      def register(agent)
        register_agent_charts(agent)
        register_collection_charts(agent)
      end

      Charts = self

      def register_agent_charts(agent)
        agent.add_chart('Total incomes amount') do |_context, result_builder|
          result_builder.value(total_amount || 0)
        end

        agent.add_chart('Failing incomes chart') do |_context, _result_builder|
          raise(StandardError, 'Unexpected chart failure')
        end
      end

      def register_collection_charts(agent)
        agent.customize_collection('Api__BankAccount') do |collection|
          collection.add_chart('Bank accounts total incomes') do |_context, result_builder|
            result_builder.value(total_amount || 0)
          end

          collection.add_chart('Failing incomes chart') do |_context, _result_builder|
            raise(StandardError, 'Unexpected chart failure')
          end
        end
      end

      def total_amount
        Api::Income.sum(:amount)
      end
    end
  end
end
