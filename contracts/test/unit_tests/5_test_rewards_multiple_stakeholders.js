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
contract("Rewarding multiple users", function(accounts) {
    
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
    var rewardPerPeriod
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
        stake = web3.utils.toBN(web3.utils.toWei('5000000000'))
        for(account in accounts){
            await token.claim(accounts[account], web3.utils.toWei('100000000000'))
            
            // Should work: tested in ./2_test_staking.js
            await token.approve(contract.address, stake.muln(3), {from: accounts[account]})
        }
        var totalInitialRewards = web3.utils.toBN('135000000000000000000000').mul((await contract.maxNumberOfPeriods.call())).muln(2)
        await token.claim(contract.address, totalInitialRewards)
        contractBalance = await token.balanceOf(contract.address)
        
        // Store initial contract values
        rewardPeriodDuration = await contract.rewardPeriodDuration.call()
        rewardPerPeriod = web3.utils.toBN('135000000000000000000000')
        

    }),

    it("Equally split rewards amongst stakers", async function() {

        // Stake funds equally
        for(account in accounts){
            await contract.stake(stake, {from: accounts[account]})
        }

        // Move 2 periods in time to have staked for a full period in time
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(2)));
        await contract.handleNewPeriod(3, {from: staker})

        assert.equal(await contract.currentPeriod.call(), 2, "The period was not updated correctly")
    
        // Each staker should get an equal share of the reward for the period
        for(account in accounts){
            rewardCalculation = await contract.calculateRewards.call(accounts[account], '2')
            assert.equal(rewardCalculation[0].toString(), rewardPerPeriod.divn(accounts.length).toString())
            assert.equal(rewardCalculation[1].toString(), rewardPerPeriod.divn(accounts.length).toString())
        }
        

    }),

    it("Split rewards amongst stakers, 1 staker with higher stake", async function() {

        // Stake funds equally, 1 with higher stake
        for(account in accounts){
            if(account != 9){
                await contract.stake(stake, {from: accounts[account]})
            } else {
                await contract.stake(stake.muln(3), {from: accounts[account]})
            }
        }

        // Move 2 periods in time to have staked for a full period in time
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(2)));
        await contract.handleNewPeriod(3, {from: staker})

        assert.equal(await contract.currentPeriod.call(), 2, "The period was not updated correctly")
    
        // Each staker should get an equal share of the reward for the period
        for(account in accounts){
            rewardCalculation = await contract.calculateRewards.call(accounts[account], '2')
            if(account != 9){
                assert.equal(rewardCalculation[0].toString(), rewardPerPeriod.divn(accounts.length + 2).toString())
                assert.equal(rewardCalculation[1].toString(), rewardPerPeriod.divn(accounts.length + 2).toString())
            } else {
                assert.equal(rewardCalculation[0].toString(), rewardPerPeriod.divn(accounts.length + 2).muln(3).toString())
                assert.equal(rewardCalculation[1].toString(), rewardPerPeriod.divn(accounts.length + 2).muln(3).toString())

            }
        }
        

    }),
    it("Split rewards amongst stakers, 1 staker with higher weight", async function() {

        // Stake funds equally
        for(account in accounts){
            await contract.stake(stake, {from: accounts[account]})
        }
        var firstSignature = getSignature(contract, accounts[9], 2).signature
        await contract.increaseWeight(2, firstSignature, {from: accounts[9]})

        // Move 2 periods in time to have staked for a full period in time
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(2)));
        await contract.handleNewPeriod(3, {from: staker})

        assert.equal(await contract.currentPeriod.call(), 2, "The period was not updated correctly")
    
        // Each staker should get an equal share of the reward for the period
        for(account in accounts){
            rewardCalculation = await contract.calculateRewards.call(accounts[account], '2')
            if(account != 9){
                assert.equal(rewardCalculation[0].toString(), rewardPerPeriod.divn(accounts.length + 2).toString())
                assert.equal(rewardCalculation[1].toString(), rewardPerPeriod.divn(accounts.length + 2).toString())
            } else {
                assert.equal(rewardCalculation[0].toString(), rewardPerPeriod.divn(accounts.length + 2).muln(3).toString())
                assert.equal(rewardCalculation[1].toString(), rewardPerPeriod.divn(accounts.length + 2).muln(3).toString())

            }

        }

    }),
    it("Split rewards amongst stakers, 1 staker restakes after a period", async function() {

        // Stake funds equally
        for(account in accounts){
            await contract.stake(stake, {from: accounts[account]})
        }
        // Move 1 period and restake
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(1)));

        await contract.stake(stake, {from: accounts[9]})
        // Move another 2 periods in time to have staked for a full period in time
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.muln(2)));
        await contract.handleNewPeriod(3, {from: staker})

        assert.equal(await contract.currentPeriod.call(), '3', "The period was not updated correctly")
    
        // Each staker should get an equal share of the reward for the period
        var firstReward = rewardPerPeriod.divn(accounts.length)
        var noRestakeSecondReward = rewardPerPeriod.mul(stake.add(firstReward)).div(stake.muln(accounts.length+1).add(rewardPerPeriod))
        var restakeSecondReward = rewardPerPeriod.mul(stake.muln(2).add(firstReward)).div(stake.muln(accounts.length+1).add(rewardPerPeriod))

        // Account with 
        for(account in accounts){
            // First period, rewards are still equal
            rewardCalculation = await contract.calculateRewards.call(accounts[account], '2')
            assert.equal(rewardCalculation[0].toString(), rewardPerPeriod.divn(accounts.length).toString())
            assert.equal(rewardCalculation[1].toString(), rewardPerPeriod.divn(accounts.length).toString())
            // Second period, staker who restaked a higher amount has a higher reward
            rewardCalculation = await contract.calculateRewards.call(accounts[account], '3')
            if(account != 9){
                assert.equal(rewardCalculation[0].toString(), firstReward.add(noRestakeSecondReward).toString())
                assert.equal(rewardCalculation[1].toString(), firstReward.add(noRestakeSecondReward).toString())
            } else {
                assert.equal(rewardCalculation[0].toString(), firstReward.add(restakeSecondReward).toString())
                assert.equal(rewardCalculation[1].toString(), firstReward.add(restakeSecondReward).toString())

            }
        }
        

    })
        

})
