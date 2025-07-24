class CreateBankAccounts < ActiveRecord::Migration[7.0]
  def change
    create_table :bank_accounts do |t|
      t.references :subject, polymorphic: true, null: true
      t.references :organization, null: false, foreign_key: true
      t.string :iban

      t.timestamps
    end
  end
end
