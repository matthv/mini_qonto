# frozen_string_literal: true

require_relative 'value'
require_relative 'objective'
require_relative 'percentage'
require_relative 'distribution'
require_relative 'leaderboard'
require_relative 'multiple_time_based'
require_relative 'time_based'

module ForestAdminRails
  module Charts
    module_function

    def register(agent)
      Value.register(agent)
      Objective.register(agent)
      Percentage.register(agent)
      Distribution.register(agent)
      Leaderboard.register(agent)
      MultipleTimeBased.register(agent)
      TimeBased.register(agent)
    end

    Charts = self
  end
end
