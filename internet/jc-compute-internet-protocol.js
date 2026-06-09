/**
 * JC Compute Internet Protocol Layer (v5+)
 * 
 * A distributed networking stack built on top of JC Compute's authority-constrained
 * deterministic causal computation model.
 * 
 * This layer provides:
 * - Global address space (GAS) with capability-based routing
 * - Peer discovery and topology management
 * - Byzantine fault-tolerant consensus (HotStuff-style)
 * - Distributed name service (DNS analogue)
 * - Cross-domain synchronization
 * - Incentive-compatible routing
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

// ==================== INTERNET IDENTITY ====================

/**
 * Global Internet Identity (GII)
 * 
 * Maps capability authority to internet addresses.
 * Based on JC Compute's (H, C, R, π, ⊔) with network extensions.
 */
class InternetIdentity {
  constructor(capability, metadata = {}) {
    this.capability = capability; // Authority from C in (H,C,R,π,⊔)
    this.metadata = metadata;
    
    // Derive stable internet address from capability
    this.address = this.deriveAddress(capability);
    this.publicKey = this.derivePublicKey(capability);
    
    // Network reputation/stake
    this.stake = metadata.stake || 0;
    this.reputation = metadata.reputation || 0;
    this.registeredAt = metadata.registeredAt || Date.now();
  }
  
  deriveAddress(capability) {
    // Hash capability into 20-byte internet address (similar to IP but longer)
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(capability))
      .digest();
    return 'ji://' + hash.toString('hex').slice(0, 40); // 20-byte hex
  }
  
  derivePublicKey(capability) {
    // Derive signing key from capability
    const seed = crypto
      .createHash('sha256')
      .update(JSON.stringify(capability) + 'pubkey')
      .digest();
    return seed.toString('hex');
  }
  
  /**
   * Sign a message with this identity's capability
   */
  sign(message) {
    const hmac = crypto.createHmac('sha256', this.publicKey);
    hmac.update(JSON.stringify(message));
    return hmac.digest('hex');
  }
  
  /**
   * Verify a signature was created by this identity
   */
  verify(message, signature) {
    const expected = this.sign(message);
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  }
}

// ==================== GLOBAL ADDRESS SPACE ====================

/**
 * Global Address Space (GAS)
 * 
 * Distributed address registry with capability-based authorization.
 * Maintains mapping: Internet Address -> (Capability, PublicKey, Stake)
 */
class GlobalAddressSpace extends EventEmitter {
  constructor() {
    super();
    this.addresses = new Map(); // address -> InternetIdentity
    this.byCapability = new Map(); // capability hash -> address
    this.blacklist = new Set();
  }
  
  /**
   * Register a new internet identity
   */
  register(internetIdentity) {
    if (this.blacklist.has(internetIdentity.address)) {
      throw new Error('Address is blacklisted');
    }
    
    this.addresses.set(internetIdentity.address, internetIdentity);
    const capHash = this.hashCapability(internetIdentity.capability);
    this.byCapability.set(capHash, internetIdentity.address);
    
    this.emit('registered', {
      address: internetIdentity.address,
      stake: internetIdentity.stake,
      time: Date.now()
    });
    
    return internetIdentity.address;
  }
  
  /**
   * Look up identity by internet address
   */
  lookup(address) {
    return this.addresses.get(address);
  }
  
  /**
   * Slashing for misbehavior
   */
  slash(address, amount) {
    const identity = this.addresses.get(address);
    if (!identity) return false;
    
    identity.stake = Math.max(0, identity.stake - amount);
    identity.reputation = Math.max(-100, identity.reputation - 5);
    
    if (identity.stake <= 0) {
      this.blacklist.add(address);
      this.addresses.delete(address);
    }
    
    return true;
  }
  
  /**
   * Reward for correct behavior
   */
  reward(address, amount) {
    const identity = this.addresses.get(address);
    if (!identity) return false;
    
    identity.stake += amount;
    identity.reputation = Math.min(100, identity.reputation + 1);
    return true;
  }
  
  hashCapability(capability) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(capability))
      .digest('hex');
  }
  
  /**
   * Get all registered addresses (for peer discovery)
   */
  getAllAddresses() {
    return Array.from(this.addresses.keys());
  }
  
  /**
   * Get top-stake peers (for consensus selection)
   */
  getTopStakePeers(count = 10) {
    return Array.from(this.addresses.values())
      .sort((a, b) => b.stake - a.stake)
      .slice(0, count)
      .map(id => id.address);
  }
}

// ==================== PEER DISCOVERY & TOPOLOGY ====================

/**
 * Distributed Peer Discovery Service
 * 
 * Uses DHT-style bootstrapping with social-based prioritization.
 */
class PeerDiscovery extends EventEmitter {
  constructor(localIdentity, gasService) {
    super();
    this.localIdentity = localIdentity;
    this.gasService = gasService;
    
    this.peers = new Map(); // address -> PeerInfo
    this.seedNodes = [];
    this.topology = new Map(); // address -> Set of neighbor addresses
    this.bootstrapped = false;
  }
  
  /**
   * Add seed nodes for initial bootstrap
   */
  addSeedNodes(seedAddresses) {
    this.seedNodes.push(...seedAddresses);
  }
  
  /**
   * Bootstrap peer discovery from seed nodes
   */
  async bootstrap() {
    if (this.bootstrapped) return;
    
    for (const seedAddr of this.seedNodes) {
      const identity = this.gasService.lookup(seedAddr);
      if (identity) {
        await this.addPeer(seedAddr, {
          lastSeen: Date.now(),
          latency: 0,
          trustScore: 0.5
        });
      }
    }
    
    // Perform multi-hop discovery
    const discovered = new Set();
    for (const seedAddr of this.seedNodes) {
      await this.discoverNeighbors(seedAddr, discovered, 2); // 2-hop discovery
    }
    
    this.bootstrapped = true;
    this.emit('bootstrapped', { peerCount: this.peers.size });
  }
  
  /**
   * Recursive neighbor discovery
   */
  async discoverNeighbors(address, discovered, hops) {
    if (discovered.has(address) || hops <= 0) return;
    discovered.add(address);
    
    // In real implementation, query peer for its neighbors
    // For now, use GAS to find all peers and filter by latency/trust
    const allAddresses = this.gasService.getAllAddresses();
    const neighbors = allAddresses
      .filter(addr => !discovered.has(addr))
      .slice(0, Math.min(5, Math.ceil(20 / hops))); // exponential backoff
    
    for (const neighbor of neighbors) {
      await this.addPeer(neighbor, {
        lastSeen: Date.now(),
        latency: Math.random() * 500, // simulate
        trustScore: 0.3 + Math.random() * 0.4
      });
      await this.discoverNeighbors(neighbor, discovered, hops - 1);
    }
  }
  
  /**
   * Add discovered peer
   */
  async addPeer(address, info) {
    if (address === this.localIdentity.address) return;
    
    this.peers.set(address, {
      address,
      ...info,
      failureCount: 0,
      successCount: 0
    });
    
    this.emit('peer-discovered', { address, info });
  }
  
  /**
   * Mark peer as seen and healthy
   */
  recordSuccess(address) {
    const peer = this.peers.get(address);
    if (peer) {
      peer.successCount++;
      peer.failureCount = 0;
      peer.lastSeen = Date.now();
    }
  }
  
  /**
   * Mark peer as failed
   */
  recordFailure(address) {
    const peer = this.peers.get(address);
    if (peer) {
      peer.failureCount++;
      if (peer.failureCount > 3) {
        this.peers.delete(address); // Remove dead peer
      }
    }
  }
  
  /**
   * Get best peers for routing (by trust score)
   */
  getBestPeers(count = 5) {
    return Array.from(this.peers.values())
      .sort((a, b) => {
        const scoreA = a.trustScore * (a.successCount / (a.successCount + a.failureCount + 1));
        const scoreB = b.trustScore * (b.successCount / (b.successCount + b.failureCount + 1));
        return scoreB - scoreA;
      })
      .slice(0, count)
      .map(p => p.address);
  }
}

// ==================== ROUTING LAYER ====================

/**
 * Capability-Based Routing (CBR)
 * 
 * Routes messages based on capability authority, not just addresses.
 */
class CapabilityBasedRouter {
  constructor(localIdentity, gasService) {
    this.localIdentity = localIdentity;
    this.gasService = gasService;
    this.routingTable = new Map(); // destination -> [routes]
    this.messageCache = new Map(); // msgID -> timestamp (deduplication)
  }
  
  /**
   * Find route to destination with capability check
   */
  findRoute(destination, requiredCapability) {
    const destIdentity = this.gasService.lookup(destination);
    if (!destIdentity) return null;
    
    // Check if destination has required capability
    if (!this.hasCapability(destIdentity.capability, requiredCapability)) {
      return null; // No capability to route
    }
    
    // Find path using BFS
    const path = this.bfsRoute(destination);
    return {
      destination,
      path,
      hopCount: path.length - 1,
      capability: destIdentity.capability
    };
  }
  
  /**
   * BFS to find shortest path to destination
   */
  bfsRoute(destination) {
    if (destination === this.localIdentity.address) {
      return [destination];
    }
    
    const queue = [[this.localIdentity.address]];
    const visited = new Set([this.localIdentity.address]);
    
    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];
      
      // Get neighbors (in real impl: topology graph)
      const neighbors = this.gasService.getAllAddresses()
        .filter(addr => !visited.has(addr) && addr !== current)
        .slice(0, 5); // limit branching
      
      for (const neighbor of neighbors) {
        visited.add(neighbor);
        const newPath = [...path, neighbor];
        
        if (neighbor === destination) {
          return newPath;
        }
        
        queue.push(newPath);
      }
    }
    
    return null; // No path found
  }
  
  /**
   * Check if capability includes required authority
   */
  hasCapability(capability, required) {
    // Simplified: check if required is subset of capability
    // In real implementation: complex lattice-based reasoning
    if (!required) return true;
    
    if (typeof capability === 'object' && typeof required === 'object') {
      for (const key in required) {
        if (!capability[key] || capability[key] < required[key]) {
          return false;
        }
      }
      return true;
    }
    
    return capability === required;
  }
  
  /**
   * Forward message along route
   */
  forwardMessage(message, route) {
    if (!route || !route.path || route.path.length < 2) {
      return null;
    }
    
    // Check message cache for deduplication
    const msgID = message.id;
    if (this.messageCache.has(msgID)) {
      return null; // Already forwarded
    }
    
    this.messageCache.set(msgID, Date.now());
    
    const nextHop = route.path[1];
    return {
      ...message,
      route: route.path.slice(1),
      previousHop: this.localIdentity.address,
      signature: this.localIdentity.sign(message)
    };
  }
}

// ==================== DISTRIBUTED CONSENSUS ====================

/**
 * Reduced Byzantine Fault Tolerance (rBFT)
 * 
 * Lightweight consensus for internet coordination.
 * Tolerates f < n/3 Byzantine nodes.
 */
class ReducedByzantineFT extends EventEmitter {
  constructor(localIdentity, gasService, peerDiscovery) {
    super();
    this.localIdentity = localIdentity;
    this.gasService = gasService;
    this.peerDiscovery = peerDiscovery;
    
    this.currentView = 0;
    this.currentLeader = null;
    this.prepares = new Map(); // msgHash -> Set of signers
    this.commits = new Map(); // msgHash -> Set of signers
    this.proposedBlocks = [];
  }
  
  /**
   * Start consensus round for a proposal
   */
  startConsensusRound(proposal) {
    const topPeers = this.gasService.getTopStakePeers(10);
    const f = Math.floor(topPeers.length / 3);
    const quorumSize = 2 * f + 1;
    
    const msgHash = this.hashProposal(proposal);
    
    return {
      proposal,
      msgHash,
      view: this.currentView,
      leader: this.currentLeader || topPeers[0],
      quorumSize,
      maxByzantine: f,
      minCorrect: quorumSize,
      startTime: Date.now()
    };
  }
  
  /**
   * Process PREPARE message
   */
  processPrepare(msgHash, signer, view) {
    if (view !== this.currentView) return;
    
    if (!this.prepares.has(msgHash)) {
      this.prepares.set(msgHash, new Set());
    }
    
    this.prepares.get(msgHash).add(signer);
    
    // Check if we have quorum
    const topPeers = this.gasService.getTopStakePeers(10);
    const quorumSize = Math.floor(topPeers.length * 2 / 3) + 1;
    
    if (this.prepares.get(msgHash).size >= quorumSize) {
      this.emit('prepare-quorum', { msgHash, signers: this.prepares.get(msgHash) });
    }
  }
  
  /**
   * Process COMMIT message
   */
  processCommit(msgHash, signer, view) {
    if (view !== this.currentView) return;
    
    if (!this.commits.has(msgHash)) {
      this.commits.set(msgHash, new Set());
    }
    
    this.commits.get(msgHash).add(signer);
    
    // Check if consensus reached
    const topPeers = this.gasService.getTopStakePeers(10);
    const quorumSize = Math.floor(topPeers.length * 2 / 3) + 1;
    
    if (this.commits.get(msgHash).size >= quorumSize) {
      this.emit('consensus-reached', { 
        msgHash, 
        signers: this.commits.get(msgHash),
        time: Date.now()
      });
    }
  }
  
  /**
   * View change on leader timeout
   */
  changeView() {
    const topPeers = this.gasService.getTopStakePeers(10);
    this.currentView++;
    this.currentLeader = topPeers[this.currentView % topPeers.length];
    
    this.emit('view-change', {
      newView: this.currentView,
      newLeader: this.currentLeader,
      time: Date.now()
    });
  }
  
  hashProposal(proposal) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(proposal))
      .digest('hex');
  }
}

// ==================== DISTRIBUTED NAME SERVICE ====================

/**
 * JC DNS (Distributed Name Service)
 * 
 * Maps human-readable names to internet addresses and capabilities.
 */
class DistributedNameService {
  constructor(localIdentity, gasService, consensus) {
    this.localIdentity = localIdentity;
    this.gasService = gasService;
    this.consensus = consensus;
    
    this.nameRecords = new Map(); // name -> NameRecord
    this.reverseIndex = new Map(); // address -> Set of names
    this.tld = new Map(); // TLD -> registry address
  }
  
  /**
   * Register a name pointing to an address
   */
  registerName(name, address, ttl = 3600) {
    // Parse domain levels: service.domain.tld
    const parts = name.split('.');
    if (parts.length < 2) {
      throw new Error('Invalid name format');
    }
    
    const tld = parts[parts.length - 1];
    const registry = this.tld.get(tld);
    if (!registry) {
      throw new Error(`Unknown TLD: ${tld}`);
    }
    
    const record = {
      name,
      address,
      registeredBy: this.localIdentity.address,
      registeredAt: Date.now(),
      expiresAt: Date.now() + ttl * 1000,
      ttl
    };
    
    this.nameRecords.set(name, record);
    
    if (!this.reverseIndex.has(address)) {
      this.reverseIndex.set(address, new Set());
    }
    this.reverseIndex.get(address).add(name);
    
    return record;
  }
  
  /**
   * Lookup address from name
   */
  resolveName(name) {
    const record = this.nameRecords.get(name);
    
    if (!record) return null;
    if (record.expiresAt < Date.now()) {
      this.nameRecords.delete(name);
      return null;
    }
    
    return {
      address: record.address,
      identity: this.gasService.lookup(record.address),
      ttl: Math.max(0, record.expiresAt - Date.now())
    };
  }
  
  /**
   * Reverse lookup: names for address
   */
  reverseResolve(address) {
    return this.reverseIndex.get(address) || new Set();
  }
  
  /**
   * Register a top-level domain
   */
  registerTLD(tld, registryAddress) {
    const registryIdentity = this.gasService.lookup(registryAddress);
    if (!registryIdentity) {
      throw new Error('Registry address not found');
    }
    
    this.tld.set(tld, registryAddress);
    return { tld, registry: registryAddress };
  }
  
  /**
   * Lookup with path (for service discovery)
   */
  discoverService(serviceName, domainName) {
    const fullName = `${serviceName}.${domainName}`;
    return this.resolveName(fullName);
  }
}

// ==================== CROSS-DOMAIN SYNCHRONIZATION ====================

/**
 * Cross-Domain Synchronization Protocol (CDSP)
 * 
 * Enables JC Compute domains to synchronize state across internet.
 */
class CrossDomainSync extends EventEmitter {
  constructor(localDomain, internetLayer) {
    super();
    this.localDomain = localDomain;
    this.internetLayer = internetLayer;
    
    this.remoteDomains = new Map(); // address -> RemoteDomainState
    this.syncJobs = new Map(); // jobID -> SyncJob
    this.convergenceProofs = []; // Merkle proofs
  }
  
  /**
   * Initiate sync with remote domain
   */
  initiateSync(remoteDomainAddress, scope = 'all') {
    const remoteIdentity = this.internetLayer.gasService.lookup(remoteDomainAddress);
    if (!remoteIdentity) {
      throw new Error('Remote domain not found');
    }
    
    const jobID = crypto.randomBytes(16).toString('hex');
    const job = {
      jobID,
      remoteDomain: remoteDomainAddress,
      scope,
      status: 'pending',
      startTime: Date.now(),
      localCheckpoint: this.localDomain.getCurrentCheckpoint(),
      remoteCheckpoint: null,
      delta: null,
      mergedState: null
    };
    
    this.syncJobs.set(jobID, job);
    this.emit('sync-initiated', job);
    
    return jobID;
  }
  
  /**
   * Process remote checkpoint
   */
  processRemoteCheckpoint(jobID, remoteCheckpoint, merkleProof) {
    const job = this.syncJobs.get(jobID);
    if (!job) return;
    
    job.remoteCheckpoint = remoteCheckpoint;
    
    // Verify Merkle proof
    if (!this.verifyMerkleProof(merkleProof)) {
      job.status = 'failed';
      this.emit('sync-failed', { jobID, reason: 'Invalid proof' });
      return;
    }
    
    // Compute delta
    job.delta = this.computeDelta(
      job.localCheckpoint,
      remoteCheckpoint
    );
    
    job.status = 'delta-computed';
    this.emit('delta-computed', job);
  }
  
  /**
   * Merge states using JC Compute merge operator
   */
  mergeStates(jobID) {
    const job = this.syncJobs.get(jobID);
    if (!job || !job.delta) return;
    
    // Use JC Compute's ⊔ (merge) operator
    try {
      job.mergedState = this.localDomain.merge(
        job.localCheckpoint,
        job.delta,
        job.remoteCheckpoint
      );
      
      job.status = 'merged';
      this.emit('sync-merged', {
        jobID,
        mergedState: job.mergedState,
        time: Date.now()
      });
    } catch (err) {
      job.status = 'failed';
      this.emit('sync-failed', { jobID, reason: err.message });
    }
  }
  
  /**
   * Compute delta between two checkpoints
   */
  computeDelta(local, remote) {
    // Simplified delta computation
    const delta = {
      newEvents: [],
      updates: {},
      timestamp: Date.now()
    };
    
    // In real implementation: compute causal diff
    if (remote && local) {
      delta.newEvents = (remote.events || [])
        .filter(e => !(local.events || []).some(le => le.id === e.id));
    }
    
    return delta;
  }
  
  /**
   * Verify Merkle proof
   */
  verifyMerkleProof(proof) {
    // Simplified verification
    return proof && proof.root && proof.path;
  }
  
  /**
   * Get convergence status
   */
  getConvergenceStatus(jobID) {
    const job = this.syncJobs.get(jobID);
    if (!job) return null;
    
    return {
      jobID,
      status: job.status,
      progress: this.estimateProgress(job),
      startTime: job.startTime,
      elapsedTime: Date.now() - job.startTime
    };
  }
  
  estimateProgress(job) {
    const stages = ['pending', 'delta-computed', 'merged', 'committed'];
    return (stages.indexOf(job.status) / stages.length) * 100;
  }
}

// ==================== INCENTIVE LAYER ====================

/**
 * Network Incentives
 * 
 * Encourages nodes to participate honestly.
 */
class NetworkIncentives {
  constructor(gasService) {
    this.gasService = gasService;
    this.rewards = new Map(); // address -> rewardAmount
    this.slashRules = [];
  }
  
  /**
   * Add slash rule for misbehavior detection
   */
  addSlashRule(rule) {
    // rule = { condition, slashAmount, description }
    this.slashRules.push(rule);
  }
  
  /**
   * Check for misbehavior and apply slashing
   */
  checkAndSlash(address, evidence) {
    for (const rule of this.slashRules) {
      if (rule.condition(evidence)) {
        this.gasService.slash(address, rule.slashAmount);
        return {
          slashed: true,
          rule: rule.description,
          amount: rule.slashAmount
        };
      }
    }
    
    return { slashed: false };
  }
  
  /**
   * Reward for participation and correctness
   */
  rewardParticipation(address, participationType = 'consensus', amount = 1) {
    this.gasService.reward(address, amount);
    
    if (!this.rewards.has(address)) {
      this.rewards.set(address, 0);
    }
    this.rewards.set(address, this.rewards.get(address) + amount);
    
    return this.rewards.get(address);
  }
}

// ==================== INTERNET LAYER COORDINATOR ====================

/**
 * Main Internet Layer Coordinator
 * 
 * Composes all layers into a working internet for JC Compute.
 */
class InternetLayerCoordinator extends EventEmitter {
  constructor(capability, metadata = {}) {
    super();
    
    // Create local identity
    this.localIdentity = new InternetIdentity(capability, metadata);
    
    // Initialize layers
    this.gas = new GlobalAddressSpace();
    this.peerDiscovery = new PeerDiscovery(this.localIdentity, this.gas);
    this.router = new CapabilityBasedRouter(this.localIdentity, this.gas);
    this.consensus = new ReducedByzantineFT(
      this.localIdentity,
      this.gas,
      this.peerDiscovery
    );
    this.dns = new DistributedNameService(
      this.localIdentity,
      this.gas,
      this.consensus
    );
    this.crossDomainSync = null; // Set when domain is available
    this.incentives = new NetworkIncentives(this.gas);
    
    // Register self in GAS
    this.gas.register(this.localIdentity);
    
    // Initialize default TLDs
    this.dns.registerTLD('jc', this.localIdentity.address);
    this.dns.registerTLD('compute', this.localIdentity.address);
    
    // Setup incentive rules
    this.setupIncentiveRules();
  }
  
  /**
   * Setup default incentive rules
   */
  setupIncentiveRules() {
    // Double-signing slash
    this.incentives.addSlashRule({
      condition: (evidence) => evidence.type === 'double-sign',
      slashAmount: 100,
      description: 'Double signing detected'
    });
    
    // Downtime slash
    this.incentives.addSlashRule({
      condition: (evidence) => evidence.type === 'downtime' && evidence.blocks > 50,
      slashAmount: 10,
      description: 'Extended downtime'
    });
  }
  
  /**
   * Bootstrap the internet layer
   */
  async bootstrap(seedNodes = []) {
    this.emit('bootstrapping', { address: this.localIdentity.address });
    
    this.peerDiscovery.addSeedNodes(seedNodes);
    await this.peerDiscovery.bootstrap();
    
    this.emit('bootstrapped', {
      address: this.localIdentity.address,
      peerCount: this.peerDiscovery.peers.size,
      stake: this.localIdentity.stake
    });
  }
  
  /**
   * Connect internet layer to a JC Compute domain
   */
  connectDomain(domain) {
    this.domain = domain;
    this.crossDomainSync = new CrossDomainSync(domain, this);
    
    this.emit('domain-connected', {
      address: this.localIdentity.address,
      domain: domain.name
    });
  }
  
  /**
   * Send message to remote domain
   */
  async sendToDomain(targetAddress, message, requiredCapability) {
    // Find route
    const route = this.router.findRoute(targetAddress, requiredCapability);
    if (!route) {
      throw new Error('No route with required capability');
    }
    
    // Forward along route
    const forwarded = this.router.forwardMessage(message, route);
    if (!forwarded) {
      throw new Error('Message deduplication failed');
    }
    
    this.emit('message-sent', {
      target: targetAddress,
      route: route.path,
      messageID: message.id
    });
    
    return { route, forwarded };
  }
  
  /**
   * Get network statistics
   */
  getNetworkStats() {
    return {
      localAddress: this.localIdentity.address,
      stake: this.localIdentity.stake,
      reputation: this.localIdentity.reputation,
      peersConnected: this.peerDiscovery.peers.size,
      registeredAddresses: this.gas.addresses.size,
      topPeers: this.gas.getTopStakePeers(5),
      currentView: this.consensus.currentView,
      namesRegistered: this.dns.nameRecords.size,
      activeSyncJobs: this.crossDomainSync 
        ? Array.from(this.crossDomainSync.syncJobs.values())
            .filter(j => j.status !== 'merged')
            .length 
        : 0
    };
  }
}

// ==================== EXPORTS ====================

module.exports = {
  InternetIdentity,
  GlobalAddressSpace,
  PeerDiscovery,
  CapabilityBasedRouter,
  ReducedByzantineFT,
  DistributedNameService,
  CrossDomainSync,
  NetworkIncentives,
  InternetLayerCoordinator
};
