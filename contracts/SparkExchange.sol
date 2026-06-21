// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMintableBurnableToken is IERC20 {
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 value) external;
}

contract SparkExchange is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_DECAY_BPS = 5_000;

    enum PayToken {
        Stable,
        Spe
    }

    enum Rank {
        Visitor,
        TrialMiner,
        FormalMiner,
        NodePool,
        HoneycombPool,
        SuperPool
    }

    struct Account {
        address referrer;
        uint256 miners;
        uint256 directMiners;
        uint256 teamMiners;
        uint256 basePower;
        uint256 referralPower;
        uint256 nodeFuelPower;
        uint256 bonusPower;
        uint256 burnedPower;
        uint256 burnedSpe;
        uint256 stakedSpe;
        uint256 stakePower;
        uint256 stakeUnlockAt;
        uint8 stakePlanId;
        uint256 collateral;
        uint256 rentedPower;
        uint256 rentalExpireAt;
        uint256 leasedMiners;
        uint256 pendingReferralReward;
        uint256 referralRewardExpireAt;
        uint256 lastMiningClaimAt;
        uint256 lastNodeClaimAt;
        uint256 lastActivityAt;
        Rank manualRank;
        bool rankLocked;
    }

    struct Config {
        uint256 stablePricePerMiner;
        uint256 spePricePerMiner;
        uint256 minerBasePower;
        uint256 minerReferralPower;
        uint256 minerNodeFuelPower;
        uint256 powerPerSpeBurned;
        uint256 dailyRewardPerPower;
        uint256 dailyNodeReward;
        uint256 referralRewardBase;
        uint256 claimWindow;
        uint256 weeklyDecayBps;
        uint256 activityWindow;
        uint256 activityBonusBps;
        uint256 earlyBirdMinerCap;
        uint256 earlyBirdBonusBps;
        uint256 bulkMinerThreshold;
        uint256 bulkBonusBps;
        uint256 buybackBps;
    }

    struct StakePlan {
        uint256 lockDuration;
        uint256 powerPerSpe;
        bool enabled;
    }

    struct LeaseListing {
        address owner;
        uint256 quantity;
        uint256 dailyPrice;
        bool active;
    }

    IMintableBurnableToken public immutable speToken;
    IERC20 public stableToken;
    address public treasury;
    address public buybackTreasury;
    uint256 public immutable startAt;

    Config public config;
    uint256[] public generationBps;
    uint256[6] public rankCollateral;
    uint256 public totalMiners;
    uint256 public totalPower;
    uint256 public totalNodeFuelPower;
    uint256 public totalStakedSpe;

    mapping(address => Account) private accounts;
    mapping(uint8 => StakePlan) public stakePlans;
    LeaseListing[] public leaseListings;

    event ReferrerBound(address indexed account, address indexed referrer);
    event MinerPurchased(address indexed account, uint256 quantity, PayToken payToken, uint256 cost, uint256 bonusPower);
    event TrialMinerGranted(address indexed account, uint256 power);
    event SpeBurnedForPower(address indexed account, uint256 speAmount, uint256 power);
    event SpeStaked(address indexed account, uint256 speAmount, uint8 planId, uint256 power, uint256 unlockAt);
    event SpeUnstaked(address indexed account, uint256 speAmount);
    event CollateralDeposited(address indexed account, uint256 amount);
    event CollateralWithdrawn(address indexed account, uint256 amount);
    event ActivityMarked(address indexed account);
    event LeaseListed(uint256 indexed listingId, address indexed owner, uint256 quantity, uint256 dailyPrice);
    event LeaseCancelled(uint256 indexed listingId);
    event LeaseRented(uint256 indexed listingId, address indexed renter, uint256 quantity, uint256 durationDays, uint256 totalPrice);
    event RewardClaimed(address indexed account, uint256 miningReward, uint256 referralReward, uint256 nodeReward);
    event ManualRankUpdated(address indexed account, Rank rank, bool locked);
    event ConfigUpdated(Config config);
    event TokensUpdated(address indexed stableToken, address indexed treasury, address indexed buybackTreasury);
    event StakePlanUpdated(uint8 indexed planId, uint256 lockDuration, uint256 powerPerSpe, bool enabled);

    constructor(
        address speToken_,
        address stableToken_,
        address treasury_,
        address buybackTreasury_,
        address initialOwner
    ) Ownable(initialOwner) {
        require(speToken_ != address(0), "SparkExchange: SPE required");
        require(stableToken_ != address(0), "SparkExchange: stable required");
        require(treasury_ != address(0), "SparkExchange: treasury required");
        require(buybackTreasury_ != address(0), "SparkExchange: buyback treasury required");

        speToken = IMintableBurnableToken(speToken_);
        stableToken = IERC20(stableToken_);
        treasury = treasury_;
        buybackTreasury = buybackTreasury_;
        startAt = block.timestamp;

        config = Config({
            stablePricePerMiner: 10 ether,
            spePricePerMiner: 10 ether,
            minerBasePower: 70_000,
            minerReferralPower: 20_000,
            minerNodeFuelPower: 10_000,
            powerPerSpeBurned: 12_000,
            dailyRewardPerPower: 0.00001 ether,
            dailyNodeReward: 250 ether,
            referralRewardBase: 10 ether,
            claimWindow: 48 hours,
            weeklyDecayBps: 80,
            activityWindow: 30 days,
            activityBonusBps: 1_000,
            earlyBirdMinerCap: 1_000,
            earlyBirdBonusBps: 1_500,
            bulkMinerThreshold: 50,
            bulkBonusBps: 2_500,
            buybackBps: 1_500
        });

        generationBps.push(2_000);
        generationBps.push(800);
        generationBps.push(600);
        generationBps.push(400);
        generationBps.push(200);
        generationBps.push(50);

        rankCollateral[uint256(Rank.NodePool)] = 500 ether;
        rankCollateral[uint256(Rank.HoneycombPool)] = 5_000 ether;
        rankCollateral[uint256(Rank.SuperPool)] = 30_000 ether;

        _setStakePlan(0, 30 days, 8_000, true);
        _setStakePlan(1, 90 days, 10_000, true);
        _setStakePlan(2, 180 days, 13_000, true);
    }

    function bindReferrer(address referrer) external {
        _bindReferrer(msg.sender, referrer);
    }

    function buyMiners(uint256 quantity, PayToken payToken, address referrer) external nonReentrant {
        require(quantity > 0, "SparkExchange: quantity is zero");
        _bindReferrer(msg.sender, referrer);

        uint256 cost;
        if (payToken == PayToken.Stable) {
            cost = config.stablePricePerMiner * quantity;
            stableToken.safeTransferFrom(msg.sender, address(this), cost);
            _splitStablePayment(cost);
        } else {
            cost = config.spePricePerMiner * quantity;
            speToken.burnFrom(msg.sender, cost);
        }

        uint256 bonusPower = _addMiners(msg.sender, quantity);
        _allocateReferralRewards(msg.sender, quantity);
        _markActive(msg.sender, accounts[msg.sender]);

        emit MinerPurchased(msg.sender, quantity, payToken, cost, bonusPower);
    }

    function grantTrialMiner(address account) external onlyOwner {
        require(account != address(0), "SparkExchange: zero account");
        Account storage user = accounts[account];
        _touch(user);
        _markActive(account, user);

        user.basePower += 1_000;
        totalPower += 1_000;

        if (user.manualRank < Rank.TrialMiner && !user.rankLocked) {
            user.manualRank = Rank.TrialMiner;
        }

        emit TrialMinerGranted(account, 1_000);
    }

    function burnSpeForPower(uint256 speAmount) external nonReentrant {
        require(speAmount > 0, "SparkExchange: amount is zero");
        Account storage user = accounts[msg.sender];
        _touch(user);
        _markActive(msg.sender, user);

        uint256 wholeSpe = speAmount / 1 ether;
        require(wholeSpe > 0, "SparkExchange: burn at least 1 SPE");

        uint256 power = wholeSpe * config.powerPerSpeBurned;
        speToken.burnFrom(msg.sender, speAmount);

        user.burnedSpe += speAmount;
        user.burnedPower += power;
        totalPower += power;

        emit SpeBurnedForPower(msg.sender, speAmount, power);
    }

    function stakeSpe(uint256 speAmount, uint8 planId) external nonReentrant {
        Account storage user = accounts[msg.sender];
        require(user.stakedSpe == 0, "SparkExchange: active stake exists");

        StakePlan memory plan = stakePlans[planId];
        require(plan.enabled, "SparkExchange: invalid stake plan");
        uint256 wholeSpe = speAmount / 1 ether;
        require(wholeSpe > 0, "SparkExchange: stake at least 1 SPE");

        IERC20(address(speToken)).safeTransferFrom(msg.sender, address(this), speAmount);
        _touch(user);
        _markActive(msg.sender, user);

        uint256 power = wholeSpe * plan.powerPerSpe;
        user.stakedSpe = speAmount;
        user.stakePower = power;
        user.stakeUnlockAt = block.timestamp + plan.lockDuration;
        user.stakePlanId = planId;
        totalPower += power;
        totalStakedSpe += speAmount;

        emit SpeStaked(msg.sender, speAmount, planId, power, user.stakeUnlockAt);
    }

    function unstakeSpe() external nonReentrant {
        Account storage user = accounts[msg.sender];
        require(user.stakedSpe > 0, "SparkExchange: no active stake");
        require(block.timestamp >= user.stakeUnlockAt, "SparkExchange: stake locked");

        uint256 amount = user.stakedSpe;
        uint256 power = user.stakePower;
        user.stakedSpe = 0;
        user.stakePower = 0;
        user.stakeUnlockAt = 0;
        user.stakePlanId = 0;
        totalPower -= power;
        totalStakedSpe -= amount;

        IERC20(address(speToken)).safeTransfer(msg.sender, amount);
        emit SpeUnstaked(msg.sender, amount);
    }

    function depositCollateral(uint256 amount) external nonReentrant {
        require(amount > 0, "SparkExchange: amount is zero");
        Account storage user = accounts[msg.sender];
        _touch(user);
        _markActive(msg.sender, user);

        stableToken.safeTransferFrom(msg.sender, address(this), amount);
        user.collateral += amount;

        emit CollateralDeposited(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external nonReentrant {
        Account storage user = accounts[msg.sender];
        require(amount > 0 && user.collateral >= amount, "SparkExchange: invalid amount");

        user.collateral -= amount;
        stableToken.safeTransfer(msg.sender, amount);

        emit CollateralWithdrawn(msg.sender, amount);
    }

    function markActive() external {
        _touch(accounts[msg.sender]);
        _markActive(msg.sender, accounts[msg.sender]);
    }

    function createLeaseListing(uint256 quantity, uint256 dailyPrice) external returns (uint256 listingId) {
        require(quantity > 0, "SparkExchange: quantity is zero");
        require(dailyPrice > 0, "SparkExchange: price is zero");
        Account storage user = accounts[msg.sender];
        require(user.miners >= user.leasedMiners + quantity, "SparkExchange: not enough idle miners");

        user.leasedMiners += quantity;
        leaseListings.push(LeaseListing({
            owner: msg.sender,
            quantity: quantity,
            dailyPrice: dailyPrice,
            active: true
        }));

        listingId = leaseListings.length - 1;
        emit LeaseListed(listingId, msg.sender, quantity, dailyPrice);
    }

    function cancelLeaseListing(uint256 listingId) external {
        LeaseListing storage listing = leaseListings[listingId];
        require(listing.owner == msg.sender, "SparkExchange: not owner");
        require(listing.active, "SparkExchange: inactive listing");

        listing.active = false;
        accounts[msg.sender].leasedMiners -= listing.quantity;

        emit LeaseCancelled(listingId);
    }

    function rentMiners(uint256 listingId, uint256 durationDays) external nonReentrant {
        require(durationDays > 0 && durationDays <= 180, "SparkExchange: invalid duration");
        LeaseListing storage listing = leaseListings[listingId];
        require(listing.active, "SparkExchange: inactive listing");
        require(listing.owner != msg.sender, "SparkExchange: cannot rent own miners");

        Account storage renter = accounts[msg.sender];
        require(renter.rentalExpireAt < block.timestamp, "SparkExchange: active rental exists");

        uint256 totalPrice = listing.dailyPrice * durationDays;
        stableToken.safeTransferFrom(msg.sender, listing.owner, totalPrice);

        listing.active = false;
        accounts[listing.owner].leasedMiners -= listing.quantity;

        renter.rentedPower = _minerPowerPerUnit() * listing.quantity;
        renter.rentalExpireAt = block.timestamp + durationDays * 1 days;
        _touch(renter);
        _markActive(msg.sender, renter);

        emit LeaseRented(listingId, msg.sender, listing.quantity, durationDays, totalPrice);
    }

    function claim() external nonReentrant returns (uint256 totalReward) {
        Account storage user = accounts[msg.sender];

        uint256 miningReward = _miningReward(user);
        uint256 nodeReward = _nodeReward(user);
        uint256 referralReward = _claimableReferralReward(user);

        user.lastMiningClaimAt = block.timestamp;
        user.lastNodeClaimAt = block.timestamp;
        user.pendingReferralReward = 0;
        user.referralRewardExpireAt = 0;
        _markActive(msg.sender, user);

        totalReward = miningReward + nodeReward + referralReward;
        require(totalReward > 0, "SparkExchange: no reward");
        _payReward(msg.sender, totalReward);

        emit RewardClaimed(msg.sender, miningReward, referralReward, nodeReward);
    }

    function pendingRewards(address account)
        external
        view
        returns (uint256 miningReward, uint256 referralReward, uint256 nodeReward, uint256 totalReward)
    {
        Account storage user = accounts[account];
        miningReward = _miningReward(user);
        referralReward = _claimableReferralReward(user);
        nodeReward = _nodeReward(user);
        totalReward = miningReward + referralReward + nodeReward;
    }

    function getAccount(address account)
        external
        view
        returns (
            address referrer,
            uint256 miners,
            uint256 directMiners,
            uint256 teamMiners,
            uint256 personalPower,
            uint256 basePower,
            uint256 referralPower,
            uint256 nodeFuelPower,
            uint256 bonusPower,
            uint256 burnedPower,
            uint256 burnedSpe,
            uint256 stakedSpe,
            uint256 stakePower,
            uint256 stakeUnlockAt,
            uint256 collateral,
            uint256 rentedPower,
            uint256 rentalExpireAt,
            uint256 leasedMiners,
            Rank rank,
            uint256 referralRewardExpireAt,
            uint256 lastActivityAt
        )
    {
        Account storage user = accounts[account];
        referrer = user.referrer;
        miners = user.miners;
        directMiners = user.directMiners;
        teamMiners = user.teamMiners;
        personalPower = _personalPower(user);
        basePower = user.basePower;
        referralPower = user.referralPower;
        nodeFuelPower = user.nodeFuelPower;
        bonusPower = user.bonusPower;
        burnedPower = user.burnedPower;
        burnedSpe = user.burnedSpe;
        stakedSpe = user.stakedSpe;
        stakePower = user.stakePower;
        stakeUnlockAt = user.stakeUnlockAt;
        collateral = user.collateral;
        rentedPower = _activeRentedPower(user);
        rentalExpireAt = user.rentalExpireAt;
        leasedMiners = user.leasedMiners;
        rank = effectiveRank(account);
        referralRewardExpireAt = user.referralRewardExpireAt;
        lastActivityAt = user.lastActivityAt;
    }

    function getLeaseListing(uint256 listingId)
        external
        view
        returns (address owner, uint256 quantity, uint256 dailyPrice, bool active)
    {
        LeaseListing storage listing = leaseListings[listingId];
        return (listing.owner, listing.quantity, listing.dailyPrice, listing.active);
    }

    function leaseListingCount() external view returns (uint256) {
        return leaseListings.length;
    }

    function effectiveRank(address account) public view returns (Rank) {
        Account storage user = accounts[account];
        return effectiveRankByAccount(user);
    }

    function setManualRank(address account, Rank rank, bool locked) external onlyOwner {
        accounts[account].manualRank = rank;
        accounts[account].rankLocked = locked;
        emit ManualRankUpdated(account, rank, locked);
    }

    function setStableToken(address stableToken_) external onlyOwner {
        require(stableToken_ != address(0), "SparkExchange: stable required");
        stableToken = IERC20(stableToken_);
        emit TokensUpdated(stableToken_, treasury, buybackTreasury);
    }

    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "SparkExchange: treasury required");
        treasury = treasury_;
        emit TokensUpdated(address(stableToken), treasury_, buybackTreasury);
    }

    function setBuybackTreasury(address buybackTreasury_) external onlyOwner {
        require(buybackTreasury_ != address(0), "SparkExchange: buyback treasury required");
        buybackTreasury = buybackTreasury_;
        emit TokensUpdated(address(stableToken), treasury, buybackTreasury_);
    }

    function setConfig(Config calldata nextConfig) external onlyOwner {
        require(nextConfig.minerBasePower > 0, "SparkExchange: base power required");
        require(nextConfig.claimWindow >= 1 hours, "SparkExchange: claim window too short");
        require(nextConfig.weeklyDecayBps <= 1_000, "SparkExchange: decay too high");
        require(nextConfig.activityBonusBps <= 5_000, "SparkExchange: activity bonus too high");
        require(nextConfig.buybackBps <= 3_000, "SparkExchange: buyback too high");
        config = nextConfig;
        emit ConfigUpdated(nextConfig);
    }

    function setGenerationBps(uint256[] calldata nextBps) external onlyOwner {
        require(nextBps.length > 0 && nextBps.length <= 12, "SparkExchange: invalid depth");
        delete generationBps;
        for (uint256 i = 0; i < nextBps.length; i++) {
            require(nextBps[i] <= BPS, "SparkExchange: invalid bps");
            generationBps.push(nextBps[i]);
        }
    }

    function setRankCollateral(Rank rank, uint256 amount) external onlyOwner {
        rankCollateral[uint256(rank)] = amount;
    }

    function setStakePlan(uint8 planId, uint256 lockDuration, uint256 powerPerSpe, bool enabled) external onlyOwner {
        _setStakePlan(planId, lockDuration, powerPerSpe, enabled);
    }

    function generationDepth() external view returns (uint256) {
        return generationBps.length;
    }

    function currentDecayBps() public view returns (uint256) {
        uint256 weeksElapsed = (block.timestamp - startAt) / 7 days;
        uint256 decay = weeksElapsed * config.weeklyDecayBps;
        return decay > MAX_DECAY_BPS ? MAX_DECAY_BPS : decay;
    }

    function rewardPoolBalance() external view returns (uint256) {
        return _availableRewardBalance();
    }

    function _bindReferrer(address account, address referrer) internal {
        Account storage user = accounts[account];
        if (user.referrer != address(0) || referrer == address(0)) {
            return;
        }

        require(referrer != account, "SparkExchange: self referrer");
        require(accounts[referrer].miners > 0 || accounts[referrer].manualRank != Rank.Visitor, "SparkExchange: inactive referrer");

        address cursor = referrer;
        for (uint256 i = 0; i < generationBps.length; i++) {
            require(cursor != account, "SparkExchange: referrer loop");
            cursor = accounts[cursor].referrer;
            if (cursor == address(0)) {
                break;
            }
        }

        user.referrer = referrer;
        emit ReferrerBound(account, referrer);
    }

    function _addMiners(address account, uint256 quantity) internal returns (uint256 bonusPower) {
        Account storage user = accounts[account];
        _touch(user);

        uint256 basePower = config.minerBasePower * quantity;
        uint256 referralPower = config.minerReferralPower * quantity;
        uint256 nodeFuelPower = config.minerNodeFuelPower * quantity;
        uint256 newPower = basePower + referralPower + nodeFuelPower;
        uint256 bonusBps = _purchaseBonusBps(quantity);
        bonusPower = (newPower * bonusBps) / BPS;

        user.miners += quantity;
        user.basePower += basePower;
        user.referralPower += referralPower;
        user.nodeFuelPower += nodeFuelPower;
        user.bonusPower += bonusPower;

        totalMiners += quantity;
        totalPower += newPower + bonusPower;
        totalNodeFuelPower += nodeFuelPower;

        address direct = user.referrer;
        if (direct != address(0)) {
            accounts[direct].directMiners += quantity;
        }

        address cursor = direct;
        for (uint256 i = 0; i < generationBps.length && cursor != address(0); i++) {
            accounts[cursor].teamMiners += quantity;
            cursor = accounts[cursor].referrer;
        }
    }

    function _allocateReferralRewards(address account, uint256 quantity) internal {
        address cursor = accounts[account].referrer;
        uint256 baseAmount = config.referralRewardBase * quantity;

        for (uint256 i = 0; i < generationBps.length && cursor != address(0); i++) {
            uint256 reward = (baseAmount * generationBps[i]) / BPS;
            if (reward > 0) {
                Account storage receiver = accounts[cursor];
                receiver.pendingReferralReward += reward;
                receiver.referralRewardExpireAt = block.timestamp + config.claimWindow;
            }
            cursor = accounts[cursor].referrer;
        }
    }

    function _touch(Account storage user) internal {
        if (user.lastMiningClaimAt == 0) {
            user.lastMiningClaimAt = block.timestamp;
        }
        if (user.lastNodeClaimAt == 0) {
            user.lastNodeClaimAt = block.timestamp;
        }
    }

    function _markActive(address account, Account storage user) internal {
        user.lastActivityAt = block.timestamp;
        emit ActivityMarked(account);
    }

    function _rawPower(Account storage user) internal view returns (uint256) {
        return user.basePower
            + user.referralPower
            + user.nodeFuelPower
            + user.bonusPower
            + user.burnedPower
            + user.stakePower
            + _activeRentedPower(user);
    }

    function _personalPower(Account storage user) internal view returns (uint256) {
        uint256 power = (_rawPower(user) * (BPS - currentDecayBps())) / BPS;
        if (user.lastActivityAt != 0 && block.timestamp <= user.lastActivityAt + config.activityWindow) {
            power += (power * config.activityBonusBps) / BPS;
        }
        return power;
    }

    function _activeRentedPower(Account storage user) internal view returns (uint256) {
        return block.timestamp <= user.rentalExpireAt ? user.rentedPower : 0;
    }

    function _miningReward(Account storage user) internal view returns (uint256) {
        if (user.lastMiningClaimAt == 0) {
            return 0;
        }

        uint256 elapsed = block.timestamp - user.lastMiningClaimAt;
        return (_personalPower(user) * config.dailyRewardPerPower * elapsed) / 1 days;
    }

    function _nodeReward(Account storage user) internal view returns (uint256) {
        if (user.lastNodeClaimAt == 0 || totalNodeFuelPower == 0 || effectiveRankByAccount(user) < Rank.NodePool) {
            return 0;
        }

        uint256 elapsed = block.timestamp - user.lastNodeClaimAt;
        uint256 dailyShare = (config.dailyNodeReward * user.nodeFuelPower) / totalNodeFuelPower;
        return (dailyShare * elapsed) / 1 days;
    }

    function _claimableReferralReward(Account storage user) internal view returns (uint256) {
        if (user.pendingReferralReward == 0) {
            return 0;
        }

        if (user.referralRewardExpireAt != 0 && block.timestamp > user.referralRewardExpireAt) {
            return 0;
        }

        return user.pendingReferralReward;
    }

    function effectiveRankByAccount(Account storage user) internal view returns (Rank) {
        if (user.rankLocked) {
            return user.manualRank;
        }

        if (
            user.directMiners >= 5
                && user.teamMiners >= 20_000
                && user.miners >= 2_000
                && user.collateral >= rankCollateral[uint256(Rank.SuperPool)]
        ) {
            return Rank.SuperPool;
        }

        if (
            user.directMiners >= 5
                && user.teamMiners >= 2_000
                && user.miners >= 200
                && user.collateral >= rankCollateral[uint256(Rank.HoneycombPool)]
        ) {
            return Rank.HoneycombPool;
        }

        if (
            user.directMiners >= 5
                && user.teamMiners >= 20
                && user.miners >= 5
                && user.collateral >= rankCollateral[uint256(Rank.NodePool)]
        ) {
            return Rank.NodePool;
        }

        if (_personalPower(user) >= 50_000 || user.miners > 0) {
            return Rank.FormalMiner;
        }

        if (user.manualRank == Rank.TrialMiner) {
            return Rank.TrialMiner;
        }

        return Rank.Visitor;
    }

    function _minerPowerPerUnit() internal view returns (uint256) {
        return config.minerBasePower + config.minerReferralPower + config.minerNodeFuelPower;
    }

    function _purchaseBonusBps(uint256 quantity) internal view returns (uint256 bonusBps) {
        if (totalMiners < config.earlyBirdMinerCap) {
            bonusBps += config.earlyBirdBonusBps;
        }
        if (quantity >= config.bulkMinerThreshold) {
            bonusBps += config.bulkBonusBps;
        }
    }

    function _splitStablePayment(uint256 amount) internal {
        uint256 buybackAmount = (amount * config.buybackBps) / BPS;
        if (buybackAmount > 0) {
            stableToken.safeTransfer(buybackTreasury, buybackAmount);
        }
        stableToken.safeTransfer(treasury, amount - buybackAmount);
    }

    function _payReward(address account, uint256 amount) internal {
        uint256 available = _availableRewardBalance();
        if (available >= amount) {
            IERC20(address(speToken)).safeTransfer(account, amount);
            return;
        }

        if (available > 0) {
            IERC20(address(speToken)).safeTransfer(account, available);
        }

        speToken.mint(account, amount - available);
    }

    function _availableRewardBalance() internal view returns (uint256) {
        uint256 balance = IERC20(address(speToken)).balanceOf(address(this));
        return balance > totalStakedSpe ? balance - totalStakedSpe : 0;
    }

    function _setStakePlan(uint8 planId, uint256 lockDuration, uint256 powerPerSpe, bool enabled) internal {
        require(powerPerSpe > 0, "SparkExchange: power required");
        stakePlans[planId] = StakePlan({
            lockDuration: lockDuration,
            powerPerSpe: powerPerSpe,
            enabled: enabled
        });
        emit StakePlanUpdated(planId, lockDuration, powerPerSpe, enabled);
    }
}
