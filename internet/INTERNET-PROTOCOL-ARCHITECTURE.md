# JC Compute Internet Protocol Layer (v5+)

## Overview

The Internet Protocol Layer is a distributed networking stack built on top of JC Compute's authority-constrained deterministic causal computation model `(H, C, R, π, ⊔)`. It enables multiple JC Compute domains to communicate, synchronize, and reach consensus across an untrusted internet.

**Key Principle:** *Capability authority from JC Compute's `C` becomes the basis for routing, name resolution, and consensus participation.*

---

## Architecture Stack

```
┌─────────────────────────────────────────────┐
│     Application Layer (Domains)             │
│  (distributed-robotics, ai-agent-os, ...)   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Cross-Domain Synchronization (CDSP)        │
│  State merging using JC Compute's ⊔         │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│        Consensus Layer (rBFT)               │
│  Byzantine consensus on canonical states    │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│   Service Discovery (Distributed DNS)       │
│   Name → Address → Capability mapping       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│   Routing Layer (Capability-Based)          │
│   Route by capability authority, not just   │
│   network topology                          │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Peer Discovery & Topology (DHT-style)      │
│  Social-based peer prioritization           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│   Global Address Space (GAS)                │
│   Capability → Internet Identity            │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Network Layer (TCP/UDP + Encapsulation)    │
│  (physical network implementation)          │
└─────────────────────────────────────────────┘
```

---

## Layer 1: Global Address Space (GAS)

### Purpose
Maps JC Compute capabilities to globally unique internet addresses.

### Components

#### **InternetIdentity**
```javascript
class InternetIdentity {
  capability        // Authority from JC Compute (C)
  address          // Derived 20-byte hash (ji://...)
  publicKey        // Signing key derived from capability
  stake            // Network stake (slashable)
  reputation       // Trust score (-100 to +100)
  registeredAt     // Timestamp
}
```

**Address Derivation:** `address = SHA256(capability)`
- Stable: same capability always produces same address
- Unforgeable: requires knowing original capability
- Global: uniquely identifies across internet

#### **GlobalAddressSpace**
```javascript
class GlobalAddressSpace {
  register(identity)          // Add new internet identity
  lookup(address)             // Get identity by address
  slash(address, amount)      // Punish misbehavior
  reward(address, amount)     // Reward participation
  getTopStakePeers(count)     // Get leaders by stake
}
```

**Key Properties:**
- Only registered identities can participate
- Stake directly influences consensus participation
- Slashing for provable misbehavior
- No permissioned registration (open network)

---

## Layer 2: Peer Discovery & Topology

### Purpose
Build and maintain peer graph for network connectivity.

### Components

#### **PeerDiscovery**
```javascript
class PeerDiscovery {
  bootstrap()              // Connect to seed nodes
  addPeer(address, info)   // Track discovered peer
  recordSuccess(address)   // Mark peer as healthy
  recordFailure(address)   // Mark peer as failed
  getBestPeers(count)      // Get peers by reliability
}
```

**Discovery Algorithm:**
1. Start with seed nodes (bootstrap)
2. Query each peer for their neighbors
3. Multi-hop BFS with exponential backoff
4. Evaluate peers by trust score and latency
5. Prune dead peers after 3 failures

**Peer Info:**
```javascript
{
  address,              // ji://...
  lastSeen,            // Timestamp
  latency,             // RTT in ms
  trustScore,          // 0-1 based on behavior
  successCount,        // Successful connections
  failureCount         // Failed connections
}
```

---

## Layer 3: Capability-Based Routing (CBR)

### Purpose
Route messages based on capability authority, not just network addresses.

### Key Insight
**In JC Compute, authority is explicit.** The internet layer preserves this:
- Only nodes with required capability can forward messages
- Routing decisions are provably authorized
- No "blind" routing of untrusted messages

### Components

#### **CapabilityBasedRouter**
```javascript
class CapabilityBasedRouter {
  findRoute(destination, requiredCapability)  // Route with auth check
  forwardMessage(message, route)              // Forward along route
  hasCapability(capability, required)         // Authority check
}
```

**Routing Algorithm (BFS with capability filter):**
1. Start from local node
2. Explore neighbors in BFS order
3. For each neighbor, check: `neighbor.capability ⊇ requiredCapability`
4. Only forward through authorized nodes
5. Return shortest authorized path

**Example:**
```
Goal: Send financial transaction to domain with "settle-funds" capability

Route found: A(banker) → B(trusted-relay) → C(settlement)
  - A has { financial: admin }
  - B has { financial: relay }
  - C has { financial: settle-funds }
  
Each hop verifies successor has capability before forwarding.
```

### Message Deduplication
Hash-based cache prevents loops: `cache[msgID] = timestamp`

---

## Layer 4: Distributed Name Service (DNS)

### Purpose
Map human-readable names to addresses and capabilities.

### Features

#### **Name Resolution**
```javascript
resolveName("exchange.finance.jc")  
  → { address: "ji://...", identity, ttl: 3600 }
```

#### **Reverse Resolution**
```javascript
reverseResolve("ji://...")
  → Set { "exchange.finance.jc", "trader.finance.jc" }
```

#### **Service Discovery**
```javascript
discoverService("settlement", "finance.jc")
  → Finds all "*.settlement.finance.jc" addresses
```

#### **TLD System**
- `.jc` - JC Compute core services
- `.compute` - Compute-specific services
- Custom TLDs managed by reputation-weighted nodes

**Name Record:**
```javascript
{
  name: "service.domain.tld",
  address: "ji://...",
  registeredBy: "ji://...",
  registeredAt: timestamp,
  expiresAt: timestamp,
  ttl: seconds
}
```

### TTL Handling
- Names expire after TTL
- No perpetual registration required
- Prevents stale records
- Encourages regular re-confirmation

---

## Layer 5: Byzantine Fault-Tolerant Consensus

### Purpose
Coordinate canonical state across distributed domains without trusted third parties.

### Algorithm: Reduced Byzantine Fault Tolerance (rBFT)

**Tolerances:**
- `n` = number of nodes (by stake)
- `f` = `floor(n/3)` = max Byzantine nodes
- Quorum = `2f + 1` = `2⌊n/3⌋ + 1`

**Example with n=10 nodes:**
- Max Byzantine: f = 3
- Required quorum: 7 nodes
- Tolerance: 30% malicious

**Phases:**

```
PREPARE phase (1 round):
  1. Leader proposes candidate block
  2. All nodes send PREPARE if valid
  3. When leader gets 2f+1 prepares, can commit
  
COMMIT phase (1 round):
  1. Leader broadcasts "I have prepares"
  2. All nodes send COMMIT
  3. When leader gets 2f+1 commits, block is final
  
VIEW CHANGE (on timeout):
  1. Select next leader from top-stake peers
  2. Current view → view+1
  3. Restart consensus
```

**Implementation:**
```javascript
class ReducedByzantineFT {
  startConsensusRound(proposal)      // Initiate new round
  processPrepare(msgHash, signer)    // Handle prepare msg
  processCommit(msgHash, signer)     // Handle commit msg
  changeView()                        // Leader timeout → view+1
}
```

**Safety:** No two commits for conflicting blocks (by quorum overlap)
**Liveness:** View change ensures eventual progress

---

## Layer 6: Cross-Domain Synchronization Protocol (CDSP)

### Purpose
Synchronize JC Compute domain states across internet using the merge operator `⊔`.

### Synchronization Flow

```
LocalDomain                    RemoteDomain
     │                               │
     ├─────(1) Initiate Sync────────>│
     │                               │
     │<────(2) Remote Checkpoint─────┤
     │          + Merkle Proof       │
     │                               │
     ├─(3) Verify & Compute Delta───>│
     │                               │
     ├─(4) Merge State using ⊔──────>│
     │      (JC Compute merge)       │
     │                               │
     │<─(5) Commitment + Proof───────┤
     │                               │
     ├─(6) Apply Merged State───────>│
     │                               │
    Convergence Achieved
```

### Components

#### **SyncJob**
```javascript
{
  jobID,                 // Unique identifier
  remoteDomain,          // Target address
  status,                // pending → merged → committed
  localCheckpoint,       // (H, C, R, π, ⊔) state
  remoteCheckpoint,      // Remote domain state
  delta,                 // Difference (events, updates)
  mergedState            // Result of local ⊔ delta
}
```

#### **Delta Computation**
```javascript
computeDelta(localCheckpoint, remoteCheckpoint)
  → { 
      newEvents: [...],   // Events only in remote
      updates: {...},     // State updates
      timestamp: now
    }
```

#### **State Merge**
Uses JC Compute's merge operator `⊔`:

```javascript
mergedState = localDomain.merge(
  localCheckpoint,    // (H_local, C, R, π, ⊔)
  delta,              // Difference set
  remoteCheckpoint    // (H_remote, C, R, π, ⊔)
)
```

**Properties Preserved:**
- **Idempotent:** merge(X, Y) = merge(merge(X, Y), Y)
- **Commutative:** merge(X, Y) = merge(Y, X)
- **Associative:** merge(merge(X, Y), Z) = merge(X, merge(Y, Z))
- **Deterministic:** Same inputs → same output

### Verification
- Merkle proofs ensure data integrity
- Signatures verify message authenticity
- Convergence proofs show final state consistency

---

## Layer 7: Network Incentives

### Purpose
Encourage honest participation and punish misbehavior.

### Reward Mechanisms

#### **Participation Rewards**
```javascript
rewardParticipation(address, type, amount)
  // Types: consensus, relay, discovery, synchronization
```

- Nodes that participate in consensus
- Nodes that relay messages honestly
- Nodes that provide discovery information
- Nodes that sync state successfully

#### **Reputation System**
- Successful participation → reputation +1
- Consensus participation → stake increase
- Misbehavior → reputation decrease

### Slashing Rules

```javascript
addSlashRule({
  condition: (evidence) => evidence.type === 'double-sign',
  slashAmount: 100,           // Percent of stake
  description: 'Double signing detected'
})
```

**Slash Conditions:**
1. **Double Signing** (100%)
   - Two different blocks signed in same round
   - Proof: Both block hashes + both signatures

2. **Extended Downtime** (10%)
   - Miss >50 consensus rounds
   - Proof: View history + blockchain record

3. **Capability Violation** (50%)
   - Route message without required capability
   - Proof: Message + capability check

4. **Merkle Fraud** (50%)
   - Invalid Merkle proof submitted
   - Proof: Proof verification failure

---

## Integration with JC Compute Domains

### Domain Connection
```javascript
internet.connectDomain(domain)
```

Adds callbacks:
- `onStateChange` → Initiate sync with peers
- `onMergeComplete` → Update local state
- `onCapabilityUpdate` → Refresh routing tables

### Message Flow
```
Application Layer
       ↓
domain.sendMessage(target, data)
       ↓
Internet Layer
  - Check capability (C)
  - Find route
  - Verify signatures
  - Forward through peers
       ↓
Remote Domain
  - Verify sender authority
  - Apply to history (H)
  - Run reducer (R)
  - Get view (π)
```

### State Convergence
```
Domain A: state_A                Domain B: state_B
             ├─────Sync────────────┤
             │   CDSP + Merkle     │
             │                     │
             └──────Merge──────────┘
               mergedState = A ⊔ B
             ├─────Sync────────────┤
             │  Verify convergence │
             │                     │
Domain A: state_A ⊔ B        Domain B: state_A ⊔ B
         (Converged)              (Converged)
```

---

## Data Structures

### InternetIdentity
```
├─ capability: Object (authority specification)
├─ address: String (ji://[40 hex chars])
├─ publicKey: String (hex)
├─ stake: Number (slashable amount)
├─ reputation: Number (-100 to 100)
└─ registeredAt: Number (timestamp)
```

### RouteInfo
```
├─ destination: String (address)
├─ path: Array<String> (addresses in path)
├─ hopCount: Number
├─ capability: Object (required authority)
└─ authorized: Boolean
```

### Message
```
├─ id: String (unique)
├─ from: String (address)
├─ to: String (address)
├─ payload: Object (application data)
├─ route: Array<String> (remaining hops)
├─ signature: String (from node)
└─ timestamp: Number
```

### SyncJob
```
├─ jobID: String
├─ remoteDomain: String (address)
├─ status: String (pending|merged|committed)
├─ localCheckpoint: Object (state snapshot)
├─ remoteCheckpoint: Object (state snapshot)
├─ delta: Object ({ newEvents, updates })
├─ mergedState: Object (result)
└─ merkleProof: Object ({ root, path })
```

---

## Threat Model

### Assumptions
1. **Honest Majority by Stake:** >66% of stake is controlled by non-Byzantine nodes
2. **Cryptographic Soundness:** SHA256, HMAC-SHA256 are secure
3. **Network:** Asynchronous, lossy, but eventually delivers
4. **Identities:** Capability derivation is unforgeable

### Protected Against

#### 1. **Sybil Attacks**
- Mitigation: Capability derivation makes multiple identities expensive
- Cost: Each identity requires unique capability
- Monitor: Watch for capability reuse

#### 2. **Eclipse Attacks**
- Mitigation: Multi-hop discovery + social-based peer selection
- Monitor: Track peer diversity in network topology

#### 3. **Double Spending / Fork**
- Mitigation: Consensus quorum (2/3 + 1)
- Property: Only one canonical block per view
- Proof: Merkle root commitment

#### 4. **State Divergence**
- Mitigation: CDSP with Merkle verification
- Property: Deterministic merge ensures same final state
- Monitor: Compare hashes with peers

#### 5. **Capability Violation**
- Mitigation: Authorization check at each hop
- Property: Message authenticated by sender
- Monitor: Verify signature matches capability

### Known Limitations

1. **View Change Safety:** If >1/3 Byzantine in view, may lose liveness
   - Mitigation: Monitor consensus stall, trigger view change

2. **Name Squatting:** Fast node can register desirable names
   - Mitigation: Reputation weighting, TLD governance

3. **Long-Range Attacks:** Historic capability could be replayed
   - Mitigation: TTL on addresses, checkpoint rotation

---

## Usage Examples

### Example 1: Bootstrapping a Node

```javascript
const { InternetLayerCoordinator } = require('./jc-compute-internet-protocol');

// Create node with capability
const internet = new InternetLayerCoordinator(
  { financial: 'trader', settle: 'pending' },
  { stake: 1000 }
);

// Bootstrap from seed nodes
await internet.bootstrap([
  'ji://seed1-address-here40chars',
  'ji://seed2-address-here40chars'
]);

console.log(internet.getNetworkStats());
// {
//   localAddress: 'ji://my-address-here40chars',
//   peersConnected: 47,
//   registeredAddresses: 523,
//   stake: 1000,
//   reputation: 0
// }
```

### Example 2: Name Registration

```javascript
// Register a service
internet.dns.registerTLD('finance', internet.localIdentity.address);
internet.dns.registerName('settlement.finance.jc', myAddress, 3600);

// Later: Discover the service
const resolved = internet.dns.discoverService('settlement', 'finance.jc');
console.log(resolved.address);  // ji://settlement-address-40chars
```

### Example 3: Capability-Based Routing

```javascript
// Send message to node that can settle trades
const message = {
  id: crypto.randomBytes(8).toString('hex'),
  payload: { trade: 'AAPL-MSFT' }
};

try {
  const { route, forwarded } = await internet.sendToDomain(
    'ji://settlement-address-here',
    message,
    { settle: 'confirmed' }  // Required capability
  );
  
  console.log(`Routed through ${route.path.length} hops`);
} catch (err) {
  console.error('No route with required capability:', err);
}
```

### Example 4: Domain Synchronization

```javascript
// Connect domain to internet
const myDomain = new JCComputeDomain({ name: 'trading-bot' });
internet.connectDomain(myDomain);

// Initiate sync with peer
const jobID = internet.crossDomainSync.initiateSync(
  'ji://peer-domain-address-here',
  'trading-state'
);

// Wait for merge
internet.crossDomainSync.on('sync-merged', (job) => {
  console.log('States converged:', job.mergedState);
  internet.crossDomainSync.mergeStates(job.jobID);
});
```

### Example 5: Consensus Participation

```javascript
// Create consensus proposal
const proposal = {
  type: 'settle-batch',
  trades: [/* ... */],
  timestamp: Date.now()
};

// Start round
const round = internet.consensus.startConsensusRound(proposal);
console.log(`Consensus view ${round.view}, need ${round.quorumSize} nodes`);

// Listen for convergence
internet.consensus.on('consensus-reached', (result) => {
  console.log(`Proposal committed with ${result.signers.size} signatures`);
});
```

---

## Performance Characteristics

### Network Latency
- **Peer Discovery:** O(log N) hops (DHT-style)
- **Message Routing:** O(D) hops (D = path length)
- **Consensus Round:** O(1) rounds (with honest leader)
- **View Change:** O(N) rounds (broadcast to all)

### Computation
- **Route Finding:** O(N + E) BFS (N nodes, E edges)
- **Capability Check:** O(K) where K = capability size
- **Merkle Proof:** O(log N) hash computations
- **State Merge:** O(|ΔH|) where |ΔH| = delta history

### Storage
- **GAS:** O(N) identities
- **Routing Table:** O(N²) worst case (full mesh)
- **Message Cache:** O(M) messages (M = cache size, ~100KB)
- **Name Records:** O(S) services (S = service count)

### Scalability Limits
- **Honest Majority:** Requires 2/3 non-Byzantine stake (fixed)
- **Message Load:** Scales with consensus views (limited by network)
- **Storage:** Grows with network size and history retention

---

## Future Extensions

### Sharding
```
Partition GAS into shards
  shard 0: addresses [0x00...0x40)
  shard 1: addresses [0x40...0x80)
  ...
Each shard runs independent consensus
Merkle commitments on shard roots
```

### Privacy Layer
```
Encrypted routing with onion addresses
Zero-knowledge proofs of capability
Private state channels (single hop)
```

### Light Clients
```
SPV (Simplified Payment Verification) style
Headers only: 80 bytes per consensus round
Capability proofs via Merkle tree
```

### Interop with Other Networks
```
Atomic swaps with Bitcoin/Ethereum
Cross-chain bridges via oracles
Canonical state on multiple chains
```

---

## Testing & Verification

### Unit Tests
```javascript
// test capability derivation
assert(id1.address === id2.address, 'Stable address derivation');

// test GAS slashing
gas.slash(addr, 100);
assert(gas.lookup(addr).stake < original, 'Stake decreased');

// test routing authorization
const route = router.findRoute(dest, { settle: 'confirmed' });
assert(route !== null, 'Found authorized route');

// test merge idempotence
assert(
  JSON.stringify(merge(X, Y)) === 
  JSON.stringify(merge(merge(X, Y), Y)),
  'Merge is idempotent'
);
```

### Integration Tests
```javascript
// Spin up 10-node test network
const nodes = [...Array(10)].map(() => new InternetLayerCoordinator(...));

// Run consensus with Byzantine node
nodes[5].byzantine = true;  // Node 5 sends conflicting votes

// Verify: no fork despite Byzantine node
assert(nodes.map(n => n.canonicalRoot).every(r => r === nodes[0].canonicalRoot),
  'Consensus despite Byzantine');
```

### Formal Verification
```lean
theorem ConsensusJustness: ∀ (nodes : List Node),
  (countByteantine nodes < nodes.length / 3) →
  (∀ (v : View), exitsOneCanonicalBlock v)
```

---

## Conclusion

The Internet Protocol Layer elevates JC Compute from a theoretical model to a practical distributed system that can coordinate multiple domains across an untrusted internet. By grounding routing, naming, and consensus in capability authority, it preserves JC Compute's formal guarantees while enabling real-world deployment.

**Key Innovation:** *Authority is not erased by networking; it becomes the foundation.*
