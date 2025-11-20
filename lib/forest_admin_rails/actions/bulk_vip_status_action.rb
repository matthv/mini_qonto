# frozen_string_literal: true

require 'erb'

module ForestAdminRails
  module Actions
    module BulkVipStatusAction
      module_function

      VIP_STATUS_FIELD_ID = 'vipStatus'
      ORGANIZATION_FIELD_ID = 'targetOrganization'
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
            },
            {
              type: 'Collection',
              id: ORGANIZATION_FIELD_ID,
              label: 'Organizations view (optional)',
              description: 'Reassign all selected bank accounts to a specific organization.',
              collection_name: 'Api__OrganizationsView',
            }
          ]
        },
        {
          type: 'Layout',
          component: 'Page',
          next_button_label: 'Review changes',
          previous_button_label: 'Back',
          if_condition: lambda do |context|
            !context.get_form_value(ORGANIZATION_FIELD_ID).nil?
          end,
          elements: [
            {
              type: 'Layout',
              component: 'HtmlBlock',
              content: lambda do |context|
                organization_info = ForestAdminRails::Actions::BulkVipStatusAction.organization_info_for(
                  context.get_form_value(ORGANIZATION_FIELD_ID)
                )
                total = context.record_ids.size

                <<~HTML
                  <p>You chose to reassign <strong>#{total}</strong> bank account(s) to <strong>#{ERB::Util.h(organization_info[:label])}</strong>.</p>
                  <p>Continue to review the full set of changes before applying them.</p>
                HTML
              end
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
                status = ForestAdminRails::Actions::BulkVipStatusAction.cast_to_boolean(
                  context.get_form_value(VIP_STATUS_FIELD_ID)
                )
                human_label = status ? 'mark' : 'remove'
                organization_info = ForestAdminRails::Actions::BulkVipStatusAction.organization_info_for(
                  context.get_form_value(ORGANIZATION_FIELD_ID)
                )

                summary_lines = [
                  "<p>You are about to #{human_label} the VIP status for <strong>#{total}</strong> bank account(s).</p>"
                ]

                if organization_info[:selected]
                  summary_lines << "<p>The selected bank account(s) will be reassigned to <strong>#{ERB::Util.h(organization_info[:label])}</strong>.</p>"
                end

                summary_lines.join
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
      ]

      def register(agent)
        action = ForestAdminDatasourceCustomizer::Decorators::Action::BaseAction.new(
          scope: ForestAdminDatasourceCustomizer::Decorators::Action::Types::ActionScope::BULK,
          description: 'Mark or unmark organizations as VIP for the selected bank accounts',
          form: FORM,
          submit_button_label: 'Apply VIP status'
        ) do |context, result_builder|
          new_status = cast_to_boolean(context.get_form_value(VIP_STATUS_FIELD_ID))

          return result_builder.error(message: 'Please choose a valid VIP status.') if new_status.nil?

          reason = context.get_form_value(REASON_FIELD_ID)
          bank_account_ids = Array(context.record_ids)
          organization_info = organization_info_for(context.get_form_value(ORGANIZATION_FIELD_ID))

          if bank_account_ids.empty?
            return result_builder.error(message: 'Select at least one bank account to run this action.')
          end

          if organization_info[:invalid]
            return result_builder.error(message: 'The selected organization could not be found.')
          end

          organization_update = reassign_bank_accounts(bank_account_ids, organization_info[:record])

          message = build_success_message(new_status, bank_account_ids.size, organization_update)

          result_builder.success(message: message)
        end

        agent.customize_collection(ForestAdminRails::Actions::BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_action('Update VIP status', action)
        end
      end

      def organization_info_for(organization_id)
        return { selected: false, label: nil, record: nil, target_id: nil, invalid: false } if organization_id.nil?

        record = find_organization(organization_id)
        return {
          selected: true,
          label: organization_label(record, organization_id),
          record: record,
          target_id: organization_id,
          invalid: false
        }
      end

      def find_organization(organization_id)
        return if organization_id.nil?

        Api::OrganizationsView.find_by(id: organization_id)
      end

      def organization_label(organization, fallback_id)
        return "Organization ##{fallback_id}" if organization.nil?

        name = organization.respond_to?(:name) ? organization.name : nil
        name.to_s.strip.empty? ? "Organization ##{organization.id}" : name
      end

      def reassign_bank_accounts(bank_account_ids, target_organization)
        return { count: 0, organization: nil, target_id: nil } unless target_organization

        scope = Api::BankAccount.where(id: bank_account_ids)
        updated_count = scope.where.not(organization_id: target_organization.id)
                              .update_all(organization_id: target_organization.id)

        {
          count: updated_count,
          organization: target_organization,
          target_id: target_organization.id
        }
      end

      def build_success_message(new_status, updated_count, organization_update)
        vip_part = "#{new_status ? 'Marked' : 'Removed'} VIP status for #{updated_count} organization(s)."

        return vip_part if organization_update[:target_id].nil?

        target_label = organization_label(organization_update[:organization], organization_update[:target_id])

        if organization_update[:count].positive?
          "#{vip_part} Reassigned #{organization_update[:count]} bank account(s) to #{target_label}."
        else
          "#{vip_part} Bank accounts were already linked to #{target_label}."
        end
      end

      def cast_to_boolean(value)
        return if value.nil?

        ActiveModel::Type::Boolean.new.cast(value)
      end
    end
  end
end
