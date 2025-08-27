class CreateDisputedTransactions < ActiveRecord::Migration[7.0]
  def change
    create_table :disputed_transactions do |t|
      t.references :claim, null: false, foreign_key: true
      t.integer :api_transaction_id, null: false

      t.timestamps
    end

    add_index :disputed_transactions, :api_transaction_id
  end
end
