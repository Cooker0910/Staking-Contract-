
const CookerStaking = artifacts.require("CookerStaking");
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
Test different situations of withdrawing
 - Claiming after reward period
 - Claiming instantly
 - Claiming in before end of cooldown with decreasing fee
 - Withdrawing all funds
 - Withdrawing tokens as owner
*/
contract("Withdrawing funds", function(accounts) {
    
    // Current time
    var startTime
    var currentTime
    
    // User addresses
    const ownerAddress = accounts[0];
    const staker = accounts[1];
    const staker2 = accounts[2];
    
    // Contracts to use
    var contract
    var token
       
    // Store initial contract values
    var contractBalance
    var rewardPeriodDuration
    var rewardPerPeriod
    var stake
    var cooldown

    var totalStake
    var stakerBalance
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
            periodsForExtraReward_ = 182,
            extraRewardMultiplier_ = 10**6,
            cooldown_ = web3.utils.toBN(86400 * 7),
            // rewardPerPeriod_ = web3.utils.toBN('135000000000000000000000'),
            earlyWithdrawalFee_ = web3.utils.toBN(10**7),
            // wallet_ = accounts[0],
            signatureAddress, token.address);        

        // Make sure the contract and accounts have funds
        stake = web3.utils.toBN(web3.utils.toWei('5000000000'))
        for(var i=1;i<=2;i++){
            await token.claim(accounts[i], web3.utils.toWei('100000000000'))
            
            // Should work: tested in ./2_test_staking.js
            await token.approve(contract.address, stake.muln(3), {from: accounts[i]})
            await contract.stake(stake, {from: accounts[i]})

        }
        var totalInitialRewards = web3.utils.toBN('135000000000000000000000').mul((await contract.maxNumberOfPeriods.call())).muln(2)
        await token.claim(contract.address, totalInitialRewards)
        contractBalance = await token.balanceOf(contract.address)
        ownerBalance = await token.balanceOf(ownerAddress)

        // Store initial contract values
        rewardPeriodDuration = await contract.rewardPeriodDuration.call()
        rewardPerPeriod = web3.utils.toBN('135000000000000000000000')

        cooldown = await contract.cooldown.call()

        // 8 rewards are paid, half for staker
        totalStake = stake.muln(2).add(rewardPerPeriod.muln(8))
        stakerBalance = stake.add(rewardPerPeriod.muln(4))
    }),
    it("Partial withdraw after cooldown", async function() {
        // Move to 10th period to claim rewards
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(9).toString()));

        var initialBalance = await token.balanceOf.call(staker)
        var amountToWithdraw = rewardPerPeriod

        // Request withdrawal
        await contract.requestWithdrawal(amountToWithdraw, false, true, {from: staker})
        // 10 periods have passed, 8 are rewarded but one is withdrawn
        // Staker only owns half of the rewards
        assert.equal(stakerBalance.sub(amountToWithdraw).toString(), (await contract.stakeholders.call(staker)).stakingBalance.toString())
        assert.equal(totalStake.sub(amountToWithdraw).toString(), (await contract.totalStakingBalance.call(await contract.latestRewardPeriod.call(), 0)).toString())
        releaseDate = web3.utils.toBN(await truffleHelpers.time.latest()).add(cooldown)
        // Locked rewards are still locked
        assert.equal(rewardPerPeriod.muln(4).toString(), (await contract.stakeholders.call(staker)).lockedRewards.toString())

        // Release is configured
        assert.equal(releaseDate.toString(), (await contract.getWithdrawal.call(0, staker)).releaseDate.toString())
        assert.equal(rewardPerPeriod.toString(), (await contract.getWithdrawal.call(0, staker)).releaseAmount.toString())

        // Move beyond cooldown period
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds((await contract.cooldown.call()).toString()));

        await contract.withdrawFunds(0, {from: staker})

        assert.equal(initialBalance.add(amountToWithdraw).toString(), (await token.balanceOf.call(staker)).toString())
        assert.equal('0', (await contract.getWithdrawalLength.call(staker)).toString())

    }),
    it("Instant partial withdraw", async function() {

        // Move to 10th period to claim rewards
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(9).toString()));

        var initialBalance = await token.balanceOf.call(staker)
        var amountToWithdraw = rewardPerPeriod

        // Request withdrawal
        await contract.requestWithdrawal(amountToWithdraw, true, true, {from: staker})
        // 10 periods have passed, 8 are rewarded but one is withdrawn
        assert.equal(stakerBalance.sub(amountToWithdraw).toString(), (await contract.stakeholders.call(staker)).stakingBalance.toString())
        assert.equal(totalStake.sub(amountToWithdraw).toString(), (await contract.totalStakingBalance.call(await contract.latestRewardPeriod.call(), 0)).toString())
        releaseDate = web3.utils.toBN(await truffleHelpers.time.latest()).add(cooldown)
        // Locked rewards are still locked
        assert.equal(rewardPerPeriod.muln(4), (await contract.stakeholders.call(staker)).lockedRewards.toString())

        var earlyWithdrawFee = amountToWithdraw.mul(await contract.earlyWithdrawalFee.call()).div(web3.utils.toBN(10**8))
        // Check balances
        assert.equal(contractBalance.sub(amountToWithdraw).add(earlyWithdrawFee).toString(), (await token.balanceOf(contract.address)).toString())
        assert.equal(initialBalance.add(amountToWithdraw.sub(earlyWithdrawFee)).toString(), (await token.balanceOf(staker)).toString())

        assert.equal('0', (await contract.getWithdrawalLength.call(staker)).toString())

    }),
    it("Partial withdraw after half cooldown period passed", async function() {
        // Move to 10th period to claim rewards
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(9).toString()));

        var initialBalance = await token.balanceOf.call(staker)
        var amountToWithdraw = rewardPerPeriod

        // Request withdrawal
        await contract.requestWithdrawal(rewardPerPeriod, false, true, {from: staker})
        // 10 periods have passed, 8 are rewarded but one is withdrawn
        assert.equal(stakerBalance.sub(amountToWithdraw).toString(), (await contract.stakeholders.call(staker)).stakingBalance.toString())
        assert.equal(totalStake.sub(amountToWithdraw).toString(), (await contract.totalStakingBalance.call(await contract.latestRewardPeriod.call(), 0)).toString())
        releaseDate = web3.utils.toBN(await truffleHelpers.time.latest()).add(cooldown)
        // Locked rewards are still locked
        assert.equal(rewardPerPeriod.muln(4).toString(), (await contract.stakeholders.call(staker)).lockedRewards.toString())

        // Release is configured
        assert.equal(releaseDate, (await contract.getWithdrawal.call(0, staker)).releaseDate.toString())
        assert.equal(amountToWithdraw.toString(), (await contract.getWithdrawal.call(0, staker)).releaseAmount.toString())

        // Move beyond cooldown period
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds((await contract.cooldown.call()).div(web3.utils.toBN(2)).toString()));

        // Fee will be halve compared to instant
        var earlyWithdrawFee = amountToWithdraw.mul(await contract.earlyWithdrawalFee.call())
            .mul((await contract.getWithdrawal.call(0, staker)).releaseDate.sub(await truffleHelpers.time.latest()))
            .div(cooldown.mul(web3.utils.toBN(10**8)))
        
        await contract.withdrawFunds(0, {from: staker})
        // Check balances
        assert.equal(contractBalance.sub(amountToWithdraw).add(earlyWithdrawFee).toString().substring(-18), (await token.balanceOf(contract.address)).toString().substring(-18))
        assert.equal(initialBalance.add(amountToWithdraw.sub(earlyWithdrawFee)).toString().substring(-18), (await token.balanceOf(staker)).toString().substring(-18))
        assert.equal('0', (await contract.getWithdrawalLength.call(staker)).toString())

    }),
    it("Instant, full withrawal", async function() {
        // Move to 10th period to claim rewards
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(9).toString()));

        var initialBalance = await token.balanceOf.call(staker)
        // Request withdrawal with more than available funds
        var amountToWithdraw = totalStake.muln(2)

        // Request withdrawal
        await contract.requestWithdrawal(amountToWithdraw, true, true, {from: staker})
        assert.equal('0', (await contract.stakeholders.call(staker)).stakingBalance.toString())
        assert.equal(totalStake.divn(2).toString(), (await contract.totalStakingBalance.call(await contract.latestRewardPeriod.call(), 0)).toString())

        // Locked rewards are still locked
        assert.equal(rewardPerPeriod.muln(4).toString(), (await contract.stakeholders.call(staker)).lockedRewards.toString())

        var cappedWithdrawAmount = stake.add(rewardPerPeriod.muln(4))

        // 10 periods have passed, 8 are rewarded but one is withdrawn
        var earlyWithdrawFee = cappedWithdrawAmount.mul(await contract.earlyWithdrawalFee.call()).div(web3.utils.toBN(10**8))


        assert.equal(contractBalance.sub(cappedWithdrawAmount).add(earlyWithdrawFee).toString(), (await token.balanceOf(contract.address)).toString())
        assert.equal(initialBalance.add(cappedWithdrawAmount.sub(earlyWithdrawFee)).toString(), (await token.balanceOf(staker)).toString())

        assert.equal('0', (await contract.getWithdrawalLength.call(staker)).toString())

    }),
    it("Partially withdraw newly staked funds", async function() {
        var initialBalance = await token.balanceOf.call(staker)
        // Request withdrawal with more than available funds
        var amountToWithdraw = stake.divn(2)

        // Request withdrawal
        await contract.requestWithdrawal(amountToWithdraw, false, true, {from: staker})
        assert.equal(stake.divn(2).toString(), (await contract.stakeholders.call(staker)).newStake.toString())
        assert.equal(stake.muln(3).divn(2).toString(), (await contract.totalNewStake.call(0)).toString())

        // Move beyond cooldown period
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds((await contract.cooldown.call()).toString()));

        await contract.withdrawFunds(0, {from: staker})

        assert.equal(initialBalance.add(amountToWithdraw).toString(), (await token.balanceOf.call(staker)).toString())
        assert.equal('0', (await contract.getWithdrawalLength.call(staker)).toString())
    
    }),
    it("Fully withdraw newly staked funds", async function() {
        var initialBalance = await token.balanceOf.call(staker)
        // Request withdrawal with more than available funds
        var amountToWithdraw = stake

        // Request withdrawal
        await contract.requestWithdrawal(amountToWithdraw, false, true, {from: staker})
        assert.equal('0'.toString(), (await contract.stakeholders.call(staker)).newStake.toString())
        assert.equal(stake.toString(), (await contract.totalNewStake.call(0)).toString())

        // Move beyond cooldown period
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds((await contract.cooldown.call()).toString()));

        await contract.withdrawFunds(0, {from: staker})

        assert.equal(initialBalance.add(amountToWithdraw).toString(), (await token.balanceOf.call(staker)).toString())
        assert.equal('0', (await contract.getWithdrawalLength.call(staker)).toString())

        assert.equal((await contract.activeStakeholder(staker)), false, "Staker is still active and should be active")
        assert.equal((await contract.stakeholders.call(staker)).startDate, 0, "Staker is still active and should be active")
    
    }),
    it("Withdraw without claiming any rewards", async function() {
        // Move to 10th period without claiming rewards
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(9).toString()));

        var initialBalance = await token.balanceOf.call(staker)
        var amountToWithdraw = stake

        // Request withdrawal without claiming rewards
        await contract.requestWithdrawal(amountToWithdraw, false, false, {from: staker})
        // 10 periods have passed, 8 are rewarded but one is withdrawn
        // Staker only owns half of the rewards
        assert.equal('0', (await contract.stakeholders.call(staker)).stakingBalance.toString())
        assert.equal('0', (await contract.stakeholders.call(staker)).newStake.toString())

        // Locked rewards are still locked
        assert.equal('0', (await contract.latestRewardPeriod.call()))

        // Move beyond cooldown period
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds((await contract.cooldown.call()).toString()));

        await contract.withdrawFunds(0, {from: staker})

        assert.equal(initialBalance.add(amountToWithdraw).toString(), (await token.balanceOf.call(staker)).toString())
        assert.equal('0', (await contract.getWithdrawalLength.call(staker)).toString())

    }),
    it("Withdrawing all rewards deactivates user", async function() {
         // Move to 10th period to claim rewards
         await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(9).toString()));

         // Way too much, everything will be withdrawn
        var amountToWithdraw = totalStake.muln(10000000)

        // Verify the stakers are active due to locked tokens
        assert.equal((await contract.activeStakeholder(staker)), true, "Staker is already inactive and should be active")
        assert.equal((await contract.activeStakeholder(staker2)), true, "Staker is already inactive and should be active")

        // Staker 1 withdraws all funds after 10 days, only keeps locked tokens
        await contract.requestWithdrawal(amountToWithdraw, true, true, {from: staker})

        // Move until tokens are unlocked and withdraw again at the exact date
        // No tokens are left, the staker should leave the contract
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds((await contract.periodsForExtraReward.call()).sub(await contract.currentPeriod.call()).addn(1).mul(rewardPeriodDuration).toString()));

        // Staker 1 claims unlocked tokens and withdraws
        await contract.claimRewards((await contract.currentPeriod.call()), true, {from: staker})
        // Staker 2 withdraws all funds after unlock and withdraws everything
        await contract.requestWithdrawal(amountToWithdraw, true, true, {from: staker2})

        // Both stakers have no stake, new stake or locked rewards ==> deactive
        assert.equal((await contract.activeStakeholder(staker)), false, "Staker is still active and should be active")
        assert.equal((await contract.activeStakeholder(staker2)), false, "Staker is still active and should be active")
        assert.equal((await contract.stakeholders.call(staker)).startDate, 0, "Staker is still active and should be active")
        assert.equal((await contract.stakeholders.call(staker)).startDate, 0, "Staker is still active and should be active")

    }),

    it("Withdraw funds as owner", async function() {

        // Move 10 periods
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration));
        
        await contract.claimRewards((await contract.currentPeriod.call()), false, {from: staker})
        var initialOwnerBalance = (await token.balanceOf(await contract.owner.call()))

        var fundsNotStaked = contractBalance.sub(await contract.totalStakingBalance.call(await contract.latestRewardPeriod.call(), 0))
            .sub(await contract.totalLockedRewards.call('0'))

        // Only owner can withdraw funds that are not staked from the contract, total will be capped
        await truffleAssert.reverts(contract.withdrawRemainingFunds(fundsNotStaked, {from: staker}))

        // Owner can withdraw all funds that are not staked
        // Try to withdraw 1 token more than possible, the amount should be capped.
        await contract.withdrawRemainingFunds(fundsNotStaked.add(web3.utils.toBN('1000000000')).toString(), {from: ownerAddress})

        // TokenBalance of the contract should have gone down
        assert.equal(contractBalance.sub(fundsNotStaked).toString(), (await token.balanceOf(contract.address)).toString())
        // TokenBalance of the owner should have gone up
        assert.equal(initialOwnerBalance.add(fundsNotStaked).toString(), (await token.balanceOf(ownerAddress)).toString())


    }),


    it("Multiple withdrawal requests FIFO", async function() {
        var initialBalance = await token.balanceOf.call(staker)
        // Request withdrawal with more than available funds
        var amountToWithdraw = stake.divn(2)

        
        // Request withdrawal
        await contract.requestWithdrawal(amountToWithdraw, false, true, {from: staker})
        var initialRequestTime = await truffleHelpers.time.latest()
        assert.equal(stake.divn(2).toString(), (await contract.stakeholders.call(staker)).newStake.toString())
        assert.equal(stake.muln(3).divn(2).toString(), (await contract.totalNewStake.call(0)).toString())


        // Move beyond cooldown period
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds((await contract.cooldown.call()).div(web3.utils.toBN(2)).toString()));

        // Fee will be halve compared to instant
        var earlyWithdrawFee = amountToWithdraw.mul(await contract.earlyWithdrawalFee.call())
            .mul((await contract.getWithdrawal.call(0, staker)).releaseDate.sub(await truffleHelpers.time.latest()))
            .div(cooldown.mul(web3.utils.toBN(10**8)))
        
        
        // Request second withdrawal
        await contract.requestWithdrawal(amountToWithdraw.divn(2), false, true, {from: staker})
        var secondRequestTime = await truffleHelpers.time.latest()

        // Check state with 2 withdrawals

        assert.equal('2', (await contract.getWithdrawalLength.call(staker)).toString())
        assert.equal((await contract.getWithdrawal.call(0, staker)).releaseDate.toString(), initialRequestTime.add(cooldown).toString())
        assert.equal((await contract.getWithdrawal.call(1, staker)).releaseDate.toString(), secondRequestTime.add(cooldown).toString())

        assert.equal((await contract.getWithdrawal.call(0, staker)).releaseAmount.toString(), amountToWithdraw.toString())
        assert.equal((await contract.getWithdrawal.call(1, staker)).releaseAmount.toString(), amountToWithdraw.divn(2).toString())
        
        await contract.withdrawFunds(0, {from: staker})
        // Check balances
        // assert.equal(contractBalance.sub(amountToWithdraw).add(earlyWithdrawFee).toString().substring(-18), (await token.balanceOf(contract.address)).toString().substring(-18))
        // assert.equal(initialBalance.add(amountToWithdraw.sub(earlyWithdrawFee)).toString().substring(-18), (await token.balanceOf(staker)).toString().substring(-18))
        
        assert.equal('1', (await contract.getWithdrawalLength.call(staker)).toString())
        assert.equal((await contract.getWithdrawal.call(0, staker)).releaseDate.toString(), secondRequestTime.add(cooldown).toString())
        assert.equal((await contract.getWithdrawal.call(0, staker)).releaseAmount.toString(), amountToWithdraw.divn(2).toString())

        
    }),

    it("Multiple withdrawal requests LIFO", async function() {
        var initialBalance = await token.balanceOf.call(staker)
        // Request withdrawal with more than available funds
        var amountToWithdraw = stake.divn(2)

        
        // Request withdrawal
        await contract.requestWithdrawal(amountToWithdraw, false, true, {from: staker})
        var initialRequestTime = await truffleHelpers.time.latest()
        assert.equal(stake.divn(2).toString(), (await contract.stakeholders.call(staker)).newStake.toString())
        assert.equal(stake.muln(3).divn(2).toString(), (await contract.totalNewStake.call(0)).toString())


        // Move beyond cooldown period
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds((await contract.cooldown.call()).div(web3.utils.toBN(2)).toString()));

        // Fee will be halve compared to instant
        var earlyWithdrawFee = amountToWithdraw.mul(await contract.earlyWithdrawalFee.call())
            .mul((await contract.getWithdrawal.call(0, staker)).releaseDate.sub(await truffleHelpers.time.latest()))
            .div(cooldown.mul(web3.utils.toBN(10**8)))
        
        
        // Request second withdrawal
        await contract.requestWithdrawal(amountToWithdraw.divn(2), false, true, {from: staker})
        var secondRequestTime = await truffleHelpers.time.latest()

        // Check state with 2 withdrawals

        assert.equal('2', (await contract.getWithdrawalLength.call(staker)).toString())
        assert.equal((await contract.getWithdrawal.call(0, staker)).releaseDate.toString(), initialRequestTime.add(cooldown).toString())
        assert.equal((await contract.getWithdrawal.call(1, staker)).releaseDate.toString(), secondRequestTime.add(cooldown).toString())

        assert.equal((await contract.getWithdrawal.call(0, staker)).releaseAmount.toString(), amountToWithdraw.toString())
        assert.equal((await contract.getWithdrawal.call(1, staker)).releaseAmount.toString(), amountToWithdraw.divn(2).toString())
        
        await contract.withdrawFunds(1, {from: staker})
        
        assert.equal('1', (await contract.getWithdrawalLength.call(staker)).toString())
        assert.equal((await contract.getWithdrawal.call(0, staker)).releaseDate.toString(), initialRequestTime.add(cooldown).toString())
        assert.equal((await contract.getWithdrawal.call(0, staker)).releaseAmount.toString(), amountToWithdraw.toString())

        
    })

})