class CreateProducts < ActiveRecord::Migration[7.0]
  def change
    create_table :products, id: false do |t|
      t.primary_key :id
      t.string :name, null: false

      t.timestamps
    end
  end
end