/**
 * JC Compute Internet Protocol Layer - Tests & Examples
 * 
 * Comprehensive test suite and integration examples demonstrating:
 * - Identity and address derivation
 * - Global address space operations
 * - Peer discovery and topology
 * - Capability-based routing
 * - Byzantine consensus
 * - Distributed name service
 * - Cross-domain synchronization
 */

const assert = require('assert');
const crypto = require('crypto');
const {
  InternetIdentity,
  GlobalAddressSpace,
  PeerDiscovery,
  CapabilityBasedRouter,
  ReducedByzantineFT,
  DistributedNameService,
  CrossDomainSync,
  NetworkIncentives,
  InternetLayerCoordinator
} = require('./jc-compute-internet-protocol');

// ==================== TEST SUITE ====================

class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }
  
  test(name, fn) {
    this.tests.push({ name, fn });
  }
  
  async run() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  JC Internet Protocol - Test Suite    ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    for (const { name, fn } of this.tests) {
      try {
        await fn();
        console.log(`✓ ${name}`);
        this.passed++;
      } catch (err) {
        console.error(`✗ ${name}`);
        console.error(`  ${err.message}`);
        this.failed++;
      }
    }
    
    console.log(`\n${this.passed} passed, ${this.failed} failed\n`);
    return this.failed === 0;
  }
}

const tests = new TestRunner();

// ==================== INTERNET IDENTITY TESTS ====================

tests.test('InternetIdentity creates stable address from capability', () => {
  const capability = { financial: 'trader', settle: 'confirmed' };
  
  const id1 = new InternetIdentity(capability, { stake: 1000 });
  const id2 = new InternetIdentity(capability, { stake: 2000 });
  
  assert.strictEqual(
    id1.address,
    id2.address,
    'Same capability should produce same address'
  );
});

tests.test('InternetIdentity derives unforgeable public key', () => {
  const cap1 = { financial: 'trader' };
  const cap2 = { financial: 'maker' };
  
  const id1 = new InternetIdentity(cap1);
  const id2 = new InternetIdentity(cap2);
  
  assert.notStrictEqual(
    id1.publicKey,
    id2.publicKey,
    'Different capabilities should produce different keys'
  );
});

tests.test('InternetIdentity signs and verifies messages', () => {
  const identity = new InternetIdentity({ financial: 'trader' });
  
  const message = { action: 'trade', volume: 100 };
  const signature = identity.sign(message);
  
  assert(
    identity.verify(message, signature),
    'Valid signature should verify'
  );
  
  message.volume = 200; // Tamper
  assert(
    !identity.verify(message, signature),
    'Tampered message should fail verification'
  );
});

// ==================== GLOBAL ADDRESS SPACE TESTS ====================

tests.test('GlobalAddressSpace registers and looks up identities', () => {
  const gas = new GlobalAddressSpace();
  const id = new InternetIdentity({ financial: 'trader' });
  
  const address = gas.register(id);
  const lookedUp = gas.lookup(address);
  
  assert.strictEqual(
    lookedUp.publicKey,
    id.publicKey,
    'Should retrieve registered identity'
  );
});

tests.test('GlobalAddressSpace prevents blacklisted registration', () => {
  const gas = new GlobalAddressSpace();
  const id = new InternetIdentity({ financial: 'trader' });
  
  gas.register(id);
  gas.blacklist.add(id.address);
  
  const id2 = new InternetIdentity({ financial: 'trader' }, { stake: 500 });
  
  assert.throws(
    () => gas.register(id2),
    'Should not register blacklisted address'
  );
});

tests.test('GlobalAddressSpace slashing reduces stake and reputation', () => {
  const gas = new GlobalAddressSpace();
  const id = new InternetIdentity({ test: true }, { stake: 1000, reputation: 50 });
  
  gas.register(id);
  const originalStake = id.stake;
  
  gas.slash(id.address, 100);
  
  assert(
    id.stake < originalStake,
    'Stake should decrease after slashing'
  );
  assert(
    id.reputation < 50,
    'Reputation should decrease after slashing'
  );
});

tests.test('GlobalAddressSpace rewards participation', () => {
  const gas = new GlobalAddressSpace();
  const id = new InternetIdentity({ test: true }, { stake: 1000, reputation: 0 });
  
  gas.register(id);
  const originalReputation = id.reputation;
  
  gas.reward(id.address, 50);
  
  assert(
    id.stake > 1000,
    'Stake should increase after reward'
  );
  assert(
    id.reputation > originalReputation,
    'Reputation should increase after reward'
  );
});

tests.test('GlobalAddressSpace ranks peers by stake', () => {
  const gas = new GlobalAddressSpace();
  
  // Register peers with different stakes
  const peers = [
    { stake: 100, cap: { id: 'a' } },
    { stake: 500, cap: { id: 'b' } },
    { stake: 250, cap: { id: 'c' } },
    { stake: 1000, cap: { id: 'd' } }
  ];
  
  peers.forEach(p => gas.register(new InternetIdentity(p.cap, { stake: p.stake })));
  
  const topPeers = gas.getTopStakePeers(2);
  assert.strictEqual(topPeers.length, 2, 'Should return requested count');
  
  const topStakes = topPeers.map(addr => gas.lookup(addr).stake);
  assert(topStakes[0] >= topStakes[1], 'Should rank by stake descending');
});

// ==================== PEER DISCOVERY TESTS ====================

tests.test('PeerDiscovery bootstraps from seed nodes', async () => {
  const gas = new GlobalAddressSpace();
  const localId = new InternetIdentity({ test: 'local' });
  const localPeerDiscovery = new PeerDiscovery(localId, gas);
  
  // Create seed nodes
  const seed1 = new InternetIdentity({ test: 'seed1' });
  const seed2 = new InternetIdentity({ test: 'seed2' });
  
  gas.register(seed1);
  gas.register(seed2);
  
  localPeerDiscovery.addSeedNodes([seed1.address, seed2.address]);
  await localPeerDiscovery.bootstrap();
  
  assert(
    localPeerDiscovery.bootstrapped,
    'Should mark as bootstrapped'
  );
  assert(
    localPeerDiscovery.peers.size > 0,
    'Should have discovered peers'
  );
});

tests.test('PeerDiscovery tracks peer health', async () => {
  const gas = new GlobalAddressSpace();
  const localId = new InternetIdentity({ test: 'local' });
  const pd = new PeerDiscovery(localId, gas);
  
  const peerId = new InternetIdentity({ test: 'peer' });
  gas.register(peerId);
  
  await pd.addPeer(peerId.address, { latency: 50, trustScore: 0.8 });
  
  // Record success
  pd.recordSuccess(peerId.address);
  const peer = pd.peers.get(peerId.address);
  assert.strictEqual(peer.successCount, 1, 'Should increment success count');
  
  // Record failure
  pd.recordFailure(peerId.address);
  assert.strictEqual(peer.failureCount, 1, 'Should increment failure count');
});

tests.test('PeerDiscovery removes dead peers', async () => {
  const gas = new GlobalAddressSpace();
  const localId = new InternetIdentity({ test: 'local' });
  const pd = new PeerDiscovery(localId, gas);
  
  const peerId = new InternetIdentity({ test: 'peer' });
  gas.register(peerId);
  
  await pd.addPeer(peerId.address, { latency: 50, trustScore: 0.8 });
  assert(pd.peers.has(peerId.address), 'Peer should be added');
  
  // Record multiple failures
  for (let i = 0; i < 4; i++) {
    pd.recordFailure(peerId.address);
  }
  
  assert(
    !pd.peers.has(peerId.address),
    'Dead peer should be removed after 3 failures'
  );
});

// ==================== CAPABILITY-BASED ROUTING TESTS ====================

tests.test('CapabilityBasedRouter checks authority before routing', () => {
  const gas = new GlobalAddressSpace();
  const localId = new InternetIdentity({ financial: 'router' });
  const router = new CapabilityBasedRouter(localId, gas);
  
  const destId = new InternetIdentity({ financial: 'settle-confirmed' });
  gas.register(destId);
  
  // Route with matching capability
  const route1 = router.findRoute(
    destId.address,
    { financial: 'settle-confirmed' }
  );
  assert(route1 !== null, 'Should find route with capability');
  
  // Route with missing capability
  const route2 = router.findRoute(
    destId.address,
    { financial: 'settle-admin' }
  );
  assert(route2 === null, 'Should reject route without capability');
});

tests.test('CapabilityBasedRouter deduplicates messages', () => {
  const gas = new GlobalAddressSpace();
  const localId = new InternetIdentity({ test: 'router' });
  const router = new CapabilityBasedRouter(localId, gas);
  
  const destId = new InternetIdentity({ test: 'dest' });
  gas.register(destId);
  
  const message = { id: 'msg-123', payload: 'test' };
  const route = { path: ['a', destId.address] };
  
  // First forward succeeds
  const fwd1 = router.forwardMessage(message, route);
  assert(fwd1 !== null, 'First forward should succeed');
  
  // Second forward of same message fails (dedup)
  const fwd2 = router.forwardMessage(message, route);
  assert(fwd2 === null, 'Duplicate message should be rejected');
});

// ==================== CONSENSUS TESTS ====================

tests.test('ReducedByzantineFT computes correct quorum size', () => {
  const gas = new GlobalAddressSpace();
  const localId = new InternetIdentity({ test: 'local' });
  const pd = new PeerDiscovery(localId, gas);
  const consensus = new ReducedByzantineFT(localId, gas, pd);
  
  // Register 10 peers
  for (let i = 0; i < 10; i++) {
    const id = new InternetIdentity({ test: `peer${i}` }, { stake: 100 });
    gas.register(id);
  }
  
  const proposal = { type: 'test' };
  const round = consensus.startConsensusRound(proposal);
  
  assert.strictEqual(
    round.quorumSize,
    7,
    'Quorum for 10 nodes should be 7 (2/3 + 1)'
  );
  assert.strictEqual(
    round.maxByzantine,
    3,
    'Max Byzantine for 10 nodes should be 3'
  );
});

tests.test('ReducedByzantineFT triggers consensus on quorum', (done) => {
  const gas = new GlobalAddressSpace();
  const localId = new InternetIdentity({ test: 'local' });
  const pd = new PeerDiscovery(localId, gas);
  const consensus = new ReducedByzantineFT(localId, gas, pd);
  
  // Register peers
  const peers = [];
  for (let i = 0; i < 7; i++) {
    const id = new InternetIdentity({ test: `peer${i}` });
    gas.register(id);
    peers.push(id.address);
  }
  
  const proposal = { type: 'test' };
  const round = consensus.startConsensusRound(proposal);
  
  consensus.on('consensus-reached', (result) => {
    assert(result.signers.size >= round.quorumSize, 'Should have quorum');
    done();
  });
  
  // Simulate quorum of commits
  for (let i = 0; i < 7; i++) {
    consensus.processCommit(round.msgHash, peers[i], round.view);
  }
});

tests.test('ReducedByzantineFT changes view on leader timeout', () => {
  const gas = new GlobalAddressSpace();
  const localId = new InternetIdentity({ test: 'local' });
  const pd = new PeerDiscovery(localId, gas);
  const consensus = new ReducedByzantineFT(localId, gas, pd);
  
  // Register peers
  for (let i = 0; i < 10; i++) {
    const id = new InternetIdentity({ test: `peer${i}` }, { stake: 100 });
    gas.register(id);
  }
  
  const view0 = consensus.currentView;
  consensus.changeView();
  
  assert(
    consensus.currentView > view0,
    'View should increment'
  );
  assert(
    consensus.currentLeader !== null,
    'New leader should be selected'
  );
});

// ==================== DNS TESTS ====================

tests.test('DistributedNameService registers and resolves names', () => {
  const gas = new GlobalAddressSpace();
  const localId = new InternetIdentity({ test: 'local' });
  const pd = new PeerDiscovery(localId, gas);
  const consensus = new ReducedByzantineFT(localId, gas, pd);
  const dns = new DistributedNameService(localId, gas, consensus);
  
  // Register TLD
  dns.registerTLD('test', localId.address);
  
  // Register service
  const targetId = new InternetIdentity({ test: 'service' });
  gas.register(targetId);
  
  dns.registerName('myservice.test.test', targetId.address, 3600);
  
  // Resolve
  const resolved = dns.resolveName('myservice.test.test');
  assert(resolved !== null, 'Should resolve registered name');
  assert.strictEqual(
    resolved.address,
    targetId.address,
    'Should return correct address'
  );
});

tests.test('DistributedNameService expires TTL', (done) => {
  const gas = new GlobalAddressSpace();
  const localId = new InternetIdentity({ test: 'local' });
  const pd = new PeerDiscovery(localId, gas);
  const consensus = new ReducedByzantineFT(localId, gas, pd);
  const dns = new DistributedNameService(localId, gas, consensus);
  
  dns.registerTLD('test', localId.address);
  const targetId = new InternetIdentity({ test: 'service' });
  gas.register(targetId);
  
  // Register with 100ms TTL
  dns.registerName('short-lived.test.test', targetId.address, 0.1);
  
  assert(dns.resolveName('short-lived.test.test') !== null, 'Should resolve initially');
  
  // Check after expiry
  setTimeout(() => {
    const resolved = dns.resolveName('short-lived.test.test');
    assert(resolved === null, 'Should return null after TTL expiry');
    done();
  }, 150);
});

tests.test('DistributedNameService reverse lookup', () => {
  const gas = new GlobalAddressSpace();
  const localId = new InternetIdentity({ test: 'local' });
  const pd = new PeerDiscovery(localId, gas);
  const consensus = new ReducedByzantineFT(localId, gas, pd);
  const dns = new DistributedNameService(localId, gas, consensus);
  
  dns.registerTLD('test', localId.address);
  const targetId = new InternetIdentity({ test: 'service' });
  gas.register(targetId);
  
  dns.registerName('service1.test.test', targetId.address);
  dns.registerName('service2.test.test', targetId.address);
  
  const names = dns.reverseResolve(targetId.address);
  assert.strictEqual(
    names.size,
    2,
    'Should return all names for address'
  );
});

// ==================== CROSS-DOMAIN SYNC TESTS ====================

tests.test('CrossDomainSync initiates sync job', () => {
  const gas = new GlobalAddressSpace();
  const localId = new InternetIdentity({ test: 'local' });
  const pd = new PeerDiscovery(localId, gas);
  const consensus = new ReducedByzantineFT(localId, gas, pd);
  const router = new CapabilityBasedRouter(localId, gas);
  
  const coordinator = {
    gasService: gas,
    peerDiscovery: pd
  };
  
  const mockDomain = {
    name: 'test-domain',
    getCurrentCheckpoint: () => ({ state: 'initial' })
  };
  
  const cdsp = new CrossDomainSync(mockDomain, coordinator);
  
  const remoteId = new InternetIdentity({ test: 'remote' });
  gas.register(remoteId);
  
  const jobID = cdsp.initiateSync(remoteId.address, 'all');
  
  assert(cdsp.syncJobs.has(jobID), 'Should create sync job');
  const job = cdsp.syncJobs.get(jobID);
  assert.strictEqual(job.status, 'pending', 'Job should start as pending');
});

tests.test('CrossDomainSync merges states', () => {
  const gas = new GlobalAddressSpace();
  const localId = new InternetIdentity({ test: 'local' });
  const pd = new PeerDiscovery(localId, gas);
  const consensus = new ReducedByzantineFT(localId, gas, pd);
  
  const mockDomain = {
    name: 'test-domain',
    getCurrentCheckpoint: () => ({ state: 'initial' }),
    merge: (local, delta, remote) => ({
      state: 'merged',
      from_local: local.state,
      from_remote: remote ? remote.state : null
    })
  };
  
  const coordinator = { gasService: gas, peerDiscovery: pd };
  const cdsp = new CrossDomainSync(mockDomain, coordinator);
  
  const remoteId = new InternetIdentity({ test: 'remote' });
  gas.register(remoteId);
  
  const jobID = cdsp.initiateSync(remoteId.address);
  const job = cdsp.syncJobs.get(jobID);
  
  // Process remote checkpoint
  const remoteCheckpoint = { state: 'remote-state' };
  cdsp.processRemoteCheckpoint(jobID, remoteCheckpoint, { root: 'root', path: [] });
  
  // Merge
  cdsp.mergeStates(jobID);
  
  assert.strictEqual(job.status, 'merged', 'Job should be merged');
  assert(job.mergedState !== null, 'Should have merged state');
});

// ==================== INTEGRATION TESTS ====================

tests.test('InternetLayerCoordinator full integration', async () => {
  const coordinator = new InternetLayerCoordinator(
    { test: 'coordinator' },
    { stake: 1000 }
  );
  
  assert(
    coordinator.localIdentity.address.startsWith('ji://'),
    'Should have internet address'
  );
  assert(
    coordinator.gas.lookup(coordinator.localIdentity.address) !== null,
    'Should be registered in GAS'
  );
  
  const stats = coordinator.getNetworkStats();
  assert.strictEqual(stats.stake, 1000, 'Should have correct stake');
});

tests.test('Multi-node network consensus', async () => {
  const nodes = [];
  
  // Create 10 nodes
  for (let i = 0; i < 10; i++) {
    nodes.push(
      new InternetLayerCoordinator(
        { consensus: `node${i}` },
        { stake: 100 + Math.random() * 900 }
      )
    );
  }
  
  // Register all in shared GAS
  const sharedGAS = nodes[0].gas;
  for (const node of nodes.slice(1)) {
    sharedGAS.register(node.localIdentity);
  }
  
  // Get top peers
  const topPeers = sharedGAS.getTopStakePeers(5);
  assert.strictEqual(topPeers.length, 5, 'Should get top 5 peers');
  
  // All nodes should have same top peers (deterministic)
  const topStakes = topPeers.map(addr => sharedGAS.lookup(addr).stake);
  for (let i = 1; i < topStakes.length; i++) {
    assert(
      topStakes[i] <= topStakes[i - 1],
      'Should rank by stake descending'
    );
  }
});

// ==================== RUN TESTS ====================

async function main() {
  const success = await tests.run();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { tests };
