# This file contains code to create and configure your Forest Admin agent
# You can customize this file according to your needs
#
# For more information about customizing your agent:
# - Adding datasources: https://docs.forestadmin.com/developer-guide-agents-ruby
# - Customizing collections: https://docs.forestadmin.com/developer-guide-agents-ruby/agent-customization

module ForestAdminRpcAgent
  class CreateRpcAgent
    def self.setup!
      datasource = ForestAdminDatasourceActiveRecord::Datasource.new(
        Rails.env.to_sym,
        support_polymorphic_relations: true,
      )

      @agent = ForestAdminRpcAgent::Agent.instance.add_datasource(datasource)


      @agent.build
    end
  end
end
