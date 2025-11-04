"use client";

import { useState } from "react";
import { AssetSelector, SupportedAsset } from "@/components/forms/AssetSelector";
import { PageContainer } from "@/components/layout/PageContainer";
import { Section } from "@/components/layout/Section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TestAssetSelectorPage() {
  const [selectedAsset, setSelectedAsset] = useState<SupportedAsset>("ETH");

  // Mock data for testing
  const mockData = {
    ETH: {
      balance: "2.5432",
      price: "2345.67",
    },
    USDC: {
      balance: "1500.25",
      price: "1.00",
    },
    DAI: {
      balance: "850.1234",
      price: "0.9998",
    },
  };

  return (
    <PageContainer>
      <Section>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">AssetSelector Component Test</h1>
            <p className="text-muted-foreground mt-2">
              Testing the asset selection component with mock data
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Component Test */}
            <Card>
              <CardHeader>
                <CardTitle>Interactive Test</CardTitle>
                <CardDescription>
                  Select different assets to see the component in action
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AssetSelector
                  selectedAsset={selectedAsset}
                  onAssetChange={setSelectedAsset}
                  balance={mockData[selectedAsset].balance}
                  price={mockData[selectedAsset].price}
                />
              </CardContent>
            </Card>

            {/* State Display */}
            <Card>
              <CardHeader>
                <CardTitle>Current State</CardTitle>
                <CardDescription>
                  Real-time state updates from the component
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Selected Asset
                    </div>
                    <div className="text-2xl font-bold">{selectedAsset}</div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Balance
                    </div>
                    <div className="text-lg font-semibold">
                      {mockData[selectedAsset].balance} {selectedAsset}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Price (USD)
                    </div>
                    <div className="text-lg font-semibold">
                      ${mockData[selectedAsset].price}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Total Value (USD)
                    </div>
                    <div className="text-lg font-semibold text-primary">
                      $
                      {(
                        parseFloat(mockData[selectedAsset].balance) *
                        parseFloat(mockData[selectedAsset].price)
                      ).toFixed(2)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Test without balance/price */}
          <Card>
            <CardHeader>
              <CardTitle>Minimal Version (No Balance/Price)</CardTitle>
              <CardDescription>
                Testing component with minimal props (optional balance/price omitted)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AssetSelector
                selectedAsset={selectedAsset}
                onAssetChange={setSelectedAsset}
              />
            </CardContent>
          </Card>

          {/* Usage Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Instructions</CardTitle>
              <CardDescription>How to use this component</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p className="font-medium">Basic Usage:</p>
                <pre className="bg-muted p-3 rounded-md overflow-x-auto">
                  {`<AssetSelector
  selectedAsset={selectedAsset}
  onAssetChange={setSelectedAsset}
  balance="2.5432"
  price="2345.67"
/>`}
                </pre>

                <p className="font-medium mt-4">Props:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                  <li>
                    <code className="bg-muted px-1 rounded">selectedAsset</code>: Current
                    selected asset (ETH | USDC | DAI)
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded">onAssetChange</code>: Callback
                    function when asset changes
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded">balance</code>: (Optional)
                    User balance for the asset
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded">price</code>: (Optional) Current
                    USD price of the asset
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>
    </PageContainer>
  );
}
