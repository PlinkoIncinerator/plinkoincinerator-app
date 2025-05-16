# PlinkoIncinerator 🔥

A Solana-based application that helps users clean up their wallets by burning empty token accounts and recover SOL, then gamble their earnings with a provably fair Plinko game.

## Project Overview

PlinkoIncinerator combines two functionalities:

1. **Token Account Incinerator**: Identifies and closes empty or low-value token accounts in Solana wallets, recovering locked SOL.
2. **Plinko Gambling Game**: Allows users to gamble their recovered SOL in a provably fair Plinko game with up to 25x multipliers.

### Key Features

- Clean up wallet by burning empty token accounts
- Recover SOL from closed accounts
- Provably fair gambling implementation
- Real-time gameplay with WebSockets
- Fully on-chain transactions for token burning
- Comprehensive statistics tracking
- Referral system with rewards

## Technology Stack

- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Node.js, Express, Socket.io
- **Database**: PostgreSQL
- **Blockchain**: Solana
- **Deployment**: Docker

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js v16+ (for local development)
- Solana wallet with some SOL for testing

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/plinko-incinerator.git
   cd plinko-incinerator
   ```

2. Create environment files:
   
   For the server (create `src/server/.env`):
   ```
   # Database configuration
   POSTGRES_USER=root
   POSTGRES_PASSWORD=root
   POSTGRES_HOST=plinkoincineratormdb
   POSTGRES_DB=plinkoincinerator
   POSTGRES_PORT=5432
   
   # Solana configuration
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   SOLANA_FALLBACK_RPC_URL_1=https://solana-mainnet.rpc.extrnode.com
   SOLANA_FALLBACK_RPC_URL_2=https://rpc.ankr.com/solana
   
   # Wallet configuration (required for processing withdrawals)
   FEE_WALLET_PRIVATE_KEY=your_private_key_here
   
   # Token configuration
   PLINC_TOKEN_ADDRESS=49Jy3P5J41zkcCgaveKXQfeUU3zNCHCSEEypkJTrpump
   
   # Optional: Google Cloud Storage for sharing images
   GCP_PROJECT_ID=your_gcp_project_id
   GCP_CLIENT_EMAIL=your_service_account_email
   GCP_PRIVATE_KEY=your_private_key
   GCP_BUCKET_NAME=plinko-incinerator-shares
   
   # API configuration
   PORT=3333
   PUBLIC_API_URL=http://localhost:3333
   ```

   For the frontend (create `src/.env`):
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3333
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3333
   NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
   NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   NEXT_PUBLIC_ASSET_PREFIX=
   ```

3. Start the application with Docker Compose:
   ```bash
   docker compose up -f docker-compose-local.yml
   ```

   This will start the PostgreSQL database. The application itself is commented out in the docker-compose-local.yml file for development purposes.

4. For development, start the frontend and backend separately:
   
   Backend:
   ```bash
   cd src/server
   npm install
   npm run dev
   ```
   
   Frontend:
   ```bash
   cd src
   npm install
   npm run dev
   ```

## Environment Variables

### Required Variables

| Variable | Description |
|----------|-------------|
| `POSTGRES_USER` | PostgreSQL database username |
| `POSTGRES_PASSWORD` | PostgreSQL database password |
| `POSTGRES_HOST` | PostgreSQL database host (use 'plinkoincineratormdb' for Docker) |
| `POSTGRES_DB` | PostgreSQL database name |
| `POSTGRES_PORT` | PostgreSQL database port (default: 5432) |
| `SOLANA_RPC_URL` | Primary Solana RPC URL |
| `FEE_WALLET_PRIVATE_KEY` | Private key for the wallet processing fees and withdrawals |

### Optional Variables

| Variable | Description |
|----------|-------------|
| `SOLANA_FALLBACK_RPC_URL_1` | First fallback Solana RPC URL |
| `SOLANA_FALLBACK_RPC_URL_2` | Second fallback Solana RPC URL |
| `PLINC_TOKEN_ADDRESS` | Address of the PLINC token |
| `GCP_PROJECT_ID` | Google Cloud Project ID for image sharing |
| `GCP_CLIENT_EMAIL` | Google Cloud service account email |
| `GCP_PRIVATE_KEY` | Google Cloud service account private key |
| `GCP_BUCKET_NAME` | Google Cloud Storage bucket name |
| `PORT` | Server port (default: 3333) |
| `PUBLIC_API_URL` | Public URL for the API |
| `NEXT_PUBLIC_API_URL` | Frontend API URL |
| `NEXT_PUBLIC_SOCKET_URL` | Frontend WebSocket URL |
| `NEXT_PUBLIC_SOLANA_NETWORK` | Solana network (mainnet-beta, devnet, etc.) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Frontend Solana RPC URL |
| `NEXT_PUBLIC_ASSET_PREFIX` | Asset prefix for Next.js (optional) |

## Production Deployment

For production deployment, use the main docker-compose file:

```bash
docker compose up -d
```

This will build and run both the database and application containers.

## License

This project is proprietary and not licensed for public use.

## Support

For any questions or issues, please reach out to the development team.
