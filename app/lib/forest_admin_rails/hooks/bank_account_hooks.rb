# frozen_string_literal: true

module ForestAdminRails
  module Hooks
    module BankAccountHooks
      module_function

      def register(agent)
        agent.customize_collection(ForestAdminRails::Hooks::BANK_ACCOUNT_COLLECTION) do |collection|
          # Before List Hook
          collection.add_hook('Before', 'List') do |context|
            caller_name = format_caller_name(context.caller)

            Rails.logger.info("🏦 [BEFORE LIST] Bank accounts collection")
            Rails.logger.info("  - User: #{caller_name}")
            Rails.logger.info("  - Filter: #{context.filter.inspect}")

            # Return context to continue with the list operation
            context
          end

          # After List Hook
          collection.add_hook('After', 'List') do |context|
            caller_name = format_caller_name(context.caller)

            Rails.logger.info("🏦 [AFTER LIST] Bank accounts collection")
            Rails.logger.info("  - User: #{caller_name}")
            Rails.logger.info("  - Records returned: #{context.records.size}")

            # Return context to continue with the list operation
            context
          end

          # Before Create Hook
          collection.add_hook('Before', 'Create') do |context|
            caller_name = format_caller_name(context.caller)

            Rails.logger.info("🏦 [BEFORE CREATE] Bank accounts collection")
            Rails.logger.info("  - User: #{caller_name}")
            Rails.logger.info("  - Data: #{context.data.inspect}")

            # Return context to continue with the create operation
            context
          end

          # After Create Hook
          collection.add_hook('After', 'Create') do |context, record|
            caller_name = format_caller_name(context.caller)

            Rails.logger.info("🏦 [AFTER CREATE] Bank accounts collection")
            Rails.logger.info("  - User: #{caller_name}")
            Rails.logger.info("  - Created record ID: #{record['id'] || record[:id]}")

            # Return record to continue with the create operation
            record
          end

          # Before Update Hook
          collection.add_hook('Before', 'Update') do |context|
            caller_name = format_caller_name(context.caller)

            Rails.logger.info("🏦 [BEFORE UPDATE] Bank accounts collection")
            Rails.logger.info("  - User: #{caller_name}")
            Rails.logger.info("  - Filter: #{context.filter.inspect}")
            Rails.logger.info("  - Patch data: #{context.patch.inspect}")

            # Validate IBAN is not empty if it's being updated
            if context.patch.key?('iban') || context.patch.key?(:iban)
              iban_value = context.patch['iban'] || context.patch[:iban]

              if iban_value.nil? || iban_value.to_s.strip.empty?
                raise ForestAdminDatasourceToolkit::Exceptions::ValidationError.new('IBAN cannot be empty')
              end
            end

            # Return context to continue with the update operation
            context
          end

          # After Update Hook
          collection.add_hook('After', 'Update') do |context|
            caller_name = format_caller_name(context.caller)

            Rails.logger.info("🏦 [AFTER UPDATE] Bank accounts collection")
            Rails.logger.info("  - User: #{caller_name}")
            Rails.logger.info("  - Filter: #{context.filter.inspect}")

            # Return context to continue
            context
          end

          # Before Delete Hook
          collection.add_hook('Before', 'Delete') do |context|
            caller_name = format_caller_name(context.caller)

            Rails.logger.info("🏦 [BEFORE DELETE] Bank accounts collection")
            Rails.logger.info("  - User: #{caller_name}")
            Rails.logger.info("  - Filter: #{context.filter.inspect}")

            # Return context to continue with the delete operation
            context
          end

          # After Delete Hook
          collection.add_hook('After', 'Delete') do |context|
            caller_name = format_caller_name(context.caller)

            Rails.logger.info("🏦 [AFTER DELETE] Bank accounts collection")
            Rails.logger.info("  - User: #{caller_name}")
            Rails.logger.info("  - Filter: #{context.filter.inspect}")

            # Return context to continue
            context
          end

          # Before Aggregate Hook
          collection.add_hook('Before', 'Aggregate') do |context|
            caller_name = format_caller_name(context.caller)

            Rails.logger.info("🏦 [BEFORE AGGREGATE] Bank accounts collection")
            Rails.logger.info("  - User: #{caller_name}")
            Rails.logger.info("  - Filter: #{context.filter.inspect}")
            Rails.logger.info("  - Aggregation: #{context.aggregation.inspect}")

            # Return context to continue with the aggregate operation
            context
          end

          # After Aggregate Hook
          collection.add_hook('After', 'Aggregate') do |context, aggregation_result|
            caller_name = format_caller_name(context.caller)

            Rails.logger.info("🏦 [AFTER AGGREGATE] Bank accounts collection")
            Rails.logger.info("  - User: #{caller_name}")
            Rails.logger.info("  - Result: #{aggregation_result.inspect}")

            # Return result to continue
            aggregation_result
          end
        end
      end

      def format_caller_name(caller)
        caller_name_parts = [caller&.first_name, caller&.last_name].compact
        "#{caller_name_parts.join(' ')} (#{caller&.email})"
      end
    end
  end
end
