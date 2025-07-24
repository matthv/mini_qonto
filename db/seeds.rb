puts 'Resetting database...'
Api::Transaction.delete_all
Api::Income.delete_all
Api::BankAccount.delete_all
Api::OrganizationsView.delete_all

puts 'Creating organizations...'
org1 = Api::OrganizationsView.create!(name: 'Forest Admin Inc.')
org2 = Api::OrganizationsView.create!(name: 'ACME Corp.')

puts 'Creating bank accounts...'
account1 = Api::BankAccount.create!(
  organizations_view: org1,
  iban: 'FR76 3000 6000 0112 3456 7890 189'
)

account2 = Api::BankAccount.create!(
  organizations_view: org2,
  iban: 'FR76 3000 6000 0999 9999 9999 999'
)

puts 'Creating incomes...'
income1 = Api::Income.create!(bank_account: account1, amount: 1500)
income2 = Api::Income.create!(bank_account: account2, amount: 2300)
income3 = Api::Income.create!(bank_account: account1, amount: 850)

puts 'Creating transactions (linked to incomes)...'
Api::Transaction.create!(bank_account: account1, subject: income1)
Api::Transaction.create!(bank_account: account2, subject: income2)
Api::Transaction.create!(bank_account: account1, subject: income3)

puts '✅ Seed completed with multiple records!'
