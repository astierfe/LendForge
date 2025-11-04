"use client";

import { DepositForm } from "@/components/forms/DepositForm";
import { PageContainer } from "@/components/layout/PageContainer";
import { Section } from "@/components/layout/Section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

export default function TestDepositFormPage() {
  return (
    <PageContainer>
      <Section>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">DepositForm Component Test</h1>
            <p className="text-muted-foreground mt-2">
              Complete deposit flow with asset selection, amount input, ERC20 approval, and transaction handling
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Component */}
            <div className="lg:col-span-2">
              <DepositForm />
            </div>

            {/* Testing Guide */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Testing Checklist</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <div className="font-medium">1. Connect Wallet</div>
                        <div className="text-muted-foreground text-xs">
                          Use WalletConnect or MetaMask
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <div className="font-medium">2. Select Asset</div>
                        <div className="text-muted-foreground text-xs">
                          Test ETH, USDC, and DAI
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <div className="font-medium">3. Enter Amount</div>
                        <div className="text-muted-foreground text-xs">
                          Try MAX button and manual input
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <div className="font-medium">4. Approve (ERC20)</div>
                        <div className="text-muted-foreground text-xs">
                          For USDC/DAI only
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <div className="font-medium">5. Deposit</div>
                        <div className="text-muted-foreground text-xs">
                          Confirm transaction in wallet
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <div className="font-medium">6. Redirect</div>
                        <div className="text-muted-foreground text-xs">
                          Should redirect to dashboard
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Flow Differences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Badge className="mb-2">ETH</Badge>
                    <ul className="text-xs space-y-1 text-muted-foreground ml-2">
                      <li>• No approval needed</li>
                      <li>• Direct deposit to LendingPool</li>
                      <li>• Single transaction</li>
                    </ul>
                  </div>

                  <div>
                    <Badge variant="secondary" className="mb-2">USDC / DAI</Badge>
                    <ul className="text-xs space-y-1 text-muted-foreground ml-2">
                      <li>• Requires approval first</li>
                      <li>• Approval is one-time (MAX_UINT256)</li>
                      <li>• Two transactions total</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm">Known Limitation</AlertTitle>
                <AlertDescription className="text-xs">
                  ERC20 deposits may require CollateralManager integration depending on your contract setup
                </AlertDescription>
              </Alert>
            </div>
          </div>

          {/* Feature Documentation */}
          <Card>
            <CardHeader>
              <CardTitle>Component Features</CardTitle>
              <CardDescription>Complete documentation of DepositForm capabilities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    State Management
                  </h3>
                  <ul className="text-sm space-y-1.5 text-muted-foreground ml-6 list-disc">
                    <li>Asset selection (ETH/USDC/DAI)</li>
                    <li>Amount input with validation</li>
                    <li>Approval status tracking</li>
                    <li>Transaction pending states</li>
                    <li>Success/error handling</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Wagmi Integration
                  </h3>
                  <ul className="text-sm space-y-1.5 text-muted-foreground ml-6 list-disc">
                    <li>useAccount - wallet connection</li>
                    <li>useBalance - ETH balance</li>
                    <li>useReadContract - ERC20 balance & allowance</li>
                    <li>useWriteContract - approve & deposit</li>
                    <li>useWaitForTransactionReceipt - confirmations</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Position Preview
                  </h3>
                  <ul className="text-sm space-y-1.5 text-muted-foreground ml-6 list-disc">
                    <li>Current collateral display</li>
                    <li>New collateral calculation</li>
                    <li>Max borrowable estimation</li>
                    <li>LTV ratio indicator</li>
                    <li>Live updates on amount change</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    User Experience
                  </h3>
                  <ul className="text-sm space-y-1.5 text-muted-foreground ml-6 list-disc">
                    <li>Toast notifications for all actions</li>
                    <li>Loading states with spinners</li>
                    <li>Auto-redirect to dashboard on success</li>
                    <li>Error messages for failed transactions</li>
                    <li>Approval info alerts for ERC20</li>
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-3">Transaction Flow</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-20 justify-center">Step 1</Badge>
                    <div className="text-sm">Select asset and enter amount</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-20 justify-center">Step 2</Badge>
                    <div className="text-sm">Check allowance (ERC20 only)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-20 justify-center">Step 3</Badge>
                    <div className="text-sm">Approve if needed (shows button)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-20 justify-center">Step 4</Badge>
                    <div className="text-sm">Wait for approval confirmation</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-20 justify-center">Step 5</Badge>
                    <div className="text-sm">Click deposit button (enabled after approval)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-20 justify-center">Step 6</Badge>
                    <div className="text-sm">Wait for deposit confirmation</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-20 justify-center">Step 7</Badge>
                    <div className="text-sm">Show success toast & redirect to dashboard</div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-3">Code Example</h3>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs">
{`// Basic usage in a page
import { DepositForm } from "@/components/forms/DepositForm";

export default function DepositPage() {
  return (
    <PageContainer>
      <Section>
        <h1>Deposit Collateral</h1>
        <DepositForm />
      </Section>
    </PageContainer>
  );
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>
    </PageContainer>
  );
}
