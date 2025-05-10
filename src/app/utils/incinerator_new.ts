import { Config } from "../config/solana";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Re-export types and functions from modular files
export * from "./tokenMetadata";
export * from "./tokenAccounts";
import { burnTokens } from "./tokenBurner";
export { burnTokens as incinerateTokens } from "./tokenBurner";
import { batchBurnTokens } from "./batchTokenBurner";
export { batchBurnTokens as batchIncinerateTokens } from "./batchTokenBurner";

// Re-export Config for convenience
export { Config }; 