# Test Accounts Generator

This script generates test accounts and executes token trades to test the Plinko incinerator features.

## Features

- Creates multiple test wallets (default: 5)
- Funds these wallets from a source wallet
- Executes token trades (buy/sell) with 0.04 SOL each
- Uses Jupiter for token swaps
- Logs all transactions to console

## Setup

1. Copy the example environment file:
   ```
   cp test-env.example .env
   ```

2. Edit the `.env` file and add your source wallet's private key:
   ```
   TEST_SOURCE_WALLET_PRIVATE_KEY=your_private_key_here
   ```
   
   This wallet must have enough SOL to fund the test wallets.

3. Install dependencies if you haven't already:
   ```
   cd src/server
   npm install
   ```

## Usage

Run the script with:

```
cd src/server
npx ts-node src/scripts/generateTestAccounts.ts
```

## Configuration

You can adjust these values in the script:

- `NUM_ACCOUNTS`: Number of test accounts to generate (default: 5)
- `SOL_AMOUNT_PER_TRADE`: Amount of SOL to use per trade (default: 0.04)
- `TEST_TOKEN_MINTS`: Array of token mint addresses to use for trades

## Output

The script will:

1. Create wallet files in the `test-wallets` directory
2. Log all transactions to the console
3. Execute trades for each wallet with randomly selected tokens

## Notes

- Each wallet will execute multiple trades (default: 3 per wallet)
- Wallets are saved to disk and reused if the script is run again
- The script uses the Jupiter API for token swaps 