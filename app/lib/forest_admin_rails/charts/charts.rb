# frozen_string_literal: true

require_relative 'value'
require_relative 'objective'

module ForestAdminRails
  module Charts
    module_function

    def register(agent)
      Value.register(agent)
      Objective.register(agent)
    end

    Charts = self
  end
end
