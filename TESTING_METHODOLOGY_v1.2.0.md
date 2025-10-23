# LendForge v1.2.0 Testing Methodology & Implementation

## Testing Status Overview

### ✅ Already Completed Tests
- **T1.1.2**: ABI loading - Verified during bot migration
- **T1.1.3**: Collateral configs - Verified in config.py update
- **T2.1.1**: Schema compilation - Verified with `npm run build`
- **T2.2.1-T2.2.7**: Event handlers - Verified with successful subgraph compilation
- **T5.1.1-T5.1.3**: Event indexing - Verified with successful deployment

---

## Testing Tools & Methods

### Core Testing Tools
- **pytest**: Python unit tests and integration tests
- **hardhat/foundry**: Smart contract testing and simulation
- **GraphQL Playground**: Subgraph query testing
- **Postman/curl**: API endpoint testing
- **Web3.py scripts**: Blockchain interaction testing
- **Manual verification**: Visual inspection of transactions on Sepolia

---

## Test Implementation Groups

### Group A: Python Bot Unit Tests (pytest framework)

**Script**: `test_bot_units.py`
**Method**: Automated pytest suite
**Duration**: 30 minutes

#### Tests Covered:
- **T1.1.1**: Environment variables loading
- **T1.1.4**: Web3 connection initialization
- **T1.2.1**: Asset price retrieval (mocked responses)
- **T1.2.2**: User collaterals data format
- **T1.2.3**: USD value calculations
- **T1.2.4**: Health factor calculations
- **T1.3.1-T1.3.5**: Position analysis methods
- **T1.4.1-T1.4.5**: Profit calculator methods

**Verification Method**:
```bash
cd bot && python -m pytest tests/test_bot_units.py -v --cov
```

### Group B: Smart Contract Integration Tests (Web3.py scripts)

**Script**: `test_contract_integration.py`
**Method**: Real Sepolia transactions with test accounts
**Duration**: 2 hours

#### Tests Covered:
- **T3.1.1-T3.1.5**: Oracle system integration
- **T3.2.1-T3.2.6**: Multi-collateral workflows
- **T4.1.1-T4.1.4**: Position monitoring integration

**Verification Method**:
```bash
cd bot && python scripts/test_contract_integration.py
```
**Requirements**: Test ETH, funded test accounts

### Group C: Subgraph Query Tests (GraphQL + curl)

**Script**: `test_subgraph_queries.sh`
**Method**: GraphQL queries against deployed subgraph
**Duration**: 45 minutes

#### Tests Covered:
- **T2.3.1-T2.3.4**: Data consistency validation
- **T5.2.1-T5.2.4**: Query performance testing
- **T9.1.2**: Subgraph vs blockchain data comparison

**Verification Method**:
```bash
cd subgraph && bash test_subgraph_queries.sh
```
**Uses**: validation_queries.graphql + custom assertions

### Group D: End-to-End User Journey Tests (Manual + Scripts)

**Script**: `test_e2e_journeys.py`
**Method**: Orchestrated test scenarios with real transactions
**Duration**: 4 hours

#### Tests Covered:
- **T6.1.1-T6.1.4**: New user onboarding
- **T6.2.1-T6.2.4**: Multi-asset position management
- **T6.3.1-T6.3.4**: Liquidation scenarios

**Verification Method**:
```bash
cd bot && python scripts/test_e2e_journeys.py --scenario=new_user
cd bot && python scripts/test_e2e_journeys.py --scenario=multi_asset
cd bot && python scripts/test_e2e_journeys.py --scenario=liquidation
```

### Group E: Oracle Crisis Simulation (Manual + Foundry)

**Script**: `test_oracle_crisis.py` + Foundry fork
**Method**: Mainnet fork with manipulated price feeds
**Duration**: 3 hours

#### Tests Covered:
- **T7.1.1-T7.1.5**: Price deviation scenarios
- **T7.2.1-T7.2.4**: Oracle failure simulation

**Verification Method**:
```bash
# Start mainnet fork
anvil --fork-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
# Run crisis scenarios
cd contracts && forge test --match-test testOracleCrisis -vv
cd bot && python scripts/test_oracle_crisis.py
```

### Group F: Performance & Load Tests (Custom scripts)

**Script**: `test_performance.py`
**Method**: Concurrent operations simulation
**Duration**: 2 hours

#### Tests Covered:
- **T8.1.1-T8.1.5**: High load scenarios
- **T4.2.1-T4.2.5**: Transaction execution stress tests

**Verification Method**:
```bash
cd bot && python scripts/test_performance.py --concurrent=10 --duration=3600
```

### Group G: Data Validation Suite (Mixed approach)

**Script**: `validate_data_consistency.py`
**Method**: Cross-system data comparison
**Duration**: 1.5 hours

#### Tests Covered:
- **T9.1.1**: Bot vs blockchain state
- **T9.2.1-T9.2.4**: Historical data integrity
- **T10.1.1-T10.1.5**: Financial calculations

**Verification Method**:
```bash
cd bot && python scripts/validate_data_consistency.py --full-check
```

---

## Individual Test Methods

### Unit Tests Requiring Specific Verification

#### T1.2.5: Oracle deviation detection
**Method**: Mock price provider with controlled deviation
**Tool**: pytest with unittest.mock
**Verification**: Assert warning/emergency mode triggers

#### T1.2.6: Emergency mode status
**Method**: Contract state reading
**Tool**: Web3.py direct calls
**Verification**: `oracle_aggregator.functions.emergencyMode().call()`

#### T2.1.2-T2.1.4: Schema relationships
**Method**: GraphQL introspection queries
**Tool**: GraphQL Playground
**Verification**: Manual inspection of schema relationships

### Integration Tests Requiring Manual Steps

#### T3.3.1-T3.3.5: Liquidation process
**Method**: Create underwater position + trigger liquidation
**Steps**:
1. Deposit collateral (manual transaction)
2. Borrow maximum amount (manual transaction)
3. Simulate price drop (oracle manipulation)
4. Trigger liquidation (bot script)
5. Verify results (subgraph query)

#### T5.1.4: Block reorganization handling
**Method**: Testnet reorg simulation
**Tool**: Custom node setup or wait for natural reorg
**Verification**: Compare subgraph data before/after reorg

### Performance Tests Requiring Monitoring

#### T5.2.1-T5.2.3: Query performance
**Method**: GraphQL query timing with large datasets
**Tool**: Custom benchmarking script
**Verification**: Assert <200ms response time for complex queries

#### T8.1.2: Subgraph high volume
**Method**: Batch transaction submission
**Tool**: Web3.py script sending 100+ transactions
**Verification**: Monitor indexing lag and memory usage

---

## Testing Infrastructure Requirements

### Test Accounts & Assets
- **Primary test account**: 10 ETH + test tokens
- **Secondary test account**: 5 ETH (liquidator)
- **USDC balance**: 10,000 test USDC
- **DAI balance**: 10,000 test DAI

### Environment Setup
- **Sepolia RPC**: Alchemy/Infura endpoint
- **Test database**: Separate MongoDB instance
- **Subgraph endpoint**: Deployed lendforge-v-3
- **Bot instance**: Dedicated testing environment

### Monitoring Tools
- **Etherscan Sepolia**: Transaction verification
- **Subgraph Playground**: Query testing
- **MongoDB Compass**: Database inspection
- **Bot logs**: Debug output analysis

---

## Execution Roadmap

### Phase 1: Automated Tests (Day 1-2)
1. **Group A**: Python unit tests (30 min)
2. **Group C**: Subgraph queries (45 min)
3. **Group G**: Data validation (1.5 hours)

### Phase 2: Integration Tests (Day 3-4)
1. **Group B**: Contract integration (2 hours)
2. **Group D**: E2E journeys (4 hours)

### Phase 3: Stress Tests (Day 5)
1. **Group E**: Oracle crisis (3 hours)
2. **Group F**: Performance tests (2 hours)

### Phase 4: Manual Verification (Day 6)
1. Edge case testing
2. Visual verification on Etherscan
3. Final data consistency checks

---

## Success Metrics

### Automated Test Coverage
- **Unit tests**: >95% code coverage
- **Integration tests**: All critical paths tested
- **Performance tests**: <1min liquidation detection

### Manual Verification Checkpoints
- All transactions visible on Etherscan Sepolia
- Subgraph data matches blockchain events
- Bot correctly identifies liquidation opportunities
- Oracle deviation handling works as specified

### Quality Gates
- Zero critical bugs found
- All financial calculations verified
- System stable under load
- Data consistency maintained across components