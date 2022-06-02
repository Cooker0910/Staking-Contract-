
const EnvoyStaking = artifacts.require("EnvoyStaking");
const EnvoyStakingKeepersInterface = artifacts.require("EnvoyStakingKeepersInterface");
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
        contract = await EnvoyStaking.new(maxNumberOfPeriods_ = web3.utils.toBN(1095),
            rewardPeriodDuration_ = web3.utils.toBN(86400),
            periodsForExtraReward_ = 182,
            extraRewardMultiplier_ = 10**6,
            cooldown_ = web3.utils.toBN(86400 * 7),
            // rewardPerPeriod_ = web3.utils.toBN('135000000000000000000000'),
            earlyWithdrawalFee_ = web3.utils.toBN(10**7),
            // wallet_ = accounts[0],
            signatureAddress, token.address);        

        keeperInterface = await EnvoyStakingKeepersInterface.new(contract.address)

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
    it("Update reward per periods", async function() {

        // Initially, the balance reward per period equals zero as there are no stakers yet
        assert.equal(await contract.currentPeriod.call(), '0', "The period was not updated correctly")
        assert.equal(await contract.latestRewardPeriod.call(), '0', "The period was not updated correctly")

        assert.equal((await contract.rewardPeriods.call('0')).rewardPerPeriod, '0')

        assert.equal((await keeperInterface.checkUpkeep.call(web3.utils.asciiToHex(""))).upkeepNeeded, false)

        // Same when in period 1
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.toString()));
        assert.equal((await keeperInterface.checkUpkeep.call(web3.utils.asciiToHex(""))).upkeepNeeded, true)        
        await keeperInterface.performUpkeep(web3.utils.asciiToHex(""), {from: ownerAddress})
        assert.equal((await keeperInterface.checkUpkeep.call(web3.utils.asciiToHex(""))).upkeepNeeded, false)

        assert.equal(await contract.currentPeriod.call(), '1', "The period was not updated correctly")
        assert.equal(await contract.latestRewardPeriod.call(), '1', "The period was not updated correctly")

        assert.equal((await contract.rewardPeriods.call('1')).rewardPerPeriod, '0')

        // Same in period 2 before updating the periods
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.toString()));
        assert.equal((await keeperInterface.checkUpkeep.call(web3.utils.asciiToHex(""))).upkeepNeeded, true)
        
        assert.equal(await contract.currentPeriod.call(), '2', "The period was not updated correctly")
        assert.equal(await contract.latestRewardPeriod.call(), '1', "The period was not updated correctly")
        assert.equal((await contract.rewardPeriods.call('0')).rewardPerPeriod, '0')
        assert.equal((await contract.rewardPeriods.call('1')).rewardPerPeriod, '0')

        // When the update happens, reward for period 1 is set basd on the final token balance
        await contract.handleNewPeriod(2, {from: ownerAddress})
        
        assert.equal(await contract.currentPeriod.call(), '2', "The period was not updated correctly")
        assert.equal(await contract.latestRewardPeriod.call(), '2', "The period was not updated correctly")
        assert.equal((await contract.rewardPeriods.call('0')).rewardPerPeriod, '0')
        assert.equal((await contract.rewardPeriods.call('1')).rewardPerPeriod, '135000000000000000000000')

        // During the second period, the remaining funds to distribute are doubled
        await token.claim(contract.address, web3.utils.toBN('135000000000000000000000').mul((await contract.maxNumberOfPeriods.call()).subn(1)).muln(2))

        // Until 2 is finalized, it has the same value as the previous period as it is the best approximation
        assert.equal((await contract.rewardPeriods.call('2')).rewardPerPeriod, '135000000000000000000000')

        // Moving to the next period, the price for period 2 is updated to the correct value
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(rewardPeriodDuration.toString()));
        assert.equal((await keeperInterface.checkUpkeep.call(web3.utils.asciiToHex(""))).upkeepNeeded, true)
        await keeperInterface.performUpkeep(web3.utils.asciiToHex(""), {from: ownerAddress})
        assert.equal((await keeperInterface.checkUpkeep.call(web3.utils.asciiToHex(""))).upkeepNeeded, false)
        assert.equal((await contract.rewardPeriods.call('3')).rewardPerPeriod, '270000000000000000000000')
        
    })
})