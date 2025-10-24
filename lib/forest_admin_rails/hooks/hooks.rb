# frozen_string_literal: true

require_relative 'before_list'
require_relative 'before_create'
require_relative 'before_update'
require_relative 'before_delete'
require_relative 'before_aggregate'
require_relative 'after_list'
require_relative 'after_create'
require_relative 'after_update'
require_relative 'after_delete'
require_relative 'after_aggregate'

module ForestAdminRails
  module Hooks
    module_function

    def register(agent)
      BeforeList.register(agent)
      BeforeCreate.register(agent)
      BeforeUpdate.register(agent)
      BeforeDelete.register(agent)
      BeforeAggregate.register(agent)
      AfterList.register(agent)
      AfterCreate.register(agent)
      AfterUpdate.register(agent)
      AfterDelete.register(agent)
      AfterAggregate.register(agent)
    end

    Hooks = self
  end
end
