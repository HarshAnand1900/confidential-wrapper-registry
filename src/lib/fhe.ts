"use client";

import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import type { Eip1193Provider } from "ethers";

let fhevmInstance: FhevmInstance | null = null;
let initPromise: Promise<FhevmInstance> | null = null;

export async function getFhevm(provider: Eip1193Provider): Promise<FhevmInstance> {
  if (fhevmInstance) return fhevmInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const { createInstance, SepoliaConfig, initSDK } = await import(
      "@zama-fhe/relayer-sdk/web"
    );
    await initSDK();
    const instance = await createInstance({
      ...SepoliaConfig,
      network: provider,
    });
    fhevmInstance = instance;
    return instance;
  })();

  return initPromise;
}

export function resetFhevm() {
  fhevmInstance = null;
  initPromise = null;
}
