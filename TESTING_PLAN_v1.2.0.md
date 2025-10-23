# LendForge v1.2.0 Testing Plan

## Overview
Comprehensive testing plan for validating the multi-collateral system migration including Python bot, The Graph subgraph, and smart contract integrations.

---

## Phase 1: Unit Tests

### 1.1 Python Bot Unit Tests

#### Configuration Tests
- **T1.1.1**: Verify contract address loading from environment variables
- **T1.1.2**: Validate ABI file loading for all three contracts (LendingPool, CollateralManager, OracleAggregator)
- **T1.1.3**: Test collateral configuration mapping (ETH/USDC/DAI with correct LTV/thresholds)
- **T1.1.4**: Verify Web3 connection initialization with correct RPC endpoint

#### Web3 Client Tests
- **T1.2.1**: Test `get_asset_price()` method for each supported asset
- **T1.2.2**: Test `get_user_collaterals()` method return format and data types
- **T1.2.3**: Test `get_collateral_value_usd()` calculation accuracy
- **T1.2.4**: Test `get_user_position()` health factor calculation
- **T1.2.5**: Test oracle deviation detection methods
- **T1.2.6**: Test emergency mode status checking

#### Position Monitor Tests
- **T1.3.1**: Test `analyze_multi_collateral_position()` with single asset
- **T1.3.2**: Test `analyze_multi_collateral_position()` with multiple assets
- **T1.3.3**: Test health factor calculation with mixed collateral types
- **T1.3.4**: Test liquidation threshold detection for different asset combinations
- **T1.3.5**: Test position risk assessment scoring

#### Profit Calculator Tests
- **T1.4.1**: Test gas estimation for single-asset liquidations
- **T1.4.2**: Test gas estimation for multi-asset liquidations
- **T1.4.3**: Test liquidation bonus calculation per asset type
- **T1.4.4**: Test profit calculation with current gas prices
- **T1.4.5**: Test slippage calculation for different liquidation sizes

### 1.2 The Graph Subgraph Unit Tests

#### Schema Validation Tests
- **T2.1.1**: Verify all entity definitions compile correctly
- **T2.1.2**: Test entity relationship mappings (User -> UserCollateral -> CollateralAsset)
- **T2.1.3**: Validate field types and nullability constraints
- **T2.1.4**: Test enum values for transaction types and position status

#### Event Handler Tests
- **T2.2.1**: Test `handleCollateralDeposited()` entity creation and updates
- **T2.2.2**: Test `handleCollateralWithdrawn()` balance calculations
- **T2.2.3**: Test `handleBorrowed()` position and user updates
- **T2.2.4**: Test `handleRepaid()` debt calculation and position closure
- **T2.2.5**: Test `handleLiquidated()` liquidation record creation
- **T2.2.6**: Test `handleDeviationWarning()` price deviation tracking
- **T2.2.7**: Test `handleCriticalDeviation()` emergency mode handling

#### Data Consistency Tests
- **T2.3.1**: Test global metrics calculation accuracy
- **T2.3.2**: Test user lifetime statistics accumulation
- **T2.3.3**: Test asset total deposited tracking
- **T2.3.4**: Test transaction ID uniqueness and format

---

## Phase 2: Integration Tests

### 2.1 Smart Contract Integration Tests

#### Oracle System Tests
- **T3.1.1**: Test price retrieval from OracleAggregator for all assets
- **T3.1.2**: Test deviation calculation between primary and fallback prices
- **T3.1.3**: Test emergency mode activation on critical deviation
- **T3.1.4**: Test price caching mechanism and expiration
- **T3.1.5**: Test manual price override functionality

#### Multi-Collateral Workflow Tests
- **T3.2.1**: Test ETH collateral deposit and position creation
- **T3.2.2**: Test USDC collateral deposit to existing position
- **T3.2.3**: Test DAI collateral deposit and value calculation
- **T3.2.4**: Test borrowing against mixed collateral portfolio
- **T3.2.5**: Test partial collateral withdrawal with health factor validation
- **T3.2.6**: Test full position repayment and collateral release

#### Liquidation Process Tests
- **T3.3.1**: Test liquidation eligibility detection for underwater positions
- **T3.3.2**: Test liquidation execution with single collateral type
- **T3.3.3**: Test liquidation execution with multiple collateral types
- **T3.3.4**: Test liquidation bonus distribution per asset type
- **T3.3.5**: Test liquidation in emergency mode scenarios

### 2.2 Bot-Blockchain Integration Tests

#### Position Monitoring Integration
- **T4.1.1**: Test real-time position sync with CollateralManager events
- **T4.1.2**: Test health factor monitoring across all user positions
- **T4.1.3**: Test liquidation opportunity detection pipeline
- **T4.1.4**: Test oracle price feed synchronization
- **T4.1.5**: Test emergency mode detection and response

#### Transaction Execution Tests
- **T4.2.1**: Test liquidation transaction construction for single asset
- **T4.2.2**: Test liquidation transaction construction for multiple assets
- **T4.2.3**: Test gas price optimization and transaction submission
- **T4.2.4**: Test transaction failure handling and retry logic
- **T4.2.5**: Test profit validation post-liquidation

### 2.3 Subgraph-Blockchain Integration Tests

#### Event Indexing Tests
- **T5.1.1**: Test real-time event indexing from LendingPool contract
- **T5.1.2**: Test real-time event indexing from CollateralManager contract
- **T5.1.3**: Test real-time event indexing from OracleAggregator contract
- **T5.1.4**: Test block reorganization handling and data consistency
- **T5.1.5**: Test historical data backfill accuracy

#### Query Performance Tests
- **T5.2.1**: Test complex multi-entity queries response time
- **T5.2.2**: Test pagination efficiency for large datasets
- **T5.2.3**: Test filter and sorting operations performance
- **T5.2.4**: Test real-time data freshness (indexing delay)

---

## Phase 3: Functional End-to-End Tests

### 3.1 Complete User Journey Tests

#### New User Onboarding
- **T6.1.1**: Test complete flow from wallet connection to first collateral deposit
- **T6.1.2**: Test first borrowing transaction with health factor calculation
- **T6.1.3**: Test position tracking in subgraph after transactions
- **T6.1.4**: Test bot detection of new position for monitoring

#### Multi-Asset Position Management
- **T6.2.1**: Test building position with ETH -> add USDC -> add DAI collateral
- **T6.2.2**: Test borrowing against diversified collateral portfolio
- **T6.2.3**: Test partial repayment and collateral rebalancing
- **T6.2.4**: Test complete position closure and asset withdrawal

#### Liquidation Scenario Testing
- **T6.3.1**: Test position becoming liquidatable due to price movement
- **T6.3.2**: Test bot detection and liquidation execution
- **T6.3.3**: Test subgraph recording of liquidation event
- **T6.3.4**: Test user notification and remaining collateral handling

### 3.2 Oracle Crisis Scenarios

#### Price Deviation Handling
- **T7.1.1**: Test system response to 6% price deviation (warning mode)
- **T7.1.2**: Test system response to 12% price deviation (emergency mode)
- **T7.1.3**: Test bot behavior during emergency mode (no new borrows)
- **T7.1.4**: Test subgraph tracking of deviation events
- **T7.1.5**: Test manual resolution and system recovery

#### Oracle Failure Simulation
- **T7.2.1**: Test system behavior with Chainlink feed failure
- **T7.2.2**: Test fallback to Uniswap TWAP pricing
- **T7.2.3**: Test bot adaptation to alternative price sources
- **T7.2.4**: Test user position safety during oracle issues

### 3.3 High Load Scenarios

#### System Stress Tests
- **T8.1.1**: Test concurrent liquidations during market volatility
- **T8.1.2**: Test subgraph performance with high transaction volume
- **T8.1.3**: Test bot performance monitoring multiple positions simultaneously
- **T8.1.4**: Test oracle price updates under heavy load
- **T8.1.5**: Test system stability during network congestion

---

## Phase 4: Data Validation Tests

### 4.1 Cross-System Data Consistency

#### State Synchronization
- **T9.1.1**: Compare bot position data with blockchain state
- **T9.1.2**: Compare subgraph data with blockchain events
- **T9.1.3**: Validate TVL calculations across systems
- **T9.1.4**: Verify user balance consistency
- **T9.1.5**: Test data recovery after system restart

#### Historical Data Integrity
- **T9.2.1**: Validate transaction history completeness
- **T9.2.2**: Test liquidation event data accuracy
- **T9.2.3**: Verify price deviation event records
- **T9.2.4**: Test user lifetime statistics calculations

### 4.2 Business Logic Validation

#### Financial Calculations
- **T10.1.1**: Verify health factor calculations match contract logic
- **T10.1.2**: Test liquidation bonus calculations per asset type
- **T10.1.3**: Validate collateral value conversions to USD
- **T10.1.4**: Test APY calculations and reward distributions
- **T10.1.5**: Verify gas cost estimations for profitability

---

## Test Data Requirements

### Blockchain Test Scenarios
- Multiple user accounts with varied collateral compositions
- Positions at different health factor levels (safe, risky, liquidatable)
- Historical price data for deviation simulation
- Gas price variations for transaction cost testing

### Expected Test Duration
- **Phase 1 (Unit)**: 2-3 days
- **Phase 2 (Integration)**: 3-4 days
- **Phase 3 (Functional)**: 4-5 days
- **Phase 4 (Validation)**: 2-3 days
- **Total**: 11-15 days

### Success Criteria
- All unit tests pass with >95% coverage
- Integration tests demonstrate correct cross-system communication
- Functional tests validate complete user workflows
- Data consistency verified across all components
- System handles oracle crisis scenarios gracefully
- Performance meets specified requirements (<1min liquidation detection)

---

## Next Steps After Testing
1. Address any identified issues or edge cases
2. Document test results and system performance metrics
3. Prepare production deployment checklist
4. Begin frontend development with validated backend systems