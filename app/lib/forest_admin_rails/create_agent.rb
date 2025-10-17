require_relative 'actions/actions'
require_relative 'charts/charts'
require_relative 'hooks/hooks'
require_relative 'segments/segments'
require_relative 'fields/fields'
require_relative 'validations/validations'
require_relative 'relationships'

module ForestAdminRails
  class CreateAgent
    def self.setup!
      database_configuration = Rails.configuration.database_configuration
      datasource = ForestAdminDatasourceActiveRecord::Datasource.new(
        database_configuration[Rails.env]['api'],
        # TODO: change the doc because api should be the key and main_database the value
        # the value represent the name displayed in the UI
        live_query_connections: {
          'main_database' => 'api'
        }
      )

      @create_agent = ForestAdminAgent::Builder::AgentFactory.instance.add_datasource(datasource)
      customize
      @create_agent.build
    end

    def self.customize
      ForestAdminRails::Fields.register(@create_agent)
      ForestAdminRails::Actions.register(@create_agent)
      ForestAdminRails::Hooks.register(@create_agent)
      ForestAdminRails::Charts.register(@create_agent)
      ForestAdminRails::Segments.register(@create_agent)
      ForestAdminRails::Validations.register(@create_agent)
      ForestAdminRails::Relationships.register(@create_agent)
    end
  end
end
