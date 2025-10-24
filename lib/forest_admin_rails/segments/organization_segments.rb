# frozen_string_literal: true

module ForestAdminRails
  module Segments
    module OrganizationSegments
      module_function

      ORGANIZATION_COLLECTION = 'Api__OrganizationsView'
      SEGMENT_NAME = 'Segment | With Name'

      def register(agent)
        agent.customize_collection(ORGANIZATION_COLLECTION) do |collection|
          collection.add_segment(SEGMENT_NAME) do
            {
              field: 'name',
              operator: 'Present'
            }
          end
        end
      end
    end
  end
end
