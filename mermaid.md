classDiagram
direction TB
%% ═══════════════════════════════════════════════════════════════
%% LAYER 1: API / ROUTER (oRPC Procedures)
%% ═══════════════════════════════════════════════════════════════
namespace API_Layer {
class AppRouter {
+DepositProcedures deposits
+UserProcedures users
+KycProcedures users.kyc
+WithdrawalProcedures withdrawals
+TransferProcedures transfers
+AdminKycProcedures admin.kyc
+AdminBlacklistProcedures admin.blacklist
+AdminTransactionProcedures admin.transactions
+AdminUserProcedures admin.users
+AdminMetricsProcedures admin.metrics
+AdminAuditLogProcedures admin.auditLogs
}
class DepositProcedures {
+testMint(input) Result~{txHash}~
+checkout(input) Result~{checkoutUrl}~
+getHistory() DepositHistoryItem[]
}
class UserProcedures {
+getPrimaryWallet() WalletInfo
+findRecipient(input) Result~{name}~
+getMyRoles() string[]
}
class KycProcedures {
+submitKyc(input) void
+simulateKyc() void
+getKycUploadUrl(input) Result~{url, fields, publicId}~
+getLatestKycSubmission() KycSubmission
}
class WithdrawalProcedures {
+initiate(input) Result~{withdrawalId}~
+getHistory() Withdrawal[]
}
class TransferProcedures {
+send(input) Result~{transferId, txHash}~
+getHistory() Transfer[]
}
class AdminKycProcedures {
+listSubmissions(input) Result~{items[], total, page, pageSize}~
+getSubmission(input) KycSubmissionDetail
+approve(input) void
+reject(input) void
}
class AdminBlacklistProcedures {
+list() BlacklistedAddress[]
+add(input) void
+remove(input) void
+seize(input) Result~{txHash}~
}
class AdminTransactionProcedures {
+list(input) Result~{items[], total, page, pageSize}~
+get(input) TransactionDetail
}
class AdminUserProcedures {
+list(input) Result~{items[], total, page, pageSize}~
+get(input) UserDetail
+updateDepositLimit(input) void
+suspend(input) void
+restore(input) void
}
class AdminMetricsProcedures {
+getSummary() MetricsSummary
}
class AdminAuditLogProcedures {
+list(input) Result~{items[], total, page, pageSize}~
}
}
%% ═══════════════════════════════════════════════════════════════
%% LAYER 2: BUSINESS LOGIC (Services)
%% ═══════════════════════════════════════════════════════════════
namespace Business_Logic_Layer {
class DepositService {
-Database db
-DepositRepository depositRepo
-UserRepository userRepo
-WalletRepository walletRepo
+testMint(address, amountWei) ResultAsync~{txHash}~
+createCheckoutSession(userId, amountCents, walletId) ResultAsync~{checkoutUrl}~
+processStripeWebhook(event) ResultAsync~void~
+getHistory(userId) ResultAsync~DepositHistoryItem[]~
}
class WithdrawalService {
-Database db
-WithdrawalRepository withdrawalRepo
-UserRepository userRepo
-WalletRepository walletRepo
+initiate(userId, amountCents, bankDetails) ResultAsync~{withdrawalId}~
+processStripePayout(webhookEvent) ResultAsync~void~
+getHistory(userId) ResultAsync~Withdrawal[]~
}
class TransferService {
-Database db
-TransferRepository transferRepo
-UserRepository userRepo
-WalletRepository walletRepo
+send(userId, recipientEmail, amountCents, note) ResultAsync~{transferId, txHash}~
+getHistory(userId) ResultAsync~Transfer[]~
}
class UserService {
-Database db
-UserRepository userRepo
-WalletRepository walletRepo
-KycRepository kycRepo
+submitKyc(userId, data) ResultAsync~void~
+getLatestKycSubmission(userId) ResultAsync~KycSubmission|null~
+getPrimaryWallet(userId) ResultAsync~WalletInfo~
+findRecipientByEmail(email) ResultAsync~User|null~
+getMyRoles(userId) ResultAsync~string[]~
}
class WalletService {
-Database db
-WalletRepository walletRepo
+provisionCustodialWallet(userId) ResultAsync~Wallet~
+getUserPrimaryWallet(userId) ResultAsync~PrimaryWallet~
+generateKeypair() {privateKey, address}
+encryptPrivateKey(privateKey) string
}
class KycAdminService {
-Database db
-KycRepository kycRepo
-UserRepository userRepo
+listSubmissions(filters) ResultAsync~KycListItem[]~
+getSubmission(publicId) ResultAsync~KycSubmissionDetail~
+approve(submissionId, officerId) ResultAsync~void~
+reject(submissionId, officerId, reason) ResultAsync~void~
}
class BlacklistService {
-Database db
-BlacklistRepository blacklistRepo
-BlockchainService blockchainSvc
+addAddress(address, reason, addedBy) ResultAsync~void~
+removeAddress(id) ResultAsync~void~
+seizeTokens(address, adminId) ResultAsync~{txHash}~
}
class AuditService {
-Database db
-AuditLogRepository auditLogRepo
+logAction(action, actorId, entityType, entityId, oldValues, newValues, metadata) ResultAsync~void~
+getLogs(filters) ResultAsync~AuditLog[]~
}
class TransactionAdminService {
-Database db
-DepositRepository depositRepo
-WithdrawalRepository withdrawalRepo
-TransferRepository transferRepo
+listTransactions(filters) ResultAsync~TransactionListItem[]~
+getTransaction(id) ResultAsync~TransactionDetail~
+exportToCSV(filters) ResultAsync~string~
}
class BlockchainService {
-PublicClient viemClient
-WalletClient walletClient
-string contractAddress
-string relayerPrivateKey
+mintTokens(toAddress, amountWei) ResultAsync~string~
+burnTokens(encryptedKey, amountWei) ResultAsync~string~
+transferTokens(encryptedKey, toAddress, amountWei) ResultAsync~string~
+getBalance(address) ResultAsync~bigint~
+getTransactionReceipt(txHash) ResultAsync~TransactionReceipt~
}
class EmailService {
<<External Adapter>>
-Resend resend
-string emailFrom
-string dashboardUrl
+sendPasswordResetEmail(to, url) Promise~void~
+sendDepositReceivedEmail(to, name, amountCents, depositId) Promise~void~
+sendDepositFailedEmail(to, name, amountCents, depositId) Promise~void~
+sendWithdrawalProcessedEmail(to, name, amountCents, withdrawalId) Promise~void~
+sendWithdrawalFailedEmail(to, name, amountCents, withdrawalId) Promise~void~
+sendTransferSentEmail(sender, recipient, amountCents, transferId) Promise~void~
+sendTransferReceivedEmail(sender, recipient, amountCents, transferId) Promise~void~
}
class StripeService {
<<External Adapter>>
-Stripe stripe
-string webhookSecret
+createCheckoutSession(amount, metadata) Promise~Session~
+constructEvent(payload, signature, secret) Event
+createPayout(amount, destination) Promise~Payout~
+createTransfer(amount, destination) Promise~Transfer~
}
class R2Service {
<<External Adapter>>
-S3Client r2Client
-string bucketName
+getPresignedUploadUrl(key, contentType, expiry) Promise~{url, fields}~
+getPresignedDownloadUrl(key, expiry) Promise~string~
+deleteObject(key) Promise~void~
}
}
%% ═══════════════════════════════════════════════════════════════
%% LAYER 3: DATA ACCESS (Repositories)
%% ═══════════════════════════════════════════════════════════════
namespace Data_Access_Layer {
class BaseRepository {
#Database db
+constructor(database Database)
}
class UserRepository {
+findById(id bigint) ResultAsync~User|null~
+findByEmail(email string) ResultAsync~User|null~
+findByPublicId(publicId string) ResultAsync~User|null~
+findForAdminList(filters) ResultAsync~AdminUserListItem[]~
+updateDepositLimit(userId, limit, reason) ResultAsync~void~
+softDelete(userId, reason) ResultAsync~void~
+restore(userId) ResultAsync~void~
}
class DepositRepository {
+findByUserId(userId bigint) ResultAsync~DepositHistoryItem[]~
+findByPublicId(publicId string) ResultAsync~Deposit|null~
+create(data NewDeposit) ResultAsync~Deposit~
+updateStatus(id bigint, statusId int) ResultAsync~void~
}
class WithdrawalRepository {
+findByUserId(userId bigint) ResultAsync~Withdrawal[]~
+findByPublicId(publicId string) ResultAsync~Withdrawal|null~
+create(data) ResultAsync~Withdrawal~
+updateStatus(id, statusId) ResultAsync~void~
}
class TransferRepository {
+findByUserId(userId bigint) ResultAsync~Transfer[]~
+findByPublicId(publicId string) ResultAsync~Transfer|null~
+create(data) ResultAsync~Transfer~
+updateStatus(id, statusId, txHash) ResultAsync~void~
}
class WalletRepository {
+findByUserId(userId bigint) ResultAsync~Wallet[]~
+findPrimaryByUserId(userId bigint) ResultAsync~Wallet|null~
+findByAddress(address string) ResultAsync~Wallet|null~
+create(data) ResultAsync~Wallet~
+demotePrimaryWallet(userId, networkId) ResultAsync~void~
}
class KycRepository {
+findByUserId(userId bigint) ResultAsync~KycSubmission|null~
+findByPublicId(publicId string) ResultAsync~KycSubmission|null~
+create(data) ResultAsync~KycSubmission~
+updateStatus(id, statusId) ResultAsync~void~
+listForAdmin(filters) ResultAsync~KycListItem[]~
}
class BlacklistRepository {
+findByAddress(address string, networkId int) ResultAsync~BlacklistedAddress|null~
+findAll() ResultAsync~BlacklistedAddress[]~
+create(data) ResultAsync~BlacklistedAddress~
+delete(id bigint) ResultAsync~void~
}
class BlockchainTransactionRepository {
+create(data) ResultAsync~BlockchainTransaction~
+findByTxHash(txHash string) ResultAsync~BlockchainTransaction|null~
}
class AuditLogRepository {
+create(data) ResultAsync~AuditLog~
+findAll(filters) ResultAsync~AuditLog[]~
}
}
%% ═══════════════════════════════════════════════════════════════
%% LAYER 4: DOMAIN ENTITIES (Drizzle ORM)
%% ═══════════════════════════════════════════════════════════════
namespace Domain_Layer {
class User <<Entity>> {
+bigint id {PK}
+UUID publicId
+string name
+string email {unique}
+boolean emailVerified
+boolean twoFactorEnabled
+string password {bcrypt hash}
+integer kycStatusId {FK}
+Date kycVerifiedAt
+bigint depositLimitCents
+string stripeConnectAccountId
+Date createdAt
+Date updatedAt
+Date deletedAt {soft delete}
}
class Wallet <<Entity>> {
+bigint id {PK}
+UUID publicId
+bigint userId {FK}
+integer networkId {FK}
+string address {0x...}
+string label
+boolean isPrimary
+string walletType {CUSTODIAL|EXTERNAL}
+string providerName
-string encryptedPrivateKey
+Date createdAt
+Date deletedAt
}
class Deposit <<Entity>> {
+bigint id {PK}
+UUID publicId
+bigint userId {FK}
+bigint walletId {FK}
+integer statusId {FK}
+string stripeSessionId {unique}
+string stripePaymentIntentId
+string stripeCustomerId
+bigint amountCents
+bigint feeCents
+bigint netAmountCents {generated}
+numeric tokenAmount
+numeric exchangeRate
+bigint blockchainTxId {FK}
+string idempotencyKey {unique}
+inet ipAddress
+string userAgent
+Date createdAt
+Date completedAt
}
class Withdrawal <<Entity>> {
+bigint id {PK}
+UUID publicId
+bigint userId {FK}
+bigint walletId {FK}
+integer statusId {FK}
+numeric tokenAmount
+bigint fiatAmountCents
+bigint feeCents
+bigint netAmountCents {generated}
+numeric exchangeRate
+string payoutMethod
+string payoutReference
+bigint blockchainTxId {FK}
+string stripeTransferId {unique}
+string stripePayoutId {unique}
+Date createdAt
+Date completedAt
}
class Transfer <<Entity>> {
+bigint id {PK}
+UUID publicId
+bigint senderId {FK}
+bigint recipientId {FK}
+bigint amountCents
+string amountWei
+string txHash
+string note
+integer statusId {FK}
+Date createdAt
+Date updatedAt
}
class KycSubmission <<Entity>> {
+bigint id {PK}
+UUID publicId
+bigint userId {FK}
+integer kycStatusId {FK}
+JSON personalInfo
+string documentUrl
+string selfieUrl
+Date submittedAt
+Date verifiedAt
+bigint verifiedBy
+Date rejectedAt
+bigint rejectedBy
+string rejectionReason
}
class BlacklistedAddress <<Entity>> {
+bigint id {PK}
+UUID publicId
+string address {unique}
+integer networkId {FK}
+string reason
+bigint addedBy {FK}
+Date addedAt
+Date seizedAt
+bigint seizedBy
}
class BlockchainTransaction <<Entity>> {
+bigint id {PK}
+UUID publicId
+string txHash {unique}
+integer networkId {FK}
+integer typeId {FK}
+string fromAddress
+string toAddress
+string amountWei
+integer statusId {FK}
+Date createdAt
}
class AuditLog <<Entity>> {
+bigint id {PK}
+UUID publicId
+bigint userId {FK}
+string action
+string entityType
+string entityId
+JSON oldValues
+JSON newValues
+JSON metadata
+Date createdAt
}
class KycStatus <<Lookup>> {
+integer id {PK}
+string name {unique}
+string description
}
class TransactionStatus <<Lookup>> {
+integer id {PK}
+string name {unique}
+string description
}
class TransactionType <<Lookup>> {
+integer id {PK}
+string name {unique}
+string description
}
class Network <<Lookup>> {
+integer id {PK}
+UUID publicId
+string name
+bigint chainId
+string rpcUrl
+string explorerUrl
+string contractAddress
+boolean isTestnet
+boolean isActive
}
class Role <<Lookup>> {
+integer id {PK}
+UUID publicId
+string name {unique}
+string[] permissions
}
class UserRole <<Join>> {
+bigint id {PK}
+bigint userId {FK}
+integer roleId {FK}
}
}
%% ═══════════════════════════════════════════════════════════════
%% LAYER 5: SMART CONTRACT (Solidity)
%% ═══════════════════════════════════════════════════════════════
namespace Web3_Layer {
class OneCurrency <<ERC20 Contract>> {
+uint256 x {totalSupply}
+string name()
+string symbol()
+uint8 decimals() {18}
+uint256 balanceOf(account)
+bool transfer(to, amount)
+bool approve(spender, amount)
+bool transferFrom(from, to, amount)
+mint(to, amount)
+burn(amount)
+burnFrom(account, amount)
+pause()
+unpause()
+blacklistAccount(account)
+unblacklistAccount(account)
+seizeTokens(from, treasury, amount)
--
-\_mint(address, uint256)
-\_burn(address, uint256)
-\_beforeTokenTransfer(from, to, amount)
--
+bytes32 DEFAULT_ADMIN_ROLE
+bytes32 MINTER_ROLE
+bytes32 PAUSER_ROLE
+bytes32 BLACKLIST_ROLE
+bytes32 SEIZE_ROLE
--
+AccountBlacklisted(address)
+AccountUnblacklisted(address)
+TokensMinted(minter, to, amount, newTotalSupply)
+TokensSeized(from, to, amount)
}
}
%% ═══════════════════════════════════════════════════════════════
%% LAYER 6: AUTHENTICATION (Better-Auth)
%% ═══════════════════════════════════════════════════════════════
namespace Auth_Layer {
class AuthService <<External>> {
+createUser(email, password, name) User
+validateCredentials(email, password) Session|null
+generateSession(userId) Session
+invalidateSession(sessionId) void
+generateVerificationToken(email) string
+verifyToken(token) boolean
+enableTwoFactor(userId, secret) void
+verifyTwoFactor(userId, code) boolean
}
class Session <<Entity>> {
+string id {PK}
+bigint userId {FK}
+string token {unique}
+Date expiresAt
+Date createdAt
+string ipAddress
+string userAgent
}
class Account <<Entity>> {
+string id {PK}
+bigint userId {FK}
+string accountId
+string providerId
+string password
+Date createdAt
+Date updatedAt
}
class TwoFactor <<Entity>> {
+bigint id {PK}
+bigint userId {FK} {unique}
+string secret
+string[] backupCodes
+boolean enabled
+Date createdAt
}
}
%% ═══════════════════════════════════════════════════════════════
%% INHERITANCE: Repository Layer
%% ═══════════════════════════════════════════════════════════════
BaseRepository <|-- UserRepository
BaseRepository <|-- DepositRepository
BaseRepository <|-- WithdrawalRepository
BaseRepository <|-- TransferRepository
BaseRepository <|-- WalletRepository
BaseRepository <|-- KycRepository
BaseRepository <|-- BlacklistRepository
BaseRepository <|-- BlockchainTransactionRepository
BaseRepository <|-- AuditLogRepository
%% ═══════════════════════════════════════════════════════════════
%% API → SERVICE DEPENDENCIES
%% ═══════════════════════════════════════════════════════════════
AppRouter _-- DepositProcedures
AppRouter _-- UserProcedures
AppRouter _-- KycProcedures
AppRouter _-- WithdrawalProcedures
AppRouter _-- TransferProcedures
AppRouter _-- AdminKycProcedures
AppRouter _-- AdminBlacklistProcedures
AppRouter _-- AdminTransactionProcedures
AppRouter _-- AdminUserProcedures
AppRouter _-- AdminMetricsProcedures
AppRouter _-- AdminAuditLogProcedures
DepositProcedures ..> DepositService : uses
UserProcedures ..> UserService : uses
KycProcedures ..> UserService : uses
WithdrawalProcedures ..> WithdrawalService : uses
TransferProcedures ..> TransferService : uses
AdminKycProcedures ..> KycAdminService : uses
AdminBlacklistProcedures ..> BlacklistService : uses
AdminTransactionProcedures ..> TransactionAdminService : uses
AdminUserProcedures ..> UserService : uses
AdminAuditLogProcedures ..> AuditService : uses
%% ═══════════════════════════════════════════════════════════════
%% SERVICE → REPOSITORY & EXTERNAL DEPENDENCIES
%% ═══════════════════════════════════════════════════════════════
DepositService ..> DepositRepository
DepositService ..> UserRepository
DepositService ..> WalletRepository
DepositService ..> BlockchainService
DepositService ..> StripeService
DepositService ..> EmailService
WithdrawalService ..> WithdrawalRepository
WithdrawalService ..> UserRepository
WithdrawalService ..> WalletRepository
WithdrawalService ..> BlockchainService
WithdrawalService ..> StripeService
WithdrawalService ..> EmailService
TransferService ..> TransferRepository
TransferService ..> UserRepository
TransferService ..> WalletRepository
TransferService ..> BlockchainService
TransferService ..> EmailService
UserService ..> UserRepository
UserService ..> WalletRepository
UserService ..> KycRepository
UserService ..> R2Service
WalletService ..> WalletRepository
KycAdminService ..> KycRepository
KycAdminService ..> UserRepository
BlacklistService ..> BlacklistRepository
BlacklistService ..> BlockchainService
AuditService ..> AuditLogRepository
TransactionAdminService ..> DepositRepository
TransactionAdminService ..> WithdrawalRepository
TransactionAdminService ..> TransferRepository
TransactionAdminService ..> UserRepository
%% ═══════════════════════════════════════════════════════════════
%% SERVICE → BLOCKCHAIN CONTRACT
%% ═══════════════════════════════════════════════════════════════
BlockchainService ..> OneCurrency : RPC calls
%% ═══════════════════════════════════════════════════════════════
%% REPOSITORY → DOMAIN (manages)
%% ═══════════════════════════════════════════════════════════════
UserRepository ..> User : manages
DepositRepository ..> Deposit : manages
WithdrawalRepository ..> Withdrawal : manages
TransferRepository ..> Transfer : manages
WalletRepository ..> Wallet : manages
KycRepository ..> KycSubmission : manages
BlacklistRepository ..> BlacklistedAddress : manages
BlockchainTransactionRepository ..> BlockchainTransaction : manages
AuditLogRepository ..> AuditLog : manages
%% ═══════════════════════════════════════════════════════════════
%% DOMAIN ENTITY RELATIONSHIPS
%% ═══════════════════════════════════════════════════════════════
User "1" _-- "0.._" Wallet : owns
User "1" _-- "0.._" Deposit : initiates
User "1" _-- "0.._" Withdrawal : requests
User "1" _-- "0..1" KycSubmission : submits
User "1" _-- "0.._" Transfer : sends
User "1" _-- "0.._" Transfer : receives
User "1" _-- "0.._" AuditLog : triggers
User "1" -- "1.._" UserRole : assigned
Role "1" -- "0.._" UserRole : grants
Wallet "1" _-- "0.._" Deposit : receives
Wallet "1" _-- "0.._" Withdrawal : source
Deposit "0..1" o-- "1" BlockchainTransaction : linked to
Withdrawal "0..1" o-- "1" BlockchainTransaction : linked to
Transfer "0..1" o-- "1" BlockchainTransaction : linked to
KycSubmission }o--|| KycStatus : status
Deposit }o--|| TransactionStatus : status
Withdrawal }o--|| TransactionStatus : status
Transfer }o--|| TransactionStatus : status
BlockchainTransaction }o--|| TransactionType : type
BlockchainTransaction }o--|| Network : on
Wallet }o--|| Network : belongs to
BlacklistedAddress }o--|| Network : belongs to
%% ═══════════════════════════════════════════════════════════════
%% AUTH LAYER RELATIONSHIPS
%% ═══════════════════════════════════════════════════════════════
AuthService ..> User : creates
AuthService ..> Session : manages
AuthService ..> TwoFactor : manages
User "1" _-- "0.._" Session : has
User "1" _-- "0..1" TwoFactor : has
User "1" _-- "0..\*" Account : has
