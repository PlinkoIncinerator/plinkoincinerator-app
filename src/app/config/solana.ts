import { Connection, Keypair, PublicKey } from "@solana/web3.js";

interface SolanaWalletConfig {
  publicKey: PublicKey | null;
  payer: Keypair | null;
}

// The wallet that will receive the 5% fee
const FEE_WALLET = process.env.NEXT_PUBLIC_FEE_WALLET || "DZYKY8RqPZKFM78SF2FaT1k6UqiPfSAtYVx2D4bV8v8E";
const FEE_PERCENTAGE = 0.021; // 5%

// Helius RPC URL with API key

const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Validate that the wallet address is in the correct format
let feeWalletPublicKey: PublicKey;
try {
  feeWalletPublicKey = new PublicKey(FEE_WALLET);
} catch (error) {
  console.error("Invalid fee wallet address, using default address instead:", error);
  // Use a default valid Solana address
  feeWalletPublicKey = new PublicKey("DZYKY8RqPZKFM78SF2FaT1k6UqiPfSAtYVx2D4bV8v8E");
}

console.log("SOLANA RPC URL:", HELIUS_RPC_URL);

export const Config = {
  connection: new Connection(
    HELIUS_RPC_URL,
    {
      commitment: "confirmed",
      disableRetryOnRateLimit: true,
      httpHeaders: {
        "Content-Type": "application/json",
      },
    }
  ),
  solWallet: {
    publicKey: null as PublicKey | null,
    payer: null as Keypair | null,
  } as SolanaWalletConfig,
  FEE_WALLET: feeWalletPublicKey,
  FEE_PERCENTAGE,
  
  // Set the Solana wallet connection
  setWalletConnection(publicKey: PublicKey, payer?: Keypair) {
    this.solWallet.publicKey = publicKey;
    if (payer) {
      this.solWallet.payer = payer;
    }
  },
  
  // Set the fee wallet
  setFeeWallet(feeWalletAddress: string) {
    try {
      this.FEE_WALLET = new PublicKey(feeWalletAddress);
      return true;
    } catch (error) {
      console.error('Invalid fee wallet address:', error);
      return false;
    }
  }
};

// Function to update the wallet information
export const updateWallet = (publicKey: PublicKey, keypair: Keypair | null) => {
  Config.solWallet.publicKey = publicKey;
  Config.solWallet.payer = keypair;
}; 