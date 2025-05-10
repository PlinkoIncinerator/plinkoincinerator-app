import { Config } from "../config/solana";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Export the types and functions from the new modules
export * from "./tokenMetadata";
export * from "./tokenAccounts";
import { burnTokens } from "./tokenBurner";
export { burnTokens as incinerateTokens } from "./tokenBurner"; // Alias for backward compatibility
import { batchBurnTokens } from "./batchTokenBurner";
export { batchBurnTokens as batchIncinerateTokens } from "./batchTokenBurner"; // Alias for backward compatibility

// Re-export Config for convenience
export { Config }; 