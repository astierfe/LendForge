"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TOKENS, ASSET_METADATA } from "@/lib/contracts/addresses";

export type SupportedAsset = "ETH" | "USDC" | "DAI";

interface AssetSelectorProps {
  selectedAsset: SupportedAsset;
  onAssetChange: (asset: SupportedAsset) => void;
  balance?: string;
  price?: string;
}

export function AssetSelector({
  selectedAsset,
  onAssetChange,
  balance,
  price,
}: AssetSelectorProps) {
  const assets: SupportedAsset[] = ["ETH", "USDC", "DAI"];

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Select Asset</label>
        <Tabs value={selectedAsset} onValueChange={(value) => onAssetChange(value as SupportedAsset)}>
          <TabsList className="grid w-full grid-cols-3">
            {assets.map((asset) => (
              <TabsTrigger key={asset} value={asset}>
                {asset}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Asset Info Display */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Asset</span>
          <span className="text-sm font-medium">
            {ASSET_METADATA[TOKENS[selectedAsset]].name} ({selectedAsset})
          </span>
        </div>

        {balance !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Balance</span>
            <span className="text-sm font-medium">
              {parseFloat(balance).toFixed(selectedAsset === "USDC" ? 2 : 4)} {selectedAsset}
            </span>
          </div>
        )}

        {price !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Price</span>
            <span className="text-sm font-medium">${parseFloat(price).toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
