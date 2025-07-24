class CreateTransactions < ActiveRecord::Migration[7.0]
  def change
    create_table :transactions do |t|
      t.references :bank_account, null: false, foreign_key: true
      t.references :subject, polymorphic: true, null: false
      t.timestamps
    end
  end
end
