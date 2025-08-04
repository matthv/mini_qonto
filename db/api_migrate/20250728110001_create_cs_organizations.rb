class CreateCsOrganizations < ActiveRecord::Migration[7.0]
  def change
    create_table :cs_organizations do |t|
      t.integer :organization_id, null: false
      t.boolean :vip, default: false
      t.timestamps
    end

    add_index :cs_organizations, :organization_id, unique: true
  end
end
