// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMintableToken is IERC20 {
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 value) external;
}

contract SparkExchange is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

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
        uint256 burnedPower;
        uint256 burnedSpe;
        uint256 pendingReferralReward;
        uint256 referralRewardExpireAt;
        uint256 lastMiningClaimAt;
        uint256 lastNodeClaimAt;
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
    }

    IMintableToken public immutable speToken;
    IMintableToken public immutable rewardToken;
    IERC20 public stableToken;
    address public treasury;

    Config public config;
    uint256[] public generationBps;
    uint256 public totalMiners;
    uint256 public totalPower;
    uint256 public totalNodeFuelPower;

    mapping(address => Account) private accounts;

    event ReferrerBound(address indexed account, address indexed referrer);
    event MinerPurchased(address indexed account, uint256 quantity, PayToken payToken, uint256 cost);
    event TrialMinerGranted(address indexed account, uint256 power);
    event SpeBurnedForPower(address indexed account, uint256 speAmount, uint256 power);
    event RewardClaimed(address indexed account, uint256 miningReward, uint256 referralReward, uint256 nodeReward);
    event ManualRankUpdated(address indexed account, Rank rank, bool locked);
    event ConfigUpdated(Config config);
    event TokensUpdated(address indexed stableToken, address indexed treasury);

    constructor(
        address speToken_,
        address rewardToken_,
        address stableToken_,
        address treasury_,
        address initialOwner
    ) Ownable(initialOwner) {
        require(speToken_ != address(0), "SparkExchange: SPE required");
        require(rewardToken_ != address(0), "SparkExchange: reward required");
        require(stableToken_ != address(0), "SparkExchange: stable required");
        require(treasury_ != address(0), "SparkExchange: treasury required");

        speToken = IMintableToken(speToken_);
        rewardToken = IMintableToken(rewardToken_);
        stableToken = IERC20(stableToken_);
        treasury = treasury_;

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
            claimWindow: 48 hours
        });

        generationBps.push(2_000);
        generationBps.push(800);
        generationBps.push(600);
        generationBps.push(400);
        generationBps.push(200);
        generationBps.push(50);
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
            stableToken.safeTransferFrom(msg.sender, treasury, cost);
        } else {
            cost = config.spePricePerMiner * quantity;
            speToken.burnFrom(msg.sender, cost);
        }

        _addMiners(msg.sender, quantity);
        _allocateReferralRewards(msg.sender, quantity);

        emit MinerPurchased(msg.sender, quantity, payToken, cost);
    }

    function grantTrialMiner(address account) external onlyOwner {
        require(account != address(0), "SparkExchange: zero account");
        Account storage user = accounts[account];
        _touch(user);

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

        uint256 wholeSpe = speAmount / 1 ether;
        require(wholeSpe > 0, "SparkExchange: burn at least 1 SPE");

        uint256 power = wholeSpe * config.powerPerSpeBurned;
        speToken.burnFrom(msg.sender, speAmount);

        user.burnedSpe += speAmount;
        user.burnedPower += power;
        totalPower += power;

        emit SpeBurnedForPower(msg.sender, speAmount, power);
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

        totalReward = miningReward + nodeReward + referralReward;
        require(totalReward > 0, "SparkExchange: no reward");
        rewardToken.mint(msg.sender, totalReward);

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
            uint256 burnedPower,
            uint256 burnedSpe,
            Rank rank,
            uint256 referralRewardExpireAt
        )
    {
        Account storage user = accounts[account];
        referrer = user.referrer;
        miners = user.miners;
        directMiners = user.directMiners;
        teamMiners = user.teamMiners;
        basePower = user.basePower;
        referralPower = user.referralPower;
        nodeFuelPower = user.nodeFuelPower;
        burnedPower = user.burnedPower;
        burnedSpe = user.burnedSpe;
        personalPower = _personalPower(user);
        rank = effectiveRank(account);
        referralRewardExpireAt = user.referralRewardExpireAt;
    }

    function effectiveRank(address account) public view returns (Rank) {
        Account storage user = accounts[account];
        if (user.rankLocked) {
            return user.manualRank;
        }

        if (user.directMiners >= 5 && user.teamMiners >= 20_000 && user.miners >= 2_000) {
            return Rank.SuperPool;
        }

        if (user.directMiners >= 5 && user.teamMiners >= 2_000 && user.miners >= 200) {
            return Rank.HoneycombPool;
        }

        if (user.directMiners >= 5 && user.teamMiners >= 20 && user.miners >= 5) {
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

    function setManualRank(address account, Rank rank, bool locked) external onlyOwner {
        accounts[account].manualRank = rank;
        accounts[account].rankLocked = locked;
        emit ManualRankUpdated(account, rank, locked);
    }

    function setStableToken(address stableToken_) external onlyOwner {
        require(stableToken_ != address(0), "SparkExchange: stable required");
        stableToken = IERC20(stableToken_);
        emit TokensUpdated(stableToken_, treasury);
    }

    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "SparkExchange: treasury required");
        treasury = treasury_;
        emit TokensUpdated(address(stableToken), treasury_);
    }

    function setConfig(Config calldata nextConfig) external onlyOwner {
        require(nextConfig.minerBasePower > 0, "SparkExchange: base power required");
        require(nextConfig.claimWindow >= 1 hours, "SparkExchange: claim window too short");
        config = nextConfig;
        emit ConfigUpdated(nextConfig);
    }

    function setGenerationBps(uint256[] calldata nextBps) external onlyOwner {
        require(nextBps.length > 0 && nextBps.length <= 12, "SparkExchange: invalid depth");
        delete generationBps;
        for (uint256 i = 0; i < nextBps.length; i++) {
            require(nextBps[i] <= 10_000, "SparkExchange: invalid bps");
            generationBps.push(nextBps[i]);
        }
    }

    function generationDepth() external view returns (uint256) {
        return generationBps.length;
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

    function _addMiners(address account, uint256 quantity) internal {
        Account storage user = accounts[account];
        _touch(user);

        uint256 basePower = config.minerBasePower * quantity;
        uint256 referralPower = config.minerReferralPower * quantity;
        uint256 nodeFuelPower = config.minerNodeFuelPower * quantity;

        user.miners += quantity;
        user.basePower += basePower;
        user.referralPower += referralPower;
        user.nodeFuelPower += nodeFuelPower;

        totalMiners += quantity;
        totalPower += basePower + referralPower + nodeFuelPower;
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
            uint256 reward = (baseAmount * generationBps[i]) / 10_000;
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

    function _personalPower(Account storage user) internal view returns (uint256) {
        return user.basePower + user.referralPower + user.nodeFuelPower + user.burnedPower;
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

        if (user.directMiners >= 5 && user.teamMiners >= 20_000 && user.miners >= 2_000) {
            return Rank.SuperPool;
        }

        if (user.directMiners >= 5 && user.teamMiners >= 2_000 && user.miners >= 200) {
            return Rank.HoneycombPool;
        }

        if (user.directMiners >= 5 && user.teamMiners >= 20 && user.miners >= 5) {
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
}
