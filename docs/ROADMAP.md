# Development Roadmap

Here's the possible development roadmap suggested. May change and update accordingly. If ideal, update this file after completing each project tasks and milestone.

---

## **Phase 1: The Blockchain Foundation (Hardhat & Solidity)**

**Goal:** Create the digital asset that the system will manage.
**Prerequisites:** Install Node.js, Bun, and MetaMask wallet (create a fresh "Dev" account).

**Tasks:**

1. **Setup Hardhat Environment:** Initialize a new Hardhat project with TypeScript.

2. **Develop Smart Contract (`OneCurrency.sol`):**
   - Import `@openzeppelin/contracts/token/ERC20/ERC20.sol`.
   - Import `@openzeppelin/contracts/access/AccessControl.sol` (Crucial for security).
   - Create a `MINTER_ROLE`. Only addresses with this role can mint new tokens.
   - Create a `BLACKLIST_ROLE` (to block suspicious users, as per Survey Q23).
   - Implement `mint(address to, uint256 amount)` and `burn(uint256 amount)` functions.

3. **Unit Testing:** Write tests in Hardhat to ensure:
   - Normal users _cannot_ mint tokens.
   - Only the Admin/Relayer wallet _can_ mint tokens.
   - Blacklisted addresses cannot transfer tokens.

4. **Deployment:** Deploy the contract to **Sepolia Testnet**.
   - _Output:_ Save the **Contract Address** and the **ABI** (JSON file). You will need these for the next step.

---

## **Phase 2: The Backend & Database (Bun + Hono + Neon)**

**Goal:** Build the "Centralized Bridge" that manages user data and controls the blockchain.

**Tasks:**

1. **Setup Backend Repo:** Initialize a `bun` project and install `hono` and `drizzle-orm`.

2. **Database Setup (Neon):**
   - Create a Postgres project on Neon.tech.
   - Define Schema: `Users` (ID, Email, WalletAddress, KYC_Status) and `Transactions` (StripeID, Amount, Status).
   - Run Drizzle migration to push schema to Neon.

3. **Blockchain "Relayer" Setup:**
   - Install `viem` or `ethers` in the backend.
   - Create a `.env` file containing the **Private Key** of the wallet that deployed the smart contract (the Admin).
   - Write a helper function: `mintTokensOnChain(userAddress, amount)` that uses the Private Key to call the smart contract.

4. **The "Hello World" API:**
   - Create an endpoint `POST /api/test-mint`.
   - When you hit it with Postman/Curl, it should successfully trigger a mint transaction on Sepolia.

---

## **Phase 3: The Fiat Bridge (Stripe Integration)**

**Goal:** Connect real-world money events to blockchain actions.

**Tasks:**

1. **Stripe Sandbox:** Set up a Stripe Developer account (Test Mode).

2. **Webhook Endpoint:** Create a route in Hono: `POST /api/webhooks/stripe`.

3. **Webhook Logic:**
   - Verify the Stripe signature (security check).
   - Check if the event is `checkout.session.completed`.
   - Extract the User's Email and Amount from the event data.

4. **The Integration Logic (The "Magic" Step):**
   - _Step A:_ Lookup the User in your Neon DB using the email from Stripe.
   - _Step B:_ Get their stored Wallet Address.
   - _Step C:_ Call your `mintTokensOnChain` function.

5. **End-to-End Test:**
   - Use the Stripe "Test Card" to make a fake payment.
   - Check Etherscan (Sepolia). Did the tokens appear in the destination wallet automatically?

---

## **Phase 4: The Frontend (Next.js + Web3)**

**Goal:** Build the user-friendly interface.

**Tasks:**

1. **Setup Next.js:** Initialize with Tailwind CSS and `shadcn/ui`.

2. **Web3 Integration:**
   - Install `wagmi` and `@tanstack/react-query`.
   - Build the **"Connect Wallet"** button.

3. **Dashboard UI:**
   - Fetch the user's ETH and OneCurrency Balance using `useReadContract`.
   - Display Transaction History (fetch from your Backend API, not just blockchain, for speed).

4. **Deposit UI:**
   - Create a form "Amount to Deposit".
   - On submit, call your Backend to generate a **Stripe Checkout Link**.
   - Redirect user to Stripe.

5. **Compliance UI (KYC Simulation):**
   - Create a "Profile" page.
   - Add a toggle: "Verify Identity."
   - When toggled on, update the `KYC_Status` in the Neon DB.
   - **Logic update:** Modify the Backend to reject deposits >$1000 if `KYC_Status` is false.

---

## **Phase 5: Deployment & Polish**

**Goal:** Make it accessible to your supervisors.

1. **Dockerize Backend:** Create a `Dockerfile` for the Bun app.
2. **Deploy Backend:** Push to **Fly.io** (or Railway).
3. **Deploy Frontend:** Push to **Vercel**.
4. **Documentation:** Write the `README.md` explaining how to run the project.
