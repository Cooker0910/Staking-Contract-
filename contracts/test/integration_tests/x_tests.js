const EnvoyStaking = artifacts.require("EnvoyStaking");
const TestToken = artifacts.require("TestToken");

const truffleAssert = require('truffle-assertions');
const truffleHelpers = require('openzeppelin-test-helpers');


const sigs = require('../utils/signatures.js')
const signerKey = sigs.signerKey
const signatureAddress = sigs.signatureAddress
const getSignature = sigs.getSignature

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
        contract = await EnvoyStaking.new(maxNumberOfPeriods_ = web3.utils.toBN(1095),
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
      assert.equal((await contract.signatureAddress.call()).toString(), signatureAddress)
      assert.equal((await contract.stakingToken.call()).toString(), token.address)
      
      assert.equal((await contract.maxNumberOfPeriods.call()).toString(), "1095")
      assert.equal((await contract.rewardPeriodDuration.call()).toString(), "86400")
      assert.equal((await contract.periodsForExtraReward.call()).toString(), "182")
      assert.equal((await contract.cooldown.call()).toString(), "604800")
      assert.equal((await contract.earlyWithdrawalFee.call()).toString(), "10000000")

      assert.equal((await contract.latestRewardPeriod.call()), 0);
    })

    it("Stake and withdraw immediately with fees", async function() {
      // Approve
      await token.approve(contract.address, web3.utils.toWei('500'), {from: staker})
      await token.approve(contract.address, web3.utils.toWei('500'), {from: staker2})

      // Balances
      assert.equal((await token.balanceOf(staker)).toString(), web3.utils.toWei('100'))
      assert.equal((await token.balanceOf(staker2)).toString(), web3.utils.toWei('100'))

      // Stake
      await contract.stake(stake, {from: staker})
      await contract.stake(stake, {from: staker})
      await contract.stake(stake, {from: staker2})

      // Withdraw all
      await contract.requestWithdrawal(stake, true, true, {from: staker})
      await contract.requestWithdrawal(stake, true, true, {from: staker})
      await contract.requestWithdrawal(stake, true, true, {from: staker2})

      // Balance
      assert.equal((await token.balanceOf(staker)).toString(), web3.utils.toWei('90'))
      assert.equal((await token.balanceOf(staker2)).toString(), web3.utils.toWei('95'))

    })

    it("Stake and check stakeholder info", async function() {
        // Approve
        await token.approve(contract.address, web3.utils.toWei('500'), {from: staker})
        await token.approve(contract.address, web3.utils.toWei('500'), {from: staker2})

        // Balance
        assert.equal((await token.balanceOf(staker)).toString(), web3.utils.toWei('100'))

        // Stake
        await contract.stake(stake, {from: staker})

        // Balance
        assert.equal((await token.balanceOf(staker)).toString(), web3.utils.toWei('50'))

        // Current period still 0 so nothing to handle
        assert.equal((await contract.currentPeriod()), 0)

        // Stakeholder
        assert.equal((await contract.stakeholders.call(staker)).stakingBalance.toString(), 0)
        assert.equal((await contract.stakeholders.call(staker)).weight.toString(), 0)
        assert.equal((await contract.stakeholders.call(staker)).lastClaimed.toString(), 0)
        assert.equal((await contract.stakeholders.call(staker)).releaseDate.toString(), 0)
        assert.equal((await contract.stakeholders.call(staker)).releaseAmount.toString(), 0)
        assert.equal((await contract.stakeholders.call(staker)).newStake.toString(), web3.utils.toWei('50'))
        assert.equal((await contract.stakeholders.call(staker)).lockedRewards.toString(), 0)
        // WeightCounts
        assert.equal((await contract.weightCounts.call(0)).toString(), 1)
        // RewardPeriods
        assert.equal((await contract.rewardPeriods.call(0)).rewardPerPeriod.toString(), 0)
        assert.equal((await contract.rewardPeriods.call(0)).extraRewardMultiplier.toString(), 1000000)
        assert.equal((await contract.rewardPeriods.call(0)).maxWeight.toString(), 0)

        // Move 1 period
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));
        await contract.handleNewPeriod(1, {from: staker})

        // Move 1 period
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));
        await contract.handleNewPeriod(2, {from: staker})

        // Move 1 period
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));
        await contract.handleNewPeriod(3, {from: staker})

        // Period is now 3
        assert.equal((await contract.currentPeriod.call()).toString(), 3)

        // Reward per period
        assert.equal((await contract.calculateRewardPerPeriod.call()).toString(), web3.utils.toWei('135000'))

        // No rewards for first period
        var rewards = await contract.calculateRewards.call(staker, 1)
        assert.equal(rewards.reward.toString(), 0)
        assert.equal(rewards.lockedRewards.toString(), 0)

        // Rewards for second period
        var rewards = await contract.calculateRewards.call(staker, 2)
        assert.equal(rewards.reward.toString(), web3.utils.toWei('135000'))
        assert.equal(rewards.lockedRewards.toString(), web3.utils.toWei('135000'))

        // Rewards for third period
        var rewards = await contract.calculateRewards.call(staker, 3)
        assert.equal(rewards.reward.toString(), web3.utils.toWei('270000'))
        assert.equal(rewards.lockedRewards.toString(), web3.utils.toWei('270000'))


        // 
        //  Question: why is stakeholder not updated yet?
        // 

        // Stakeholder
        assert.equal((await contract.stakeholders.call(staker)).stakingBalance.toString(), 0)
        assert.equal((await contract.stakeholders.call(staker)).newStake.toString(), web3.utils.toWei('50'))

        // Staking calc methods
        assert.equal((await contract.totalStakingBalance.call(3, 0)).toString(), web3.utils.toWei('270050'))
        assert.equal((await contract.totalStakingBalance.call(3, 1)).toString(), web3.utils.toWei('270050'))
        assert.equal((await contract.totalNewStake.call(0)).toString(), web3.utils.toWei('0'))
        assert.equal((await contract.totalLockedRewards.call(0)).toString(), web3.utils.toWei('270000'))

        // Stake
        await contract.stake(stake, {from: staker})

        // 
        //  Question: when do the lockedRewards unlock?
        // 

        // Stakeholder
        assert.equal((await contract.stakeholders.call(staker)).stakingBalance.toString(), web3.utils.toWei('270050')) // 50 staked + 270k rewards
        assert.equal((await contract.stakeholders.call(staker)).lastClaimed.toString(), 3)
        assert.equal((await contract.stakeholders.call(staker)).releaseDate.toString(), 0)
        assert.equal((await contract.stakeholders.call(staker)).releaseAmount.toString(), 0)
        assert.equal((await contract.stakeholders.call(staker)).newStake.toString(), web3.utils.toWei('50'))
        assert.equal((await contract.stakeholders.call(staker)).lockedRewards.toString(), web3.utils.toWei('270000'))
        // WeightCounts
        assert.equal((await contract.weightCounts.call(0)).toString(), 1)
        // RewardPeriods
        assert.equal((await contract.rewardPeriods.call(0)).rewardPerPeriod.toString(), 0)
        assert.equal((await contract.rewardPeriods.call(0)).extraRewardMultiplier.toString(), 1000000)
        assert.equal((await contract.rewardPeriods.call(0)).maxWeight.toString(), 0)

        // Withdraw all
        await contract.requestWithdrawal(stake, true, true, {from: staker})
        await contract.requestWithdrawal(stake, true, true, {from: staker})

        // Balance
        assert.equal((await token.balanceOf(staker)).toString(), web3.utils.toWei('90'))
    })
    
    it("Reward per period calculation", async function() {
      // Approve
      await token.approve(contract.address, web3.utils.toWei('500'), {from: staker})

      // Contract balance
      assert.equal((await token.balanceOf(contract.address)).toString(), web3.utils.toWei('295650000'))

      // Stake
      await contract.stake(stake, {from: staker})

      // Contract balance
      assert.equal((await token.balanceOf(contract.address)).toString(), web3.utils.toWei('295650050'))

      // Reward per period
      assert.equal((await contract.calculateRewardPerPeriod.call()).toString(), web3.utils.toWei('0'))

      // Move 1 period
      await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));
      await contract.handleNewPeriod(1, {from: staker})

      // Reward per period
      assert.equal((await contract.calculateRewardPerPeriod.call()).toString(), web3.utils.toWei('135000'))

      // Double amount of tokens in countract
      await token.claim(contract.address, web3.utils.toWei('295650000'))

      // Reward per period
      assert.equal((await contract.calculateRewardPerPeriod.call()).toString(), web3.utils.toWei('270000'))

      // Move 1 period
      await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));
      await contract.handleNewPeriod(1, {from: staker})

      // Reward per period
      assert.equal((await contract.calculateRewardPerPeriod.call()).toString(), web3.utils.toWei('270000'))

      // Stake
      await contract.stake(stake, {from: staker})

      // Reward per period
      assert.equal((await contract.calculateRewardPerPeriod.call()).toString(), web3.utils.toWei('270000'))
  })

})