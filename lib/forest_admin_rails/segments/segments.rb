# frozen_string_literal: true

require_relative 'organization_segments'

module ForestAdminRails
  module Segments
    module_function

    def register(agent)
      OrganizationSegments.register(agent)
    end

    Segments = self
  end
end
