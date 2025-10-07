require_relative 'actions/actions'
<<<<<<< Updated upstream
require_relative 'charts/charts'
=======
require_relative 'hooks/hooks'
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
      ForestAdminRails::Charts.register(@create_agent)
=======
      ForestAdminRails::Hooks.register(@create_agent)
>>>>>>> Stashed changes
    end
  end
end
