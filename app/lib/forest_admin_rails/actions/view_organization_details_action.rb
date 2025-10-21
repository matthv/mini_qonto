# frozen_string_literal: true

module ForestAdminRails
  module Actions
    module ViewOrganizationDetailsAction
      module_function

      REDIRECT_TARGET_FIELD_ID = 'redirectTarget'

      ACTION_FORM = [
        {
          type: 'Enum',
          id: REDIRECT_TARGET_FIELD_ID,
          label: 'Where to redirect',
          description: 'Choose where you want to be redirected',
          enum_values: %w[organization_details transactions_list related_accounts],
          is_required: true,
          default_value: 'organization_details'
        },
        {
          type: 'Layout',
          component: 'HtmlBlock',
          content: lambda do |context|
            bank_account = context.get_record(%w[id organization_id])
            org_id = bank_account&.dig('organization_id') || bank_account&.dig(:organization_id)

            if org_id
              <<~HTML
                <p>This will redirect you to view information for <strong>Organization ##{org_id}</strong>.</p>
              HTML
            else
              <<~HTML
                <p><em>No organization linked to this bank account.</em></p>
              HTML
            end
          end
        }
      ].freeze

      def register(agent)
        action = ForestAdminDatasourceCustomizer::Decorators::Action::BaseAction.new(
          scope: ForestAdminDatasourceCustomizer::Decorators::Action::Types::ActionScope::SINGLE,
          description: 'Navigate to related organization details',
          form: ACTION_FORM,
          submit_button_label: 'Go to organization'
        ) do |context, result_builder|
          bank_account = context.get_record(%w[id organization_id])
          organization_id = bank_account&.dig('organization_id') || bank_account&.dig(:organization_id)

          if organization_id.nil?
            return result_builder.error(
              message: 'This bank account is not linked to any organization.'
            )
          end

          redirect_target = context.get_form_value(REDIRECT_TARGET_FIELD_ID)

          # Build the redirect path based on the target
          redirect_path = case redirect_target
                          when 'organization_details'
                            # Redirect to the organization record details page
                            build_record_path('Api__OrganizationsView', organization_id)
                          else
                            # Fallback to organization details
                            build_record_path('Api__OrganizationsView', organization_id)
                          end

          result_builder.redirect_to(path: redirect_path)
        end

        agent.customize_collection(ForestAdminRails::Actions::BANK_ACCOUNT_COLLECTION) do |collection|
          collection.add_action('View organization', action)
        end
      end

      # Build Forest Admin record detail path
      def build_record_path(collection_name, record_id)
        "/Squad%20Qonto/Development/Operations/data/#{collection_name}/index/record/Api__OrganizationsView/#{record_id}/details"
      end
    end
  end
end
