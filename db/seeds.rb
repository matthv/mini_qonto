puts 'Resetting database...'
CardClaim::MastercomClaim.delete_all
CardClaim::DisputedTransaction.delete_all
CardClaim::Claim.delete_all

Api::Transaction.delete_all
Api::Income.delete_all
Api::BankAccount.delete_all
Api::OrganizationsView.delete_all
Api::CsOrganization.delete_all

CompanyMonitoring::CompaniesView.delete_all

Biller::Subscription.delete_all
Biller::Product.delete_all

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

puts 'Creating companies_view...'
CompanyMonitoring::CompaniesView.create!(
  id: 10001,
  organization_id: org1.id,
  country_code: 'FR',
  siren: '843664726',
  creditsafe_safenumber: '46095487',
  organization_status: 'activated',
  created_at: Time.zone.parse('2025-09-01T10:08:04.791Z'),
  algorithm_check_status: nil,
  algorithm_check_desc: nil,
  algorithm_check_date: nil,
  algorithm_check_created_at: nil,
  collective_procedure_status: nil,
  collective_procedure_created_at: nil
)

CompanyMonitoring::CompaniesView.create!(
  id: 10002,
  organization_id: org2.id,
  country_code: 'US',
  siren: '987654321',
  creditsafe_safenumber: '12345678',
  organization_status: 'pending',
  created_at: Time.zone.now,
  algorithm_check_status: 'ok',
  algorithm_check_desc: 'Auto-check passed',
  algorithm_check_date: Date.today,
  algorithm_check_created_at: Time.zone.now,
  collective_procedure_status: 'none',
  collective_procedure_created_at: nil
)

puts 'Creating Biller products...'
prod1 = Biller::Product.create!(id: 1, name: 'Premium Plan')
prod2 = Biller::Product.create!(id: 2, name: 'Basic Plan')
prod3 = Biller::Product.create!(id: 3, name: 'Trial Plan')

puts 'Creating Biller subscriptions...'
Biller::Subscription.create!(
  id: 20001,
  product: prod1,
  status: 'active',
  recurrence: 'monthly',
  activated_at: Time.zone.now - 3.months,
  ended_at: nil,
  renewal_date: Date.today + 1.month,
  trial_end_date: nil,
  promotion_activation_id: 501,
  target_product_ids: [prod2.id, prod3.id],
  trial_from_product_id: prod3.id,
  trial_type: nil,
  updated_at: Time.zone.now
)

Biller::Subscription.create!(
  id: 20002,
  product: prod2,
  status: 'canceled',
  recurrence: 'yearly',
  activated_at: Time.zone.now - 2.years,
  ended_at: Time.zone.now - 5.months,
  renewal_date: nil,
  trial_end_date: nil,
  promotion_activation_id: nil,
  target_product_ids: [],
  trial_from_product_id: prod3.id,
  trial_type: 'extended',
  updated_at: Time.zone.now - 6.months
)

Biller::Subscription.create!(
  id: 20003,
  product: prod3,
  status: 'trialing',
  recurrence: 'monthly',
  activated_at: Time.zone.now - 10.days,
  ended_at: nil,
  renewal_date: Date.today + 20.days,
  trial_end_date: Date.today + 5.days,
  promotion_activation_id: 777,
  target_product_ids: [prod1.id],
  trial_from_product_id: prod1.id,
  trial_type: 'standard',
  updated_at: Time.zone.now
)


puts '✅ Seed completed with multiple records!'
