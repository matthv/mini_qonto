# frozen_string_literal: true

module ForestAdminRails
  module Actions
    module SyncExternalSystemAction
      module_function

      SYNC_TYPE_FIELD_ID = 'syncType'
      WEBHOOK_URL_FIELD_ID = 'webhookUrl'

      ACTION_FORM = [
        {
          type: 'Enum',
          id: SYNC_TYPE_FIELD_ID,
          label: 'Sync type',
          description: 'Choose what to sync with the external system',
          enum_values: %w[account_data transaction_history full_sync],
          is_required: true,
          default_value: 'account_data'
        },
        {
          type: 'String',
          id: WEBHOOK_URL_FIELD_ID,
          label: 'Webhook URL (optional)',
          description: 'Override the default webhook URL if needed',
          placeholder: 'https://your-system.com/webhook'
        }
      ].freeze

      def register(agent)
        action = ForestAdminDatasourceCustomizer::Decorators::Action::BaseAction.new(
          scope: ForestAdminDatasourceCustomizer::Decorators::Action::Types::ActionScope::SINGLE,
          description: 'Trigger synchronization with external system via webhook',
          form: ACTION_FORM,
          submit_button_label: 'Sync now'
        ) do |context, result_builder|
          sync_type = context.get_form_value(SYNC_TYPE_FIELD_ID)
          custom_webhook_url = context.get_form_value(WEBHOOK_URL_FIELD_ID)
          bank_account = context.get_record(%w[id iban organization_id])

          bank_account_id = bank_account&.dig('id') || bank_account&.dig(:id)

          if bank_account_id.nil?
            return result_builder.error(message: 'Unable to retrieve bank account information.')
          end

          # Build webhook payload
          webhook_url = custom_webhook_url.to_s.strip.empty? ? default_webhook_url : custom_webhook_url

          # Trigger webhook
          result_builder.webhook(
            url: webhook_url,
            method: 'GET',
          )
        end

        agent.customize_collection(ForestAdminRails::Actions::BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_action('Sync with external system', action)
        end
      end

      def default_webhook_url
        # Default webhook URL - could be configured via environment variable
        ENV.fetch('EXTERNAL_SYNC_WEBHOOK_URL', 'https://api.example.com/webhooks/forest-admin-sync')
      end
    end
  end
end
