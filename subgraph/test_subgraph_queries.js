const fetch = require('node-fetch');

const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/122308/lendforge-v-4/version/latest';

const USER_ADDRESS = '0xf350b91b403ced3c6e68d34c13ebdaae3bbd4e01';
const USDC_ADDRESS = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238';
const DAI_ADDRESS = '0x3e622317f8c93f7328350cf0b56d9ed4c620c5d5';

const queries = {
  '1. All Users With Collaterals': `
    query GetAllUsersWithCollaterals {
      users(first: 10, orderBy: createdAt, orderDirection: desc) {
        id
        totalCollateralUSD
        totalBorrowed
        activePositions
        lifetimeDeposits
        lifetimeBorrows
        lifetimeRepayments
        liquidationCount
        createdAt
        updatedAt
        collaterals {
          asset {
            id
            symbol
            decimals
            ltv
            liquidationThreshold
          }
          amount
          valueUSD
          updatedAt
        }
        positions {
          id
          totalCollateralUSD
          borrowed
          healthFactor
          status
          createdAt
          updatedAt
        }
      }
    }
  `,

  '2. Global Metrics': `
    query GetGlobalMetrics {
      globalMetrics(first: 1) {
        id
        totalUsers
        totalPositions
        activePositions
        totalVolumeDeposited
        totalVolumeBorrowed
        totalVolumeRepaid
        totalLiquidations
        currentTVL
        currentBorrowed
        allTimeHighTVL
        allTimeHighBorrowed
        totalETHDeposited
        totalUSDCDeposited
        totalDAIDeposited
        updatedAt
      }
    }
  `,

  '3. Collateral Assets': `
    query GetCollateralAssets {
      collateralAssets(orderBy: symbol) {
        id
        symbol
        decimals
        ltv
        liquidationThreshold
        enabled
        totalDeposited
      }
    }
  `,

  '4. Recent Transactions': `
    query GetRecentTransactions {
      transactions(first: 20, orderBy: timestamp, orderDirection: desc) {
        id
        user {
          id
        }
        position {
          id
        }
        type
        asset
        amount
        timestamp
        blockNumber
        txHash
      }
    }
  `,

  '5. Liquidations': `
    query GetLiquidations {
      liquidations(first: 10, orderBy: timestamp, orderDirection: desc) {
        id
        user {
          id
        }
        position {
          id
        }
        liquidator
        debtRepaid
        collateralSeizedUSD
        timestamp
        blockNumber
        txHash
        healthFactorBefore
      }
    }
  `,

  '6. Price Deviations': `
    query GetPriceDeviations {
      priceDeviations(first: 10, orderBy: timestamp, orderDirection: desc) {
        id
        asset
        primaryPrice
        fallbackPrice
        deviationBps
        timestamp
        blockNumber
        emergencyTriggered
      }
    }
  `,

  '7. User Specific Collaterals': `
    query GetUserCollaterals($userId: String!) {
      user(id: $userId) {
        id
        totalCollateralUSD
        totalBorrowed
        collaterals {
          asset {
            id
            symbol
            decimals
          }
          amount
          valueUSD
          updatedAt
        }
        positions {
          id
          totalCollateralUSD
          borrowed
          healthFactor
          status
        }
      }
    }
  `,

  '8. Transactions By Asset': `
    query GetTransactionsByAsset($assetAddress: Bytes!) {
      transactions(
        first: 20
        where: { asset: $assetAddress }
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        user {
          id
        }
        type
        asset
        amount
        timestamp
        blockNumber
      }
    }
  `,

  '9. Active Positions': `
    query GetActivePositions {
      positions(
        first: 20
        where: { status: "ACTIVE" }
        orderBy: healthFactor
      ) {
        id
        user {
          id
        }
        totalCollateralUSD
        borrowed
        healthFactor
        status
        createdAt
        updatedAt
      }
    }
  `,

  '10. Daily Metrics': `
    query GetDailyMetrics {
      dailyMetrics(first: 30, orderBy: date, orderDirection: desc) {
        id
        date
        totalTVL
        totalBorrowed
        utilizationRate
        activeUsers
        activePositions
        depositsCount
        borrowsCount
        repaymentsCount
        liquidationsCount
        volumeDeposited
        volumeBorrowed
        volumeRepaid
      }
    }
  `
};

async function runQuery(name, query, variables = null) {
  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });

    const result = await response.json();

    if (result.errors) {
      console.log(`\n❌ ${name} - ERROR:`);
      console.log(JSON.stringify(result.errors, null, 2));
      return { success: false, errors: result.errors };
    }

    console.log(`\n✅ ${name} - SUCCESS`);
    console.log(JSON.stringify(result.data, null, 2));

    return { success: true, data: result.data };
  } catch (error) {
    console.log(`\n❌ ${name} - EXCEPTION:`);
    console.log(error.message);
    return { success: false, error: error.message };
  }
}

async function analyzeResults(results) {
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('ANALYSIS OF RESULTS');
  console.log('═══════════════════════════════════════════════════════\n');

  const successCount = results.filter(r => r.success).length;
  console.log(`✅ Successful queries: ${successCount}/${results.length}\n`);

  const userData = results.find(r => r.name === '7. User Specific Collaterals')?.data?.user;
  if (userData) {
    console.log('USER DATA VALIDATION:');
    console.log(`- User: ${userData.id}`);
    console.log(`- Total Collateral USD: ${userData.totalCollateralUSD}`);
    console.log(`- Total Borrowed: ${userData.totalBorrowed}`);
    console.log(`- Number of collaterals: ${userData.collaterals?.length || 0}`);

    if (userData.collaterals && userData.collaterals.length > 0) {
      console.log('\nCOLLATERAL BREAKDOWN:');
      userData.collaterals.forEach(c => {
        const amountDecimal = parseFloat(c.amount) / Math.pow(10, c.asset.decimals);
        const valueUSD = parseFloat(c.valueUSD) / 1e8;
        console.log(`  - ${c.asset.symbol}: ${amountDecimal.toFixed(4)} (${valueUSD.toFixed(2)} USD)`);
      });

      const totalValueUSD = userData.collaterals.reduce((sum, c) =>
        sum + parseFloat(c.valueUSD), 0) / 1e8;
      console.log(`\n  TOTAL valueUSD from collaterals: $${totalValueUSD.toFixed(2)}`);

      const reportedTotalUSD = parseFloat(userData.totalCollateralUSD) / 1e8;
      console.log(`  REPORTED totalCollateralUSD: $${reportedTotalUSD.toFixed(2)}`);

      if (Math.abs(totalValueUSD - reportedTotalUSD) > 0.01) {
        console.log(`  ⚠️  MISMATCH: Difference of $${Math.abs(totalValueUSD - reportedTotalUSD).toFixed(2)}`);
      } else {
        console.log(`  ✅ VALUES MATCH`);
      }
    }
  }

  const globalMetrics = results.find(r => r.name === '2. Global Metrics')?.data?.globalMetrics?.[0];
  if (globalMetrics) {
    console.log('\n\nGLOBAL METRICS VALIDATION:');
    console.log(`- Total Users: ${globalMetrics.totalUsers}`);
    console.log(`- Total Positions: ${globalMetrics.totalPositions}`);
    console.log(`- Active Positions: ${globalMetrics.activePositions}`);
    console.log(`- Current TVL: ${parseFloat(globalMetrics.currentTVL) / 1e8} USD`);
    console.log(`- Current Borrowed: ${parseFloat(globalMetrics.currentBorrowed) / 1e8} USD`);
    console.log(`- ETH Deposited: ${parseFloat(globalMetrics.totalETHDeposited) / 1e18} ETH`);
    console.log(`- USDC Deposited: ${parseFloat(globalMetrics.totalUSDCDeposited) / 1e6} USDC`);
    console.log(`- DAI Deposited: ${parseFloat(globalMetrics.totalDAIDeposited) / 1e18} DAI`);
  }

  const assets = results.find(r => r.name === '3. Collateral Assets')?.data?.collateralAssets;
  if (assets) {
    console.log('\n\nCOLLATERAL ASSETS CONFIGURATION:');
    assets.forEach(asset => {
      console.log(`- ${asset.symbol} (${asset.id})`);
      console.log(`  Decimals: ${asset.decimals}`);
      console.log(`  LTV: ${asset.ltv}%`);
      console.log(`  Liquidation Threshold: ${asset.liquidationThreshold}%`);
      console.log(`  Enabled: ${asset.enabled}`);
      console.log(`  Total Deposited: ${asset.totalDeposited}`);
    });
  }

  const transactions = results.find(r => r.name === '4. Recent Transactions')?.data?.transactions;
  if (transactions) {
    console.log(`\n\nRECENT TRANSACTIONS: ${transactions.length} found`);
    transactions.slice(0, 5).forEach(tx => {
      console.log(`- ${tx.type} | ${tx.amount} | Block ${tx.blockNumber}`);
    });
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('LendForge v3.0 Subgraph Validation Test');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Subgraph URL: ${SUBGRAPH_URL}`);
  console.log(`Test User: ${USER_ADDRESS}`);

  const results = [];

  for (const [name, query] of Object.entries(queries)) {
    let variables = null;

    if (name === '7. User Specific Collaterals') {
      variables = { userId: USER_ADDRESS.toLowerCase() };
    } else if (name === '8. Transactions By Asset') {
      variables = { assetAddress: USDC_ADDRESS.toLowerCase() };
    }

    const result = await runQuery(name, query, variables);
    results.push({ name, ...result });

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  await analyzeResults(results);

  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('TEST COMPLETE');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
