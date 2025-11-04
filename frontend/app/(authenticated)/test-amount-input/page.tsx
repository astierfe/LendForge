"use client";

import { useState } from "react";
import { AmountInput } from "@/components/forms/AmountInput";
import { SupportedAsset } from "@/components/forms/AssetSelector";
import { PageContainer } from "@/components/layout/PageContainer";
import { Section } from "@/components/layout/Section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TestAmountInputPage() {
  const [asset] = useState<SupportedAsset>("ETH");
  const [amount, setAmount] = useState("");
  const [customError, setCustomError] = useState<string | undefined>(undefined);

  const mockBalance = "2.5432";
  const mockPrice = "2345.67";

  const isValid = amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(mockBalance);

  return (
    <PageContainer>
      <Section>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">AmountInput Component Test</h1>
            <p className="text-muted-foreground mt-2">
              Testing the amount input component with validation
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Component Test */}
            <Card>
              <CardHeader>
                <CardTitle>Interactive Test</CardTitle>
                <CardDescription>
                  Enter amounts to test validation and USD conversion
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AmountInput
                  asset={asset}
                  amount={amount}
                  balance={mockBalance}
                  price={mockPrice}
                  onAmountChange={setAmount}
                  error={customError}
                />

                <div className="pt-4 border-t space-y-2">
                  <p className="text-sm font-medium">Test Cases:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setAmount("0.5")}
                      className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80"
                    >
                      Valid: 0.5
                    </button>
                    <button
                      onClick={() => setAmount("5.0")}
                      className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80"
                    >
                      Over balance: 5.0
                    </button>
                    <button
                      onClick={() => setAmount("0")}
                      className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80"
                    >
                      Zero: 0
                    </button>
                    <button
                      onClick={() => setAmount("")}
                      className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* State Display */}
            <Card>
              <CardHeader>
                <CardTitle>Current State</CardTitle>
                <CardDescription>Real-time validation status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Input Value
                    </div>
                    <div className="text-2xl font-bold">
                      {amount || "0"} {asset}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      USD Value
                    </div>
                    <div className="text-lg font-semibold">
                      ${amount && parseFloat(amount) > 0
                        ? (parseFloat(amount) * parseFloat(mockPrice)).toFixed(2)
                        : "0.00"
                      }
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Validation Status
                    </div>
                    {!amount && (
                      <Badge variant="secondary">No Input</Badge>
                    )}
                    {amount && isValid && (
                      <Badge className="bg-green-500">Valid</Badge>
                    )}
                    {amount && !isValid && (
                      <Badge variant="destructive">Invalid</Badge>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Checks
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={amount && parseFloat(amount) > 0 ? "text-green-500" : "text-muted-foreground"}>
                          {amount && parseFloat(amount) > 0 ? "✓" : "○"}
                        </span>
                        <span>Amount &gt; 0</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={amount && parseFloat(amount) <= parseFloat(mockBalance) ? "text-green-500" : "text-muted-foreground"}>
                          {amount && parseFloat(amount) <= parseFloat(mockBalance) ? "✓" : "○"}
                        </span>
                        <span>Amount ≤ Balance</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={amount && !isNaN(parseFloat(amount)) ? "text-green-500" : "text-muted-foreground"}>
                          {amount && !isNaN(parseFloat(amount)) ? "✓" : "○"}
                        </span>
                        <span>Valid Number Format</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Different Scenarios */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">With Price</CardTitle>
                <CardDescription>Shows USD value</CardDescription>
              </CardHeader>
              <CardContent>
                <AmountInput
                  asset="ETH"
                  amount="1.5"
                  balance="10.0"
                  price="2345.67"
                  onAmountChange={() => {}}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Without Price</CardTitle>
                <CardDescription>No USD display</CardDescription>
              </CardHeader>
              <CardContent>
                <AmountInput
                  asset="USDC"
                  amount="500"
                  balance="1000.00"
                  onAmountChange={() => {}}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">With Error</CardTitle>
                <CardDescription>Custom error message</CardDescription>
              </CardHeader>
              <CardContent>
                <AmountInput
                  asset="DAI"
                  amount="100"
                  balance="50.0"
                  onAmountChange={() => {}}
                  error="Custom error: Network fee too high"
                />
              </CardContent>
            </Card>
          </div>

          {/* Usage Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Features & Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-sm mb-2">Key Features:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                    <li>MAX button to fill entire balance</li>
                    <li>Automatic USD value calculation (if price provided)</li>
                    <li>Real-time validation (amount &gt; 0, amount ≤ balance)</li>
                    <li>Number-only input with decimal support</li>
                    <li>Asset-aware decimal formatting (2 for USDC, 4 for ETH/DAI)</li>
                    <li>Error display with custom or automatic validation messages</li>
                  </ul>
                </div>

                <div>
                  <p className="font-medium text-sm mb-2">Basic Usage:</p>
                  <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs">
{`<AmountInput
  asset="ETH"
  amount={amount}
  balance="2.5432"
  price="2345.67"
  onAmountChange={setAmount}
  error={customError}
  label="Deposit Amount"
/>`}
                  </pre>
                </div>

                <div>
                  <p className="font-medium text-sm mb-2">Validation Logic:</p>
                  <div className="bg-muted p-3 rounded-md text-xs space-y-1">
                    <div>• Amount must be &gt; 0</div>
                    <div>• Amount must be ≤ balance</div>
                    <div>• Amount must be a valid number</div>
                    <div>• Custom errors override validation errors</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>
    </PageContainer>
  );
}
