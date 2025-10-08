# frozen_string_literal: true

require 'erb'

module ForestAdminRails
  module Actions
    module BulkVipStatusAction
      module_function

      VIP_STATUS_FIELD_ID = 'vipStatus'
      REASON_FIELD_ID = 'vipReason'

      FORM = [
        {
          type: 'Layout',
          component: 'Page',
          next_button_label: 'Next',
          previous_button_label: nil,
          elements: [
            {
              type: 'Boolean',
              widget: 'Dropdown',
              id: VIP_STATUS_FIELD_ID,
              label: 'VIP status to apply',
              description: 'Choose the VIP status that will be applied to all selected bank accounts.',
              options: [
                { label: 'Mark as VIP', value: true },
                { label: 'Remove VIP status', value: false }
              ],
              is_required: true
            }
          ]
        },
        {
          type: 'Layout',
          component: 'Page',
          next_button_label: 'Apply update',
          previous_button_label: 'Back',
          elements: [
            {
              type: 'Layout',
              component: 'HtmlBlock',
              content: lambda do |context|
                total = context.record_ids.size
                status = context.get_form_value(VIP_STATUS_FIELD_ID)
                human_label = status ? 'mark' : 'remove'

                "<p>You are about to #{human_label} the VIP status for <strong>#{total}</strong> bank account(s).</p>"
              end
            },
            {
              type: 'String',
              id: REASON_FIELD_ID,
              label: 'Reason (optional)',
              description: 'Add a note that explains why this change is required.',
              widget: 'TextArea',
              placeholder: 'Provide extra context for your teammates'
            }
          ]
        }
      ].freeze

      def register(agent)
        action = ForestAdminDatasourceCustomizer::Decorators::Action::BaseAction.new(
          scope: ForestAdminDatasourceCustomizer::Decorators::Action::Types::ActionScope::BULK,
          description: 'Mark or unmark organizations as VIP for the selected bank accounts',
          form: FORM,
          submit_button_label: 'Apply VIP status'
        ) do |context, result_builder|
          new_status = cast_to_boolean(context.get_form_value(VIP_STATUS_FIELD_ID))

          reason = context.get_form_value(REASON_FIELD_ID)
          bank_account_ids = context.record_ids

          message = "#{new_status ? 'Marked' : 'Removed'} VIP status for #{bank_account_ids.size} account(s). Reason: #{reason}"

          result_builder.success(message: message)
        end

        agent.customize_collection(ForestAdminRails::Actions::BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_action('Update VIP status', action)
        end
      end

      def cast_to_boolean(value)
        return if value.nil?

        ActiveModel::Type::Boolean.new.cast(value)
      end
    end
  end
end
