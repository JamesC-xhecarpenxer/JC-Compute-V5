# JC Compute Internet Protocol - Integration Guide

## Quick Start

### Installation

```bash
# Copy the protocol into your JC Compute v5 installation
cp jc-compute-internet-protocol.js your-jc-compute/network/

# Install dependencies
npm install crypto events
```

### Basic Setup (5 minutes)

```javascript
const { InternetLayerCoordinator } = require('./jc-compute-internet-protocol');

// 1. Create a node with your domain's capability
const internet = new InternetLayerCoordinator(
  {
    domain: 'trading-bot-1',
    operations: 'execute-trades',
    settle: 'pending-confirmed'
  },
  {
    stake: 5000,  // Your network stake
    registeredAt: Date.now()
  }
);

// 2. Bootstrap from seed nodes
const seedNodes = [
  'ji://seed-node-1-address-40chars',
  'ji://seed-node-2-address-40chars',
  'ji://seed-node-3-address-40chars'
];

await internet.bootstrap(seedNodes);

console.log('Connected!', internet.localIdentity.address);
// Output: Connected! ji://abcdef0123456789...
```

### Connect to Your Domain

```javascript
const { MyDomain } = require('./my-domain');

const domain = new MyDomain({
  name: 'trading-bot-1',
  nodes: 5
});

// Connect internet layer to domain
internet.connectDomain(domain);

// Now domain can sync and route messages across network
console.log('Domain connected to internet');
```

---

## Integration Points

### 1. Domain → Internet Message Sending

**Your domain code:**
```javascript
// In your domain's message handler
domain.on('message-to-send', (target, message) => {
  try {
    const { route, forwarded } = await internet.sendToDomain(
      target,
      message,
      { operations: 'execute-trades' }  // Required capability
    );
    
    domain.emit('message-sent', {
      target,
      route: route.path,
      hops: route.hopCount
    });
  } catch (err) {
    domain.emit('message-failed', {
      target,
      error: err.message
    });
  }
});
```

**What happens:**
1. Router checks capability (does remote have "operations"?)
2. Finds path using BFS if authorized
3. Adds signature and forwards
4. Reports back with route info

### 2. Internet → Domain Synchronization

**In your domain's convergence handler:**
```javascript
// When domain reaches local consensus
domain.on('local-consensus', (state) => {
  // Offer sync with peer domains
  const remoteDomains = ['ji://other-trading-bot', 'ji://settlement-engine'];
  
  for (const remote of remoteDomains) {
    const jobID = internet.crossDomainSync.initiateSync(
      remote,
      'trading-state'
    );
  }
});

// Handle sync completion
internet.crossDomainSync.on('sync-merged', (job) => {
  // Apply merged state to domain
  domain.applyRemoteState(job.mergedState);
  
  // Propagate to local peers
  domain.broadcastStateUpdate({
    source: 'remote-sync',
    state: job.mergedState,
    proof: job.merkleProof
  });
});
```

**What happens:**
1. Internet computes delta between states
2. Uses Merkle verification
3. Applies JC Compute merge operator
4. Calls your domain's merge handler
5. Notifies on completion

### 3. Service Discovery via DNS

**Register your domain:**
```javascript
// After domain is operational
internet.dns.registerTLD('trading', internet.localIdentity.address);

internet.dns.registerName(
  'settlement.trading.jc',
  internet.localIdentity.address,
  3600  // TTL in seconds
);
```

**Other domains can discover you:**
```javascript
// Client domain code
const settlement = internet.dns.discoverService('settlement', 'trading.jc');

if (settlement) {
  await internet.sendToDomain(
    settlement.address,
    { settle: tradeData },
    settlement.identity.capability
  );
}
```

### 4. Consensus Participation

**Automatically enabled once connected:**
```javascript
// Internet consensus runs in background
internet.consensus.on('consensus-reached', (result) => {
  console.log(`Consensus: ${result.signers.size} nodes agreed`);
  
  // Reward participating nodes (including this one)
  for (const signer of result.signers) {
    internet.incentives.rewardParticipation(signer, 'consensus', 10);
  }
});

// Monitor consensus rounds
internet.consensus.on('view-change', (result) => {
  console.log(`View changed: ${result.newView}, new leader: ${result.newLeader}`);
});
```

### 5. Handling Slashing

**Monitor for misbehavior:**
```javascript
// If a node sends conflicting messages
domain.on('conflict-detected', (evidence) => {
  internet.incentives.checkAndSlash(
    evidence.nodeAddress,
    {
      type: 'double-sign',
      block1: evidence.block1,
      block2: evidence.block2
    }
  );
});

// Listen to slashing events
internet.gas.on('slashed', (event) => {
  console.warn(`Node ${event.address} slashed by ${event.amount}%`);
  
  if (event.address === internet.localIdentity.address) {
    // We were slashed! Take corrective action
    domain.emit('security-event', { reason: 'slashed' });
  }
});
```

---

## Event System

### Internet Layer Events

```javascript
// Peer management
internet.peerDiscovery.on('peer-discovered', (event) => {
  console.log(`Found peer: ${event.address}`);
});

// Name service
internet.dns.on('name-registered', (name) => {
  console.log(`Registered: ${name}`);
});

// Routing
internet.on('message-sent', (event) => {
  console.log(`Routed through ${event.route.length} hops`);
});

// Consensus
internet.consensus.on('consensus-reached', (result) => {
  console.log(`${result.signers.size} nodes reached consensus`);
});

// Sync
internet.crossDomainSync.on('sync-merged', (job) => {
  console.log(`Sync complete: ${job.jobID}`);
});

// Incentives
internet.incentives.on('reward-granted', (event) => {
  console.log(`+${event.amount} for ${event.type}`);
});
```

---

## Domain Integration Template

Here's a complete integration template for a JC Compute domain:

```javascript
/**
 * JC Compute Domain with Internet Integration
 */

class InternetEnabledDomain extends JCComputeDomain {
  constructor(config, internetConfig) {
    super(config);
    
    // Create internet layer
    this.internet = new InternetLayerCoordinator(
      {
        domain: config.name,
        ...internetConfig.capability
      },
      {
        stake: internetConfig.stake || 1000,
        registeredAt: Date.now()
      }
    );
    
    // Connect internet to domain
    this.internet.connectDomain(this);
    
    // Setup message routing
    this.setupMessageRouting();
    
    // Setup synchronization
    this.setupSynchronization();
    
    // Setup incentives
    this.setupIncentives();
  }
  
  /**
   * Setup message routing between domains
   */
  setupMessageRouting() {
    this.on('outgoing-message', async (target, message) => {
      try {
        const result = await this.internet.sendToDomain(
          target,
          {
            id: message.id,
            from: this.internet.localIdentity.address,
            payload: message.payload,
            timestamp: Date.now()
          },
          this.getRequiredCapability()
        );
        
        this.emit('message-routed', {
          target,
          route: result.route,
          success: true
        });
      } catch (err) {
        this.emit('message-failed', {
          target,
          error: err.message
        });
      }
    });
    
    // Handle incoming messages from network
    this.internet.on('message-received', (message) => {
      // Verify signature
      const sender = this.internet.gas.lookup(message.from);
      if (!sender || !sender.verify(message, message.signature)) {
        return; // Invalid message
      }
      
      // Apply to domain
      this.applyIncomingMessage(message);
    });
  }
  
  /**
   * Setup cross-domain synchronization
   */
  setupSynchronization() {
    // When we reach local consensus
    this.on('consensus-reached', (state) => {
      // Start syncing with known peers
      this.syncWithPeers(state);
    });
    
    // Handle sync completion
    this.internet.crossDomainSync.on('sync-merged', (job) => {
      this.applyMergedState(job.mergedState, job.jobID);
    });
  }
  
  /**
   * Setup network incentive rewards
   */
  setupIncentives() {
    // Reward ourselves for consensus participation
    this.internet.consensus.on('consensus-reached', (result) => {
      if (result.signers.has(this.internet.localIdentity.address)) {
        this.internet.incentives.rewardParticipation(
          this.internet.localIdentity.address,
          'consensus',
          10
        );
      }
    });
    
    // Monitor our reputation
    setInterval(() => {
      const stats = this.internet.getNetworkStats();
      if (stats.reputation < -50) {
        this.emit('warning', 'Low reputation - may be slashed soon');
      }
    }, 60000);
  }
  
  /**
   * Bootstrap the internet connection
   */
  async bootstrap(seedNodes) {
    await this.internet.bootstrap(seedNodes);
    this.emit('network-ready');
  }
  
  /**
   * Get current network statistics
   */
  getNetworkStats() {
    return this.internet.getNetworkStats();
  }
  
  /**
   * Sync state with peer domains
   */
  async syncWithPeers(localState) {
    const peers = this.internet.peerDiscovery.getBestPeers(3);
    
    for (const peerAddr of peers) {
      const jobID = this.internet.crossDomainSync.initiateSync(peerAddr);
      // Sync job will complete asynchronously
    }
  }
  
  /**
   * Apply merged state from remote domain
   */
  applyMergedState(mergedState, jobID) {
    // Your domain's merge logic
    const newState = this.merge(this.state, mergedState);
    
    // Commit
    this.setState(newState);
    
    // Broadcast to local peers
    this.broadcastStateUpdate(newState);
  }
  
  /**
   * Get required capability for message routing
   */
  getRequiredCapability() {
    return {
      domain: this.name,
      operations: 'execute'
    };
  }
}

// Usage
const domain = new InternetEnabledDomain(
  { name: 'trading-domain', nodes: 5 },
  {
    capability: { domain: 'trading', operations: 'execute' },
    stake: 1000
  }
);

// Bootstrap with seed nodes
await domain.bootstrap([
  'ji://seed-1-address-40chars',
  'ji://seed-2-address-40chars'
]);

// Domain is now connected to internet!
```

---

## Running the Tests

```bash
# Run full test suite
node internet-protocol-tests.js

# Expected output:
# ✓ InternetIdentity creates stable address from capability
# ✓ InternetIdentity derives unforgeable public key
# ✓ InternetIdentity signs and verifies messages
# ...
# 28 passed, 0 failed
```

---

## Monitoring & Debugging

### View Network Statistics

```javascript
setInterval(() => {
  const stats = internet.getNetworkStats();
  
  console.log(`
    ╔═══════════════════════════════╗
    ║    Network Status             ║
    ╠═══════════════════════════════╣
    ║ Address:  ${stats.localAddress}
    ║ Stake:    ${stats.stake}
    ║ Peers:    ${stats.peersConnected}
    ║ Registered: ${stats.registeredAddresses}
    ║ View:     ${stats.currentView}
    ║ Syncs:    ${stats.activeSyncJobs}
    ╚═══════════════════════════════╝
  `);
}, 10000);
```

### Peer Health Monitoring

```javascript
function monitorPeerHealth() {
  const peers = internet.peerDiscovery.peers;
  
  for (const [addr, peer] of peers) {
    const successRate = peer.successCount / (peer.successCount + peer.failureCount + 1);
    const score = peer.trustScore * successRate;
    
    if (score < 0.3) {
      console.warn(`Low quality peer: ${addr} (score: ${score})`);
    }
  }
}

setInterval(monitorPeerHealth, 30000);
```

### Routing Analysis

```javascript
function analyzeRoutes() {
  const allAddrs = internet.gas.getAllAddresses();
  
  for (const dest of allAddrs.slice(0, 5)) {
    const route = internet.router.findRoute(dest, {});
    if (!route) {
      console.warn(`No route to ${dest}`);
    } else {
      console.log(`Route to ${dest}: ${route.hopCount} hops`);
    }
  }
}
```

---

## Troubleshooting

### "No route with required capability"
- **Issue:** Target domain doesn't have required capability
- **Solution:** 
  - Check target domain's capability specification
  - Update required capability in sendToDomain call
  - Verify target domain is properly registered

### "Message deduplication failed"
- **Issue:** Trying to resend same message
- **Solution:**
  - Assign unique message ID
  - Wait before retrying (cache expires after 1 hour)
  - Use exponential backoff for retries

### "Peer discovery timeout"
- **Issue:** Can't reach seed nodes
- **Solution:**
  - Verify seed node addresses are correct
  - Check network connectivity
  - Add more seed nodes
  - Wait longer for DHT to propagate

### "Consensus not reaching quorum"
- **Issue:** Too few honest nodes online
- **Solution:**
  - Wait for more nodes to come online
  - View change will happen automatically (default: 10s timeout)
  - Check if 2/3 of stake is available

### "State divergence after sync"
- **Issue:** Merged states don't match
- **Solution:**
  - Verify Merkle proofs are being checked
  - Ensure domain merge operator is deterministic
  - Check for recent network partitions
  - Review sync job logs

---

## Performance Tuning

### Network Parameters

```javascript
// In InternetLayerCoordinator.constructor

// Adjust peer discovery depth (default: 2)
this.peerDiscovery.maxHops = 3;

// Adjust message cache size (default: 100KB)
this.router.cacheMaxSize = 1024 * 1024;  // 1MB

// Adjust consensus timeout (default: 10s)
this.consensus.viewChangeTimeout = 15000;

// Adjust sync parallelism
this.crossDomainSync.maxConcurrentSyncs = 5;
```

### Load Testing

```bash
# Create 100 nodes and run consensus
node examples/load-test.js --nodes 100 --duration 60s

# Simulate message flooding
node examples/stress-test.js --msg-per-sec 1000

# Measure routing latency
node examples/latency-test.js --samples 1000
```

---

## Security Checklist

- [ ] All identities registered before use
- [ ] Signatures verified on all incoming messages
- [ ] Routing capability requirements defined
- [ ] Slashing rules configured for your domain
- [ ] TTLs set appropriately for DNS records
- [ ] Peer trust scores monitored regularly
- [ ] Consensus view changes tested
- [ ] Merkle proof verification enabled
- [ ] Domain merge operation is deterministic
- [ ] Network partition recovery tested

---

## API Reference

### InternetLayerCoordinator

```javascript
// Lifecycle
await internet.bootstrap(seedNodes)
internet.connectDomain(domain)

// Network
const stats = internet.getNetworkStats()
await internet.sendToDomain(address, message, capability)

// DNS
internet.dns.registerName(name, address, ttl)
internet.dns.resolveName(name)
internet.dns.discoverService(service, domain)

// Consensus
const round = internet.consensus.startConsensusRound(proposal)
internet.consensus.on('consensus-reached', handler)

// Sync
const jobID = internet.crossDomainSync.initiateSync(remote, scope)
internet.crossDomainSync.on('sync-merged', handler)

// GAS
const identity = internet.gas.lookup(address)
internet.gas.reward(address, amount)
internet.gas.slash(address, amount)
```

---

## Example Deployments

### Trading Network
```
┌─────────────────────────────────────────────┐
│ Market Data Feed    Exchange       Settlement │
│ (quotes → prices)  (match trades) (settle)   │
├─────────────────────────────────────────────┤
│         Internet Protocol Layer              │
│  • Exchange publishes quotes via DNS         │
│  • Traders route orders with capability      │
│  • Settlement syncs with clearing house      │
│  • Consensus finalizes trades                │
└─────────────────────────────────────────────┘
```

### Multi-Agent Robotics
```
┌──────────────────────────────────────────────────┐
│  Robot A    Robot B    Robot C    Coordinator    │
│  (arm)      (vision)   (motion)   (planning)     │
├──────────────────────────────────────────────────┤
│         Internet Protocol Layer                  │
│  • Each robot registers service (e.g., "arm")   │
│  • Coordinator discovers services via DNS       │
│  • Commands routed with control capability      │
│  • States synchronized every consensus round    │
└──────────────────────────────────────────────────┘
```

### Supply Chain
```
┌─────────────────────────────────────────────────┐
│  Supplier  Warehouse  Distributor  Retailer    │
│  (mfg)     (inventory) (logistics) (sales)     │
├─────────────────────────────────────────────────┤
│      Internet Protocol Layer + JC Compute       │
│  • Each node consensus on inventory            │
│  • Cross-domain sync for state agreement       │
│  • Byzantine fault tolerance for 3+ parties    │
│  • Deterministic merge for conflicts           │
└─────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Build your domain** with the integration template above
2. **Run the test suite** to verify components
3. **Set up seed nodes** for bootstrap
4. **Deploy 3+ nodes** for Byzantine tolerance
5. **Register services** with DNS
6. **Monitor consensus** participation
7. **Test failure scenarios** (network partitions, Byzantine nodes)
8. **Tune parameters** for your workload
9. **Add application logic** on top of internet layer
10. **Scale to production** with more nodes and geographic distribution

Happy building! 🚀
