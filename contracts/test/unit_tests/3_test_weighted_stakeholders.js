const EnvoyStaking = artifacts.require("EnvoyStaking");
const TestToken = artifacts.require("TestToken");

const truffleAssert = require('truffle-assertions');
const truffleHelpers = require('openzeppelin-test-helpers');


const sigs = require('../utils/signatures.js')
const signerKey = sigs.signerKey
const signatureAddress = sigs.signatureAddress
const getSignature = sigs.getSignature

/**
 * Test the different aspects of weight updates:
 * - Test stakeholders can update their level if they are allowed.
 *   They should have a correct signature for the correct contract and weight specified.
 *   Other users cannot use the signature.
 *   Users have the choice between instant changes and changes that are applied next period.
 * - Test for both active and inactive stakeholder
 * - Test whether the contract owner can update weight in bulk
 * - Test whether the totals are updated correctly
 * - Test whether the maximum weight present updates correctly
 * - Test whether the weight distribution of active stakers is updated
 */
contract("Weighted stakeholders", function(accounts) {
    
    // Current time
    var startTime
    var currentTime
    
    // User addresses
    const ownerAddress = accounts[0];
    const activeStaker = accounts[1];
    const inactiveStaker = accounts[2];
    const notTheStaker = accounts[3]
    const bulkStaker1 = accounts[4]
    const bulkStaker2 = accounts[5]
    const bulkStaker3 = accounts[6]
    const bulkStaker4 = accounts[7]
    const bulkStaker5 = accounts[8]
    // Contracts to use
    var contract
    var token

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
        // Should work, tested in ./1_test_admin_updates.js
        await contract.updateSignatureAddress(signatureAddress, {from: ownerAddress})
        
        // Make sure the contract and accounts have funds
        for(account in accounts){
            await token.claim(accounts[account], web3.utils.toWei('100'))
        }
        var totalInitialRewards = web3.utils.toBN('135000000000000000000000').mul((await contract.maxNumberOfPeriods.call())).muln(2)
        await token.claim(contract.address, totalInitialRewards)

        var stake = web3.utils.toWei('50')

        // Should work: tested in ./2_test_staking.js
        await token.approve(contract.address, stake, {from: activeStaker})
        await contract.stake(stake, {from: activeStaker})

    }),

    it("Cases updating weight should revert", async function() {
        // Get signature for level 1
        var firstSignature = getSignature(contract, activeStaker, 1).signature
        // Only activeStaker can use signature
        await truffleAssert.reverts(contract.increaseWeight(1, firstSignature, {from: notTheStaker}),
            "Invalid sig");

        // Staker should not be able to select a wrong weight
        await truffleAssert.reverts(contract.increaseWeight(2, firstSignature, {from: activeStaker}),
            "Invalid sig");

        // Updating with same or lower weight does not make sense
        var zeroSignature = getSignature(contract, activeStaker, 0).signature
        await truffleAssert.reverts(contract.increaseWeight(0, zeroSignature, {from: activeStaker}),
            "No weight increase");

    }),
    it("Increase weight for active staker with new stake", async function() {
        
        // Verify if stakeholder is active
        assert.equal(await contract.activeStakeholder(activeStaker), true, "Staker is still inactive")

        var latestRewardPeriod = await contract.latestRewardPeriod.call()
        var totalNewWeightedStake = await contract.totalNewStake.call(1)

        // Get signature for level 1
        var firstSignature = getSignature(contract, activeStaker, 1).signature
        
        // Staker should be able to instantly update the weigth with the correct sig
        await contract.increaseWeight(1, firstSignature, {from: activeStaker})

        // Check if everything was updated correctly
        assert.equal('1', (await contract.stakeholders.call(activeStaker)).weight.toString())
        assert.equal('1', (await contract.rewardPeriods.call(latestRewardPeriod)).maxWeight.toString())
        
        // Make sure the increased weight is taken into account for total weighted stake
        var stake = web3.utils.toWei('50')

        assert.equal(totalNewWeightedStake.add(web3.utils.toBN(stake)).toString(), (await contract.totalNewStake.call(1)).toString())

        // Check if stakeholder distribution is updated
        assert.equal((await contract.weightCounts.call('1')).toString(), '1', 'weightCounts not updated')
    }),

    it("Increase weight for inactive staker with no stake", async function() {
        
        // Verify if stakeholder is active
        assert.equal((await contract.activeStakeholder(inactiveStaker)), false, "Staker is still inactive")

        var latestRewardPeriod = await contract.latestRewardPeriod.call()
        var totalWeightedStakingBalance = await contract.totalStakingBalance.call(latestRewardPeriod, 1)
        var totalNewWeightedStake = await contract.totalNewStake.call(1)

        // Get signature for level 1
        var firstSignature = getSignature(contract, inactiveStaker, 1).signature
        
        // Staker should be able to instantly update the weigth with the correct sig
        await contract.increaseWeight(1, firstSignature, {from: inactiveStaker})

        // Check if everything was updated correctly
        assert.equal('1', (await contract.stakeholders.call(inactiveStaker)).weight.toString())
        // Max weight only applies for active users
        assert.equal('0', (await contract.rewardPeriods.call(latestRewardPeriod)).maxWeight.toString())
        // Check if stakeholder distribution is NOT updated
        assert.equal((await contract.weightCounts.call('1')).toString(), '0', 'weightCounts not updated')

        assert.equal(totalNewWeightedStake.toString(), (await contract.totalNewStake.call(1)).toString())

        // When the inactive user with weight 1 stakes, maxWeight should update
        await token.approve(contract.address, web3.utils.toWei('10'), {from: inactiveStaker})
        await contract.stake(web3.utils.toWei('10'), {from: inactiveStaker})
        assert.equal('1', (await contract.rewardPeriods.call(latestRewardPeriod)).maxWeight.toString())
    }),
    it("Update weight in bulk as owner", async function() {

        bulkStakers = []
        for(var i=5;i<10;i++){
            bulkStakers.push(accounts[i])
            var stake = web3.utils.toWei('10')
            await token.approve(contract.address, stake, {from: accounts[i]})
            await contract.stake(stake, {from: accounts[i]})            
        }
        weights = [1,2,3,4,5]
        wrongWeights = [1,2,3,4]
        
        var latestRewardPeriod = await contract.latestRewardPeriod.call()
        var totalNewWeightedStake = await contract.totalNewStake.call(1)
        
        // Owner should be able to instantly update the weigths in bulk
        await contract.updateWeightBatch(bulkStakers, weights, {from: ownerAddress})
        
        // Length mismatch should revert
        await truffleAssert.reverts(contract.updateWeightBatch(bulkStakers, wrongWeights, {from: ownerAddress})
            , "Length mismatch");

        // Check if everything was updated correctly
        for(var i=0;i<5;i++){
            assert.equal((i+1).toString(), (await contract.stakeholders.call(bulkStakers[i])).weight.toString())
            assert.equal((await contract.weightCounts.call(i.toString())).toString(), '1', 'weightCounts not updated')
        }
    
        assert.equal('5', (await contract.rewardPeriods.call(latestRewardPeriod)).maxWeight.toString())

        assert.equal(totalNewWeightedStake.add(web3.utils.toBN(stake).muln(15)).toString(),
            (await contract.totalNewStake.call(1)).toString())

        // Remove highest staker, check if maxWeight decreases
        await contract.updateWeightBatch([bulkStakers[4]], [4], {from: ownerAddress})

        assert.equal('4', (await contract.stakeholders.call(bulkStakers[4])).weight.toString())
        assert.equal((await contract.weightCounts.call('4')).toString(), '2', 'weightCounts not updated')
        assert.equal((await contract.weightCounts.call('5')).toString(), '0', 'weightCounts not updated')
        assert.equal('4', (await contract.rewardPeriods.call(latestRewardPeriod)).maxWeight.toString())


        assert.equal(totalNewWeightedStake.add(web3.utils.toBN(stake).muln(14)).toString(),
            (await contract.totalNewStake.call(1)).toString())

    }),
        it("Verify maxWeight is adjusted for each period", async function() {

        bulkStakers = []
        for(var i=5;i<10;i++){
            bulkStakers.push(accounts[i])
            var stake = web3.utils.toWei('10')
            await token.approve(contract.address, stake, {from: accounts[i]})
            await contract.stake(stake, {from: accounts[i]})            
        }
        weights = [1,2,3,4,5]
        await contract.updateWeightBatch(bulkStakers, weights, {from: ownerAddress})
        var latestRewardPeriod = await contract.latestRewardPeriod.call()

        assert.equal('5', (await contract.rewardPeriods.call(latestRewardPeriod)).maxWeight.toString())
        
        await truffleHelpers.time.increase(truffleHelpers.time.duration.seconds(await contract.rewardPeriodDuration.call()));
        await contract.handleNewPeriod(await contract.currentPeriod.call())
        latestRewardPeriod = await contract.latestRewardPeriod.call()
        assert.equal('5', (await contract.rewardPeriods.call(latestRewardPeriod.subn(1))).maxWeight.toString())
        assert.equal('5', (await contract.rewardPeriods.call(latestRewardPeriod)).maxWeight.toString())

        await contract.updateWeightBatch([accounts[8], accounts[9]], ['4', '4'], {from: ownerAddress})
        assert.equal('5', (await contract.rewardPeriods.call(latestRewardPeriod.subn(1))).maxWeight.toString())
        assert.equal('4', (await contract.rewardPeriods.call(latestRewardPeriod)).maxWeight.toString())


    })


})