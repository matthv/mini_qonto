class CreateClaims < ActiveRecord::Migration[7.0]
  def change
    create_table :claims do |t|
      t.integer :organization_id, null: false
      t.string :type
      t.string :status
      t.date :claimed_at
      t.timestamps
    end

    add_index :claims, :organization_id
  end
end
