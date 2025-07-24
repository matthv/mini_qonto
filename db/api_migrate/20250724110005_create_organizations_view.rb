class CreateOrganizationsView < ActiveRecord::Migration[7.0]
  def up
    execute <<-SQL
      CREATE VIEW organizations_views AS
        SELECT
          organizations.*
        FROM organizations;
    SQL
  end

  def down
    execute "DROP VIEW IF EXISTS organizations_views;"
  end
end
