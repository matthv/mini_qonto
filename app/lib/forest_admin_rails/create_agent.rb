require_relative 'actions/actions'
require_relative 'charts/charts'
require_relative 'hooks/hooks'

module ForestAdminRails
  class CreateAgent
    def self.setup!
      database_configuration = Rails.configuration.database_configuration
      datasource = ForestAdminDatasourceActiveRecord::Datasource.new(database_configuration[Rails.env]['api'])

      @create_agent = ForestAdminAgent::Builder::AgentFactory.instance.add_datasource(datasource)
      customize
      @create_agent.build
    end

    def self.customize
      ForestAdminRails::Actions.register(@create_agent)
      ForestAdminRails::Hooks.register(@create_agent)
      ForestAdminRails::Charts.register(@create_agent)
    end
  end
end
