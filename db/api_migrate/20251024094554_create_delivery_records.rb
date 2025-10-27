class CreateDeliveryRecords < ActiveRecord::Migration[7.0]
  def change
    create_table :delivery_records do |t|
      t.string :email
      t.string :to, null: false

      t.timestamps
    end

    add_index :delivery_records, :to
  end
end
