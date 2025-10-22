class CreateAddresses < ActiveRecord::Migration[7.0]
  def change
    create_table :addresses do |t|
      t.references :addressable, polymorphic: true, null: false
      t.string :line1
      t.string :line2
      t.string :city
      t.string :postal_code
      t.string :country

      t.timestamps
    end
  end
end
