# frozen_string_literal: true

require 'csv'

module ForestAdminRails
  module Actions
    module ExportTransactionsAction
      module_function

      FORMAT_FIELD_ID = 'exportFormat'

      ACTION_FORM = [
        {
          type: 'Enum',
          id: FORMAT_FIELD_ID,
          label: 'Export format',
          description: 'Choose the format for the exported file',
          enum_values: %w[csv json],
          is_required: true,
          default_value: 'csv'
        }
      ].freeze

      def register(agent)
        action = ForestAdminDatasourceCustomizer::Decorators::Action::BaseAction.new(
          scope: ForestAdminDatasourceCustomizer::Decorators::Action::Types::ActionScope::BULK,
          description: 'Export selected transactions to a file',
          form: ACTION_FORM,
          submit_button_label: 'Export',
          is_generate_file: true
        ) do |context, result_builder|
          format = context.get_form_value(FORMAT_FIELD_ID)
          transaction_ids = Array(context.record_ids)

          if transaction_ids.empty?
            return result_builder.error(message: 'Please select at least one transaction to export.')
          end

          transactions = Api::Transaction.where(id: transaction_ids).order(:id)

          case format
          when 'csv'
            content = generate_csv(transactions)
            result_builder.file(
              content: content,
              name: "transactions_export_#{Time.current.strftime('%Y%m%d_%H%M%S')}.csv",
              mime_type: 'text/csv'
            )
          when 'json'
            content = generate_json(transactions)
            result_builder.file(
              content: content,
              name: "transactions_export_#{Time.current.strftime('%Y%m%d_%H%M%S')}.json",
              mime_type: 'application/json'
            )
          else
            result_builder.error(message: 'Invalid export format selected.')
          end
        end

        agent.customize_collection('Api__Transaction') do |collection|
          collection.add_action('Export transactions', action)
        end
      end

      def generate_csv(transactions)
        CSV.generate do |csv|
          # Header row
          csv << %w[id bank_account_id]

          # Data rows
          transactions.each do |transaction|
            csv << [
              transaction.id,
              transaction.bank_account_id
            ]
          end
        end
      end

      def generate_json(transactions)
        data = transactions.map do |transaction|
          {
            id: transaction.id,
            bank_account_id: transaction.bank_account_id
          }
        end

        JSON.pretty_generate({
          exported_at: Time.current.iso8601,
          count: data.size,
          transactions: data
        })
      end
    end
  end
end
