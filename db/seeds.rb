puts 'Resetting database...'
CardClaim::MastercomClaim.delete_all
CardClaim::DisputedTransaction.delete_all
CardClaim::Claim.delete_all

Api::Transaction.delete_all
Api::Income.delete_all
Api::BankAccount.delete_all
Api::OrganizationsView.delete_all
Api::CsOrganization.delete_all

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

puts 'Creating cs_organizations...'
Api::CsOrganization.create!(organization_id: org1.id, vip: true)
Api::CsOrganization.create!(organization_id: org2.id, vip: false)

puts 'Creating incomes...'
income1 = Api::Income.create!(bank_account: account1, amount: 1500)
income2 = Api::Income.create!(bank_account: account2, amount: 2300)
income3 = Api::Income.create!(bank_account: account1, amount: 850)

puts 'Creating transactions (linked to incomes)...'
tx1 = Api::Transaction.create!(bank_account: account1, subject: income1)
tx2 = Api::Transaction.create!(bank_account: account2, subject: income2)
tx3 = Api::Transaction.create!(bank_account: account1, subject: income3)

puts 'Creating claims...'
claim1 = CardClaim::Claim.create!(organization_id: org1.id, type: 'FraudClaim', status: 'open', claimed_at: Date.today)
claim2 = CardClaim::Claim.create!(organization_id: org2.id, type: 'ChargebackClaim', status: 'pending', claimed_at: Date.today - 3)

puts 'Creating disputed transactions...'
disputed1 = CardClaim::DisputedTransaction.create!(claim: claim1, api_transaction: tx1)
disputed2 = CardClaim::DisputedTransaction.create!(claim: claim2, api_transaction: tx2)
disputed3 = CardClaim::DisputedTransaction.create!(claim: claim1, api_transaction: tx3)

puts 'Creating mastercom claims...'
CardClaim::MastercomClaim.create!(disputed_transaction: disputed1, name: 'Mastercom Ref A123')
CardClaim::MastercomClaim.create!(disputed_transaction: disputed2, name: 'Mastercom Ref B456')
CardClaim::MastercomClaim.create!(disputed_transaction: disputed3, name: 'Mastercom Ref C789')


puts '✅ Seed completed with multiple records!'
