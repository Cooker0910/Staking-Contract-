const EnvoyStaking = artifacts.require("EnvoyStaking");
const TestToken = artifacts.require("TestToken");

const truffleAssert = require('truffle-assertions');
const truffleHelpers = require('openzeppelin-test-helpers');

const sigs = require('../utils/signatures.js');
const { assertion } = require('openzeppelin-test-helpers/src/expectRevert');
const assert = require('assert');
const signerKey = sigs.signerKey
const signatureAddress = sigs.signatureAddress
const getSignature = sigs.getSignature
/*
Test different situations of rewards claiming
 - Claiming and adding to staking balance with compounded interest
 - Claiming and withdrawing rewards directly instead of restaking
 - Claiming in between compounding periods
 - Claiming with large stakes over long periods
 - Claiming with weighted stakeholders
*/
contract("Rewarding single user", function(accounts) {
    
    // Current time
    var startTime
    var currentTime
    
    // User addresses
    const ownerAddress = accounts[0];
    const staker = accounts[1];
    
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
        rewardPeriodDuration = await contract.rewardPeriodDuration.call()
        
        stake = web3.utils.toWei('50')
        
        // Should work: tested in ./2_test_staking.js
        await token.approve(contract.address, stake, {from: staker})
        await contract.stake(stake, {from: staker})
        contractBalance = await token.balanceOf(contract.address)

    }),

    it("Rewarding 1st reward period and add to staking balance", async function() {

        var initialRewardPeriod = await contract.latestRewardPeriod.call()
        var initialStakingBalance = await contract.totalStakingBalance.call(initialRewardPeriod, 0)
        var initialWeightedStakingBalance = await contract.totalStakingBalance.call(initialRewardPeriod, 1)
        var initialNewStakingBalance = await contract.totalNewStake.call(0)
        var initialNewWeightedStakingBalance = await contract.totalNewStake.call(1)
        var initialStakerInfo = await contract.stakeholders.call(staker)

        // Move 2 periods in time to have staked for a full period in time
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(2)));

        assert.equal(await contract.currentPeriod.call(), 2, "The period was not updated correctly")

        // Claim rewards on chain
        await contract.claimRewards((await contract.currentPeriod.call()), false, {from: staker})
        
        // Make sure a new reward period was added (because the total stake was updated)
        var newRewardPeriod = await contract.latestRewardPeriod.call()
        assert.equal('2', newRewardPeriod.toString(),
        "Reward period not added")
        
        // Calculate the rewards off-chain
        var newStakingBalance = await contract.totalStakingBalance.call(newRewardPeriod, 0)
        var newWeightedStakingBalance = await contract.totalStakingBalance.call(newRewardPeriod, 1)
        var newNewStakingBalance = await contract.totalNewStake.call(0)
        var newNewWeightedStakingBalance = await contract.totalNewStake.call(1)
        var newStakerInfo = await contract.stakeholders.call(staker)

        // Make sure reward per period is correct for the latest period to reward
        assert.equal((await contract.rewardPeriods.call(newRewardPeriod)).rewardPerPeriod.toString(), '135000000000000000000000')
        var rpp = web3.utils.toBN('135000000000000000000000')
        // Compare balance after claiming - staker should have claimed all rewards
        // New stake should have been added to the initial stake
        assert.equal(initialStakerInfo.stakingBalance.add(initialStakerInfo.newStake.add(rpp)).toString(),
             newStakerInfo.stakingBalance.toString(),
            "Staking reward not updated correctly")
        assert.equal(newStakerInfo.newStake.toString(), '0', 'New stake not reset')

        // Check if locked tokens were added
        assert.equal(newStakerInfo.lockedRewards.toString(), rpp, 'Locked tokens not added')

        // Make sure last period definition and last claimed period are changed
        assert.equal(newStakerInfo.lastClaimed.toString(), (await contract.currentPeriod.call()).toString(),
            "Claim period not updated correctly")

        // Check if total balance is updated correctly and if the claimed rewards are updated
        assert.equal(newStakingBalance.toString(), initialStakingBalance.add(initialNewStakingBalance).add(rpp).toString(),
            "Total stake for latest period not set correctly")
        
        // New stake is added to staking balance
        assert.equal(newNewStakingBalance.toString(), '0',
            "Total new stake for latest period not set correctly")
        
        // All rewards are claimed, check if correct
        // assert.equal((await contract.rewards.call(newRewardPeriod, 0)).toString(), rpp.toString(),
        //     "Total rewards for latest period not set correctly")
        
    }),
    it("Rewarding 1st reward period and withdraw the funds", async function() {

        var initialRewardPeriod = await contract.latestRewardPeriod.call()
        var initialStakingBalance = await contract.totalStakingBalance.call(initialRewardPeriod, 0)
        var initialWeightedStakingBalance = await contract.totalStakingBalance.call(initialRewardPeriod, 1)
        var initialNewStakingBalance = await contract.totalNewStake.call(0)
        var initialNewWeightedStakingBalance = await contract.totalNewStake.call(1)
        var initialStakerInfo = await contract.stakeholders.call(staker)
        var initialTokenBalance = await token.balanceOf(staker)

        // Move 2 periods in time to have staked for a full period in time
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(2)));

        assert.equal(await contract.currentPeriod.call(), 2, "The period was not updated correctly")

        // Claim rewards on chain
        await contract.claimRewards((await contract.currentPeriod.call()), true, {from: staker})
        
        // Make sure a new reward period was added (because the total stake was updated)
        var newRewardPeriod = await contract.latestRewardPeriod.call()
        assert.equal('2', newRewardPeriod.toString(),
        "Reward period not added")
        
        // Calculate the rewards off-chain
        var newStakingBalance = await contract.totalStakingBalance.call(newRewardPeriod, 0)
        var newWeightedStakingBalance = await contract.totalStakingBalance.call(newRewardPeriod, 1)
        var newNewStakingBalance = await contract.totalNewStake.call(0)
        var newNewWeightedStakingBalance = await contract.totalNewStake.call(1)

        var newStakerInfo = await contract.stakeholders.call(staker)
        var newTokenBalance = await token.balanceOf(staker)

        // Make sure reward per period is correct for the new period
        assert.equal((await contract.rewardPeriods.call(newRewardPeriod)).rewardPerPeriod.toString(), '135000000000000000000000')
        var rpp = web3.utils.toBN('135000000000000000000000')

        // Compare balance after claiming
        assert.equal(initialStakerInfo.newStake.toString(), newStakerInfo.stakingBalance.toString(),
            "Staked amount not updated correctly")
        assert.equal('0', newStakerInfo.newStake.toString(),
            "New staked amount not updated correctly")
        // Check if locked tokens were added
        assert.equal(newStakerInfo.lockedRewards.toString(), rpp, 'Locked tokens not added')
        
        // Check if tokens are sent to staker
        assert.equal(initialTokenBalance.add(rpp).toString(),
            newTokenBalance.toString(),
            "Funds not withdrawn correctly")
            
        // Make sure last period definition and last claimed period are changed
        assert.equal(newStakerInfo.lastClaimed.toString(), (await contract.currentPeriod.call()).toString(),
            "Claim period not updated correctly")
        
        // Check if total balance is updated correctly and if the claimed rewards are updated
        assert.equal(newStakingBalance.toString(), initialStakingBalance.add(initialNewStakingBalance).toString(),
            "Total stake for latest period not set correctly")

        // New stake is added to staking balance
        assert.equal(newNewStakingBalance.toString(), '0',
            "Total new stake for latest period not set correctly")
        // All rewards are claimed, check if correct
        // assert.equal((await contract.rewards.call(newRewardPeriod, 0)).toString(), rpp.toString(),
        //     "Total rewards for latest period not set correctly")

        
    }),

    it("Only 1 reward per period claimable, no double spending", async function() {

        // Move 10 periods in time to have staked for a multiple periods
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(10)));
        await contract.claimRewards((await contract.currentPeriod.call()), false, {from: staker})

        var initialRewardPeriod = await contract.latestRewardPeriod.call()
        var initialStakingBalance = await contract.totalStakingBalance.call(initialRewardPeriod, 0)
        var initialWeightedStakingBalance = await contract.totalStakingBalance.call(initialRewardPeriod, 1)
        var initialNewStakingBalance = await contract.totalNewStake.call(0)
        var initialNewWeightedStakingBalance = await contract.totalNewStake.call(1)
        var initialStakerInfo = await contract.stakeholders.call(staker)
        var initialTokenBalance = await token.balanceOf(staker)

        // Claim again in the same period, in both ways
        await contract.claimRewards((await contract.currentPeriod.call()), false, {from: staker})
        await contract.claimRewards((await contract.currentPeriod.call()), true, {from: staker})

        var newRewardPeriod = await contract.latestRewardPeriod.call()
        var newStakingBalance = await contract.totalStakingBalance.call(newRewardPeriod, 0)
        var newWeightedStakingBalance = await contract.totalStakingBalance.call(newRewardPeriod, 1)
        var newNewStakingBalance = await contract.totalNewStake.call(0)
        var newNewWeightedStakingBalance = await contract.totalNewStake.call(1)

        var newStakerInfo = await contract.stakeholders.call(staker)
        var newTokenBalance = await token.balanceOf(staker)

        // Nothing should change
        assert.equal(initialRewardPeriod.toString(),newRewardPeriod.toString())
        assert.equal(initialStakingBalance.toString(),newStakingBalance.toString())
        assert.equal(initialWeightedStakingBalance.toString(),newWeightedStakingBalance.toString())
        assert.equal(initialNewStakingBalance.toString(),newNewStakingBalance.toString())
        assert.equal(initialNewWeightedStakingBalance.toString(),newNewWeightedStakingBalance.toString())
        assert.equal(initialTokenBalance.toString(),newTokenBalance.toString())
        assert.equal(initialStakerInfo.stakingBalance.toString(),newStakerInfo.stakingBalance.toString())
    }),

    it("Claim locked tokens after longer period", async function() {
        var periodsForExtraReward = await contract.periodsForExtraReward.call()
        // Move 182 periods in time to move to period before tokens are unlocked
        var initialRewardPeriod = await contract.latestRewardPeriod.call()
        var initialStakingBalance = await contract.totalStakingBalance.call(initialRewardPeriod, 0)
        var initialWeightedStakingBalance = await contract.totalStakingBalance.call(initialRewardPeriod, 1)
        var initialNewStakingBalance = await contract.totalNewStake.call(0)
        var initialNewWeightedStakingBalance = await contract.totalNewStake.call(1)
        var initialStakerInfo = await contract.stakeholders.call(staker)
        var initialTokenBalance = await token.balanceOf(staker)

        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.mul(periodsForExtraReward)));
        await contract.claimRewards((await contract.currentPeriod.call()), false, {from: staker})

        // Make sure a new reward period was added (because the total stake was updated)
        var newRewardPeriod = await contract.latestRewardPeriod.call()
        assert.equal(periodsForExtraReward.toString(), newRewardPeriod.toString(),
            "Reward period not added")

        // Calculate the rewards off-chain
        var newStakingBalance = await contract.totalStakingBalance.call(newRewardPeriod, 0)
        var newWeightedStakingBalance = await contract.totalStakingBalance.call(newRewardPeriod, 1)
        var newNewStakingBalance = await contract.totalNewStake.call(0)
        var newNewWeightedStakingBalance = await contract.totalNewStake.call(1)

        var newStakerInfo = await contract.stakeholders.call(staker)
        var newTotalLockedTokens = await contract.totalLockedRewards.call(0)
        // Make sure reward per period is correct for the new period
        assert.equal((await contract.rewardPeriods.call(newRewardPeriod)).rewardPerPeriod.toString(), '135000000000000000000000', 'RPP not correct')
        var rpp = web3.utils.toBN('135000000000000000000000')
        // Compare balance after claiming - staker should have claimed all rewards
        // New stake should have been added to the initial stake
        assert.equal(initialStakerInfo.stakingBalance.add(initialStakerInfo.newStake.add(rpp.mul(periodsForExtraReward.subn(1)))).toString(),
             newStakerInfo.stakingBalance.toString(),
            "Staking reward not updated correctly")
        assert.equal(newStakerInfo.newStake.toString(), '0', 'New stake not reset')

        // Check if locked tokens were added
        assert.equal(newStakerInfo.lockedRewards.toString(), rpp.mul(periodsForExtraReward.subn(1)), 'Locked tokens not added')
        assert.equal(newTotalLockedTokens.toString(), rpp.mul(periodsForExtraReward.subn(1)), 'Locked tokens not added')

        // Move one more period to be able to claim the locked tockens
        // Make sure a new reward period was added (because the total stake was updated)

        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));
        await contract.claimRewards((await contract.currentPeriod.call()), false, {from: staker})
        newRewardPeriod = await contract.latestRewardPeriod.call()
        assert.equal(periodsForExtraReward.addn(1).toString(), newRewardPeriod.toString(),
            "Reward period not added")

        var newStakingBalance = await contract.totalStakingBalance.call(newRewardPeriod, 0)
        var newWeightedStakingBalance = await contract.totalStakingBalance.call(newRewardPeriod, 1)
        var newNewStakingBalance = await contract.totalNewStake.call(0)
        var newNewWeightedStakingBalance = await contract.totalNewStake.call(1)
    
        newStakerInfo = await contract.stakeholders.call(staker)
        newTotalLockedTokens = await contract.totalLockedRewards.call(0)

        // Compare balance after claiming
        // All rewards + extra rewards should be added
        assert.equal(initialStakerInfo.stakingBalance.add(initialStakerInfo.newStake.add(rpp.mul(periodsForExtraReward.muln(2)))).toString(),
            newStakerInfo.stakingBalance.toString(),
            "Staked amount not updated correctly")
        assert.equal('0', newStakerInfo.newStake.toString(),
            "New staked amount not updated correctly")
        // Check if locked tokens were added
        assert.equal('0', newStakerInfo.lockedRewards.toString(), 'Locked tokens not reset')
        assert.equal(newTotalLockedTokens.toString(), '0', 'Locked tokens not added')

        // Make sure last period definition and last claimed period are changed
        assert.equal(newStakerInfo.lastClaimed.toString(), (await contract.currentPeriod.call()).toString(),
            "Claim period not updated correctly")

        // Check if total balance is updated correctly
        // Locked rewards are not added yet
        assert.equal(newStakingBalance.toString(), initialStakingBalance.add(initialNewStakingBalance).add(rpp.mul(periodsForExtraReward.muln(2))).toString(),
            "Total stake for latest period not set correctly")

        // New stake is added to staking balance
        assert.equal(newNewStakingBalance.toString(), '0',
            "Total new stake for latest period not set correctly")
        
        // Move one more period to be able to see the locked rewards in the totals
        // Make sure a new reward period was added (because the total stake was updated)
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));
        await contract.claimRewards((await contract.currentPeriod.call()), false, {from: staker})
        newRewardPeriod = await contract.latestRewardPeriod.call()
        assert.equal(periodsForExtraReward.addn(2).toString(), newRewardPeriod.toString(),
            "Reward period not added")

        newStakingBalance = await contract.totalStakingBalance.call(newRewardPeriod, 0)
        newNewStakingBalance = await contract.totalNewStake.call(0)
        newStakerInfo = await contract.stakeholders.call(staker)
        newTotalLockedTokens = await contract.totalLockedRewards.call(0)

        // Compare balance after claiming
        // All rewards + extra rewards should be added
        assert.equal(initialStakerInfo.stakingBalance.add(initialStakerInfo.newStake.add(rpp.mul(periodsForExtraReward.muln(2).addn(1)))).toString(),
            newStakerInfo.stakingBalance.toString(),
            "Staked amount not updated correctly")
        assert.equal('0', newStakerInfo.newStake.toString(),
            "New staked amount not updated correctly")
        // Check if locked tokens were added
        assert.equal(rpp, newStakerInfo.lockedRewards.toString(), 'Locked tokens not reset')
        assert.equal(rpp, newTotalLockedTokens.toString(), 'Locked tokens not added')

        // Make sure last period definition and last claimed period are changed
        assert.equal(newStakerInfo.lastClaimed.toString(), (await contract.currentPeriod.call()).toString(),
            "Claim period not updated correctly")

        // Check if total balance is updated correctly
        // Locked rewards are not added yet
        assert.equal(newStakingBalance.toString(), initialStakingBalance.add(initialNewStakingBalance).add(rpp.mul(periodsForExtraReward.muln(2).addn(1))).toString(),
            "Total stake for latest period not set correctly")

        // New stake is added to staking balance
        assert.equal(newNewStakingBalance.toString(), '0',
            "Total new stake for latest period not set correctly")
        
        // Move past the next unlock date, check if everything is still correct

        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.mul(periodsForExtraReward)));
        await contract.claimRewards((await contract.currentPeriod.call()), false, {from: staker})

        // Make sure a new reward period was added (because the total stake was updated)
        newRewardPeriod = await contract.latestRewardPeriod.call()
        assert.equal(periodsForExtraReward.muln(2).addn(2).toString(), newRewardPeriod.toString(),
            "Reward period not added")

        // Calculate the rewards off-chain
        newStakingBalance = await contract.totalStakingBalance.call(newRewardPeriod, 0)
        newWeightedStakingBalance = await contract.totalStakingBalance.call(newRewardPeriod, 1)
        newNewStakingBalance = await contract.totalNewStake.call(0)
        newNewWeightedStakingBalance = await contract.totalNewStake.call(1)
        newStakerInfo = await contract.stakeholders.call(staker)
        newTotalLockedTokens = await contract.totalLockedRewards.call(0)
        // Make sure reward per period is correct for the new period
        assert.equal((await contract.rewardPeriods.call(newRewardPeriod)).rewardPerPeriod.toString(), '135000000000000000000000', 'RPP not correct')
        rpp = web3.utils.toBN('135000000000000000000000')
        // Compare balance after claiming - staker should have claimed all rewards
        // New stake should have been added to the initial stake
        assert.equal(initialStakingBalance.add(initialNewStakingBalance).add(rpp.mul(periodsForExtraReward.muln(4).addn(1))).toString(),
             newStakerInfo.stakingBalance.toString(),
            "Staking reward not updated correctly")
        assert.equal(newStakerInfo.newStake.toString(), '0', 'New stake not reset')

        // Check if locked tokens were added
        assert.equal(newStakerInfo.lockedRewards.toString(), rpp.toString(), 'Locked tokens not added')
        assert.equal(newTotalLockedTokens.toString(), rpp.toString(), 'Locked tokens not added')

    }),
    it("Forecast reward calculation in the future", async function() {
        var initialRewardPeriod = await contract.latestRewardPeriod.call()
        var initialStakingBalance = await contract.totalStakingBalance.call(initialRewardPeriod, 0)
        var initialWeightedStakingBalance = await contract.totalStakingBalance.call(initialRewardPeriod, 1)
        var initialNewStakingBalance = await contract.totalNewStake.call(0)
        var initialNewWeightedStakingBalance = await contract.totalNewStake.call(1)
        var initialStakerInfo = await contract.stakeholders.call(staker)
        var initialTokenBalance = await token.balanceOf(staker)

        // No time is passed, still period 0
        assert.equal((await contract.currentPeriod.call()).toString(), '0', "The period was not updated correctly")
        
        // Move to period 2 to have an initial reward value
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(2)));
        await contract.handleNewPeriod(2, {from: staker})

        // Calculate rewards for 3 periods based on latest info
        var rewardCalculation = await contract.calculateRewards.call(staker, '3')
        
        assert.equal((await contract.rewardPeriods.call('1')).rewardPerPeriod.toString(), '135000000000000000000000')
        var expectedRewards = (await contract.rewardPeriods.call('1')).rewardPerPeriod.muln(2)
        // Check the calculated rewards
        assert.equal(rewardCalculation[0].toString(), expectedRewards.toString())
        // Check the calculated locked rewards
        assert.equal(rewardCalculation[1].toString(), expectedRewards.toString())

        // Check zero is returned immediately when not moving in time
        var zeroCalculation = await contract.calculateRewards.call(staker, '0')
        assert.equal(zeroCalculation[0].toString(), '0')
        assert.equal(zeroCalculation[1].toString(), '0')

        // Check zero is returned immediately when being inactive
        var inactiveCalculation = await contract.calculateRewards.call(staker, '0')
        assert.equal(inactiveCalculation[0].toString(), '0')
        assert.equal(inactiveCalculation[1].toString(), '0')

        // Move 2 periods passed extra rewards claiming point
        // - New rewards on 183 periods
        // - Extra rewards should be paid on 182 periods
        // - Locked tokens for 1 period
        rewardCalculation = await contract.calculateRewards.call(staker, '184')

        rpp = (await contract.rewardPeriods.call('1')).rewardPerPeriod
        // Check the calculated rewards
        assert.equal(rewardCalculation[0].toString(), rpp.muln(365).toString())
        // Check the calculated locked rewards
        assert.equal(rewardCalculation[1].toString(), rpp.toString())
        // Move to next release date
        // - New rewards on 364 periods
        // - Extra rewards should be paid on 364 periods
        rewardCalculation = await contract.calculateRewards.call(staker, '365')

        rpp = (await contract.rewardPeriods.call('1')).rewardPerPeriod
        // Check the calculated locked rewards
        assert.equal(rewardCalculation[1].toString(), '0')
        // Check the calculated rewards
        assert.equal(rewardCalculation[0].toString(), rpp.muln(728).toString())
        // Move to next release date
        // - New rewards on 365 periods
        // - Extra rewards should be paid on 364 periods
        // - Locked tokens for 1 period
        rewardCalculation = await contract.calculateRewards.call(staker, '366')

        rpp = (await contract.rewardPeriods.call('1')).rewardPerPeriod
        // Check the calculated locked rewards
        assert.equal(rewardCalculation[1].toString(), rpp.toString())
        // Check the calculated rewards
        assert.equal(rewardCalculation[0].toString(), rpp.muln(729).toString())

        // Move to next release date
        // - New rewards on 546 periods
        // - Extra rewards should be paid on 546 periods
        rewardCalculation = await contract.calculateRewards.call(staker, '547')

        rpp = (await contract.rewardPeriods.call('1')).rewardPerPeriod
        // Check the calculated locked rewards
        assert.equal(rewardCalculation[1].toString(), '0')
        // Check the calculated rewards
        assert.equal(rewardCalculation[0].toString(), rpp.muln(1092).toString())
        // Move to next release date
        // - New rewards on 1092 periods
        // - Extra rewards should be paid on 1092 periods
        rewardCalculation = await contract.calculateRewards.call(staker, '1093')

        rpp = (await contract.rewardPeriods.call('1')).rewardPerPeriod
        // Check the calculated rewards
        assert.equal(rewardCalculation[0].toString(), rpp.muln(2184).toString())
        // Check the calculated locked rewards
        assert.equal(rewardCalculation[1].toString(), '0')

                

    }),

    it("Calculate rewards past end of contract", async function() {
        
        // Move to period 3 to have an initial reward value
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(2)));
        await contract.handleNewPeriod(2, {from: staker})

        // Forecast beyond contract end time
        var maxNumberOfPeriods = await contract.maxNumberOfPeriods.call()
        var periodsForExtraReward = await contract.periodsForExtraReward.call()
        var extraRewardPeriods = Math.floor(maxNumberOfPeriods.div(periodsForExtraReward).toNumber())
        var rewardCalculation = await contract.calculateRewards.call(staker, maxNumberOfPeriods)
        var rpp = web3.utils.toBN('135000000000000000000000')
        
        assert.equal(rewardCalculation[0].toString(), rpp.mul(maxNumberOfPeriods.add(periodsForExtraReward.muln(extraRewardPeriods)).subn(1)).toString(),"Reward not capped correctly in forecast")
        //     // Move beyond the end of contract
        // await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(maxNumberOfPeriods.addn(10).mul(rewardPeriodDuration)));
        // // Claim the rewards and check balance
        // await contract.claimRewards((await contract.currentPeriod.call()), false, {from: staker})
        // console.log((await contract.stakeholders.call(staker)).stakingBalance.toString())
        // assert.equal((await contract.stakeholders.call(staker)).stakingBalance.toString(), rpp.mul(maxNumberOfPeriods.add(periodsForExtraReward.muln(extraRewardPeriods).subn(2))).toString(), "failed")


    })

})