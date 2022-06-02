const CookerStaking = artifacts.require("CookerStaking");
const TestToken = artifacts.require("TestToken");

const truffleAssert = require('truffle-assertions');
const truffleHelpers = require('openzeppelin-test-helpers');


const sigs = require('../utils/signatures.js')
const signerKey = sigs.signerKey
const signatureAddress = sigs.signatureAddress
const getSignature = sigs.getSignature

/**
 * Module to test the staking feature:
 * - Test whether new funds can be added to the staking balance
 * - Test whether tokens are transfered
 * - Test whether totals are updated correctly
 * - Test whether waited total is updated correctly
 * - Test restaking
 * - Test whether user is listed as active after staking
 */
contract("Staking", function(accounts) {
    
    // Current time
    var startTime
    var currentTime
    
    // User addresses
    const ownerAddress = accounts[0]
    const staker = accounts[1]
    const staker2 = accounts[2]
    const staker3 = accounts[3]
    
    // Contracts to use
    var contract
    var token
       
    // Store initial contract values
    var contractBalance
    var rewardPeriodDuration
    var stake
    

    before(async function() {
        // Set start time        
        startTime = await truffleHelpers.time.latest();
    }),

    beforeEach(async function() {
        // Reset time        
        currentTime = startTime;
        
        // Make sure contracts are deployed
        token = await TestToken.new();
        contract = await CookerStaking.new(maxNumberOfPeriods_ = web3.utils.toBN(1095),
            rewardPeriodDuration_ = web3.utils.toBN(86400),
            periodsForExtraReward_ = 182, // 20 for test purpose
            extraRewardMultiplier_ = 10**6,
            cooldown_ = web3.utils.toBN(86400 * 7),
            // rewardPerPeriod_ = web3.utils.toBN('135000000000000000000000'),
            earlyWithdrawalFee_ = web3.utils.toBN(10**7),
            // wallet_ = accounts[0],
            signatureAddress, token.address);        
        // Make sure the contract and accounts have funds
        for(account in accounts){
            await token.claim(accounts[account], web3.utils.toWei('100'))
        }

        var totalInitialRewards = web3.utils.toBN('135000000000000000000000').mul((await contract.maxNumberOfPeriods.call())).muln(2)

        await token.claim(contract.address, totalInitialRewards)

        // Store initial contract values
        contractBalance = await token.balanceOf.call(contract.address)
        rewardPeriodDuration = await contract.rewardPeriodDuration.call()
        
        stake = web3.utils.toBN(web3.utils.toWei('50'))
    }),

    it("Staking init", async function() {
      
      assert.equal((await contract.maxNumberOfPeriods.call()).toString(), "1095")
      assert.equal((await contract.rewardPeriodDuration.call()).toString(), "86400")
      assert.equal((await contract.periodsForExtraReward.call()).toString(), "182")
      assert.equal((await contract.cooldown.call()).toString(), "604800")
      assert.equal((await contract.earlyWithdrawalFee.call()).toString(), "10000000")
    //   assert.equal((await contract.wallet.call()).toString(), ownerAddress)
      assert.equal((await contract.signatureAddress.call()).toString(), signatureAddress)
      assert.equal((await contract.stakingToken.call()).toString(), token.address)

      var latestRewardPeriod = await contract.latestRewardPeriod.call()
      assert.equal(latestRewardPeriod, 0);
      assert.equal((await contract.totalNewStake.call(0)).toString(), web3.utils.toBN(0))

    })

    it("Staking new funds", async function() {

        // Tokens need to be approved before staking is possible
        await truffleAssert.reverts(contract.stake(stake, {from: staker}),
            "Token transfer not approved");

        var stakerBalance = await token.balanceOf(staker)
        var latestRewardPeriod = await contract.latestRewardPeriod.call()
        var totalNewStake = await contract.totalNewStake.call(0)
        var totalNewWeightedStake = await contract.totalNewStake.call(1)
    
        // Verify the staker is listed as inactive
        assert.equal((await contract.activeStakeholder(staker)), false, "Staker is already active and should be inactive")

        // After approving, staking is possible
        await token.approve(contract.address, stake, {from: staker})

        await truffleAssert.reverts(contract.stake('0', {from: staker}),
            "Amount not positive");
        await contract.stake(stake, {from: staker})

        // Check if the tokenbalance was updated correctly for the staking contract
        assert.equal((await token.balanceOf(contract.address)).toString(), contractBalance.add(web3.utils.toBN(stake)).toString())

        // Check if the tokenbalance was updated correctly for the stakeholder
        assert.equal((await token.balanceOf(staker)).toString(), stakerBalance.sub(web3.utils.toBN(stake)).toString())

        // Check if the staking balance of the stakeholder was updated
        assert.equal((await contract.stakeholders.call(staker)).newStake.toString(), stake)

        // Check if weight counts updated
        assert.equal((await contract.weightCounts.call(0)).toString(), "1");

        // Check if the start date of the stakeholder was updated
        // Start time is now
        assert.equal((await contract.stakeholders.call(staker)).startDate.toString(), await truffleHelpers.time.latest())
        // Start period for claiming is current period
        assert.equal((await contract.stakeholders.call(staker)).lastClaimed.toString(), (await contract.currentPeriod()))

        // Check if the total staked amount of the current period was updated correctly
        assert.equal(totalNewStake.add(web3.utils.toBN(stake)), (await contract.totalNewStake.call(0)).toString())
        // Check if weighted calculation is correct
        assert.equal(totalNewWeightedStake.add(web3.utils.toBN(stake)), (await contract.totalNewStake.call(1)).toString())

        // Verify if stakeholder is active
        assert.equal((await contract.activeStakeholder(staker)), true, "Staker is still inactive and should be active")

        // Verify restaking in same period
        await token.approve(contract.address, stake, {from: staker})
        await contract.stake(stake, {from: staker})
        assert.equal((await token.balanceOf(staker)).toString(), stakerBalance.sub(web3.utils.toBN(stake.muln(2))).toString())
        assert.equal((await contract.stakeholders.call(staker)).newStake.toString(), stake.muln(2))
        assert.equal(totalNewStake.add(web3.utils.toBN(stake.muln(2))), (await contract.totalNewStake.call(0)).toString())

    }),

    it("Staking should handle new period", async function() {

        // After approving, staking is possible
        await token.approve(contract.address, web3.utils.toWei('500'), {from: staker})

        // Stake
        await contract.stake(stake, {from: staker})

        // First period
        assert.equal((await contract.currentPeriod()), 0)
        assert.equal((await contract.latestRewardPeriod.call()), 0)
        assert.equal((await contract.totalLockedRewards.call(0)), 0)
        assert.equal((await contract.weightCounts.call(0)), 1)

        var rewardPeriod = await contract.rewardPeriods.call(0);
        assert.equal(rewardPeriod.rewardPerPeriod.toString(), '0')
        assert.equal(rewardPeriod.extraRewardMultiplier.toString(), '1000000')
        assert.equal(rewardPeriod.maxWeight.toString(), '0')

        // No staking balance yet
        assert.equal((await contract.stakeholders.call(staker)).stakingBalance.toString(), 0)

        // Check if the staking balance of the stakeholder was updated
        assert.equal((await contract.stakeholders.call(staker)).newStake.toString(), stake)

        // Move 1 periods
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));

        // Stake
        await contract.stake(stake, {from: staker})

        // Second period
        assert.equal((await contract.currentPeriod()), 1)
        assert.equal((await contract.latestRewardPeriod.call()), 1)
        assert.equal((await contract.totalLockedRewards.call(0)), 0)
        assert.equal((await contract.weightCounts.call(0)), 1)

        rewardPeriod = await contract.rewardPeriods.call(1);
        assert.equal(rewardPeriod.rewardPerPeriod.toString(), '0')
        assert.equal(rewardPeriod.extraRewardMultiplier.toString(), '1000000')
        assert.equal(rewardPeriod.maxWeight.toString(), '0')

        // First stake now in staking balance
        assert.equal((await contract.stakeholders.call(staker)).stakingBalance.toString(), stake)

        // New stake
        assert.equal((await contract.stakeholders.call(staker)).newStake.toString(), stake)

        // Move 2 periods
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(2)));
        await contract.handleNewPeriod(2, {from: staker})

        rewardPeriod = await contract.rewardPeriods.call(1);
        assert.equal(rewardPeriod.rewardPerPeriod.toString(), '135000000000000000000000')

    }),

    it("Staking should claim rewards", async function() {

        // After approving, staking is possible
        await token.approve(contract.address, web3.utils.toWei('500'), {from: staker})
        await contract.stake('1', {from: staker})

        // Move 1 period
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));

        // Stake
        await contract.stake(stake.subn(1), {from: staker})

        // First period
        assert.equal((await contract.currentPeriod()), 1)
        assert.equal((await contract.latestRewardPeriod.call()), 1)

        // Rewards
        var rewards = await contract.calculateRewards.call(staker, (await contract.currentPeriod.call()))
        assert.equal(rewards.reward.toString(), 0)
        assert.equal(rewards.lockedRewards.toString(), 0)

        // Move 2 periods
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration).muln(2));
        await contract.handleNewPeriod(3, {from: staker})

        // Rewards for 2 periods
        rewards = await contract.calculateRewards.call(staker, (await contract.currentPeriod.call()))
        assert.equal(rewards.reward.toString(), web3.utils.toBN('135000000000000000000000').muln(2).toString())
        assert.equal(rewards.lockedRewards.toString(), web3.utils.toBN('135000000000000000000000').muln(2).toString())

        // Stake
        await contract.stake(stake, {from: staker})

        // Third period
        assert.equal((await contract.currentPeriod()), 3)
        assert.equal((await contract.latestRewardPeriod.call()), 3)

        // 50 stake + 270000 rewards
        assert.equal((await contract.stakeholders.call(staker)).stakingBalance.toString(), web3.utils.toBN('270050000000000000000000'))

        // New stake
        assert.equal((await contract.stakeholders.call(staker)).newStake.toString(), stake)

    })
  
    it("Staking new funds with multiple users", async function() {
        await token.approve(contract.address, stake, {from: staker})
        await token.approve(contract.address, stake, {from: staker2})
        await token.approve(contract.address, stake, {from: staker3})
        await contract.stake(stake, {from: staker})
        await contract.stake(stake, {from: staker2})
        await contract.stake(stake, {from: staker3})

        var latestRewardPeriod = await contract.latestRewardPeriod.call()

        // Check if the total staked amount of the current period was updated correctly
        assert.equal(web3.utils.toBN(stake).muln(3), (await contract.totalNewStake.call(0)).toString())
        // Check if weighted calculation is correct
        assert.equal(web3.utils.toBN(stake).muln(3), (await contract.totalNewStake.call(1)).toString())
    })

    
})