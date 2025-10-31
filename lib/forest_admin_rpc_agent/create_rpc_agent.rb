# This file contains code to create and configure your Forest Admin agent
# You can customize this file according to your needs
#
# For more information about customizing your agent:
# - Adding datasources: https://docs.forestadmin.com/developer-guide-agents-ruby
# - Customizing collections: https://docs.forestadmin.com/developer-guide-agents-ruby/agent-customization

module ForestAdminRpcAgent
  class CreateRpcAgent
    def self.setup!
      # Get the agent instance
      @agent = ForestAdminRpcAgent::Agent.instance

      # Add your datasources here
      # Example:
      # datasource = ForestAdminDatasourceActiveRecord::Datasource.new
      # @agent.add_datasource(datasource)

      # Customize your collections (optional)
      # Example:
      # @agent.customize_collection('users') do |collection|
      #   collection.add_field('full_name', column_type: 'String') do |context|
      #     "#{context.record['first_name']} #{context.record['last_name']}"
      #   end
      # end

      # Build the agent (required)
      @agent.build
    end
  end
end
