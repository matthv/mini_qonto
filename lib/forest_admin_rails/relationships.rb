# frozen_string_literal: true

module ForestAdminRails
  module Relationships
    module_function

    def register(agent)
      agent.customize_collection('Api__Organization') do |collection|
        collection.add_one_to_many_relation(
          'bank_accounts',
          'Api__BankAccount',
          origin_key: 'organization_id',
        )
      end
    end
  end
end
